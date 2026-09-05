import { randomUUID } from "node:crypto";
import path from "node:path";

import type {
  NewSessionResponse,
  RequestPermissionRequest,
  RequestPermissionResponse,
} from "@agentclientprotocol/sdk";
import {
  HarnessOutputChannel,
  type HarnessAdapter,
  type HarnessError,
  type HarnessInspection,
  type HarnessResult,
  type HarnessSession,
  type HarnessSessionState,
  type HarnessOutput,
  type HostCommand,
  type HostThreadSnapshot,
  type InspectHarnessInput,
  type OpenSessionInput,
  type TurnStartCommand,
  type TurnStartAccepted,
  type TurnSteerAccepted,
  type TurnSteerCommand,
  type TurnCancelCommand,
  type TurnCancelAccepted,
  type InteractionRespondCommand,
  type InteractionRespondAccepted,
  type ModelSelectCommand,
  type ModelSelectCompleted,
  type ThinkingSelectCommand,
  type ThinkingSelectCompleted,
  type PermissionModeSelectCommand,
  type PermissionModeSelectCompleted,
  type HostUserMessageItem,
} from "@codexhost/harness-adapter";
import {
  harnessIdSchema,
  harnessPermissionModeIdSchema,
  nativeSessionRefSchema,
  type NativeTurnRef,
  hostItemIdSchema,
} from "@codexhost/shared-contracts";

import {
  CursorAcpTransport,
  cursorError,
  type CursorTransport,
  type CursorTransportOptions,
} from "./acp-transport.js";
import {
  cursorNativeTurnKeys,
  latestCursorNativeTurn,
  mapCursorHistory,
} from "./cursor-history.js";
import {
  CURSOR_BYPASS_PERMISSION_MODE_ID,
  cursorCapabilities,
  cursorConfiguration,
  cursorNativeModelId,
  isCursorBypassPermissionMode,
} from "./cursor-models.js";
import { CursorTurn } from "./cursor-turn.js";

const cursorId = harnessIdSchema.parse("cursor");
const UNSUPPORTED_HISTORY_MESSAGE =
  "Cursor does not support Fork, last-turn rollback, or unattended-full-access";

type CursorNativeConfig = Pick<NewSessionResponse, "configOptions" | "modes"> & {
  sessionId?: string;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Accepted =
  | TurnStartAccepted
  | TurnSteerAccepted
  | TurnCancelAccepted
  | InteractionRespondAccepted
  | ModelSelectCompleted
  | ThinkingSelectCompleted
  | PermissionModeSelectCompleted;

function failure<T>(code: HarnessError["code"], message: string): HarnessResult<T> {
  return { ok: false, error: { code, message, retryable: false } };
}

async function selectNative(
  transport: CursorTransport,
  response: CursorNativeConfig,
  id: "model" | "mode",
  value: string,
): Promise<void> {
  const configuration = cursorConfiguration(response);
  const available =
    id === "model"
      ? configuration.catalog.models.some((model) => cursorNativeModelId(model.ref) === value)
      : configuration.permissionModes?.modes.some((mode) => mode.id === value);
  if (!available) throw new Error("Cursor configuration value is not available");
  const selected = await transport.configure(id, value);
  const confirmed = selected.configOptions.find((option) => option.id === id);
  if (!confirmed || confirmed.currentValue !== value)
    throw new Error("Cursor did not confirm the requested configuration");
  response.configOptions = selected.configOptions;
  if (id === "mode" && response.modes) response.modes.currentModeId = value;
}

class CursorSession implements HarnessSession {
  readonly harnessId = cursorId;
  readonly capabilities;
  readonly initialState: HarnessSessionState;
  readonly initialUsage = null;
  readonly #channel = new HarnessOutputChannel<HarnessOutput>();
  readonly outputs = this.#channel.outputs;
  #active: CursorTurn | undefined;
  #runTask: Promise<void> | undefined;
  #closed = false;
  #configuring = false;
  // The synthetic `bypass` Mode is not a Cursor Mode: it is answered here.
  #bypassPermissions = false;

  /** Starts this Session under the synthetic `bypass` Permission Mode. */
  enableBypassPermissions(): void {
    this.#bypassPermissions = true;
  }
  #closeTask: Promise<void> | undefined;
  readonly #sessionId: string;
  readonly #knownTurnRefs: readonly NativeTurnRef[];
  readonly #settleTimeoutMs: number;

  constructor(
    readonly transport: CursorTransport,
    readonly native: CursorNativeConfig,
    sessionId: string,
    readonly onClose: () => void,
    knownTurnRefs: readonly NativeTurnRef[] = [],
    settleTimeoutMs = 2_000,
  ) {
    this.#sessionId = sessionId;
    this.#knownTurnRefs = knownTurnRefs;
    this.#settleTimeoutMs = settleTimeoutMs;
    const configuration = cursorConfiguration(native);
    this.capabilities = cursorCapabilities(configuration);
    this.initialState = {
      ...configuration.state,
      nativeRef: nativeSessionRefSchema.parse({
        harnessId: cursorId,
        nativeSessionId: sessionId,
        formatVersion: 1,
        locator: { protocol: "cursor-acp", transcript: "native" },
      }),
    };
  }

  async #readHistorySnapshot(): Promise<HostThreadSnapshot> {
    const messages = await this.transport.readHistory(this.#sessionId);
    return mapCursorHistory(messages, cursorId, this.#sessionId, this.#knownTurnRefs);
  }

  async #settleNativeTurn(previousKeys: ReadonlySet<string>): Promise<NativeTurnRef | undefined> {
    const deadline = Date.now() + this.#settleTimeoutMs;
    while (Date.now() <= deadline) {
      const snapshot = await this.#readHistorySnapshot();
      const next = latestCursorNativeTurn(snapshot, previousKeys);
      if (next && !previousKeys.has(next.nativeTurnKey)) return next;
      await wait(50);
    }
    const snapshot = await this.#readHistorySnapshot();
    return latestCursorNativeTurn(snapshot, previousKeys);
  }

  async readSnapshot(): Promise<HarnessResult<HostThreadSnapshot>> {
    if (this.#closed) return failure("invalidState", "Cursor session is closed");
    if (this.#active || this.#configuring) {
      return {
        ok: false,
        error: {
          code: "sessionBusy",
          message: "Cursor Session cannot read history during another operation",
          retryable: true,
        },
      };
    }
    try {
      const snapshot = await this.#readHistorySnapshot();
      return {
        ok: true,
        value: {
          ...snapshot,
          state: { ...this.initialState, ...cursorConfiguration(this.native).state },
        },
      };
    } catch (error) {
      return { ok: false, error: cursorError(error) };
    }
  }

  fault(error: HarnessError): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#active?.finish({ status: "failed", error });
    this.#active = undefined;
    this.#channel.emit({ kind: "event", event: { type: "session.faulted", error } });
    this.#channel.end();
    void this.transport.close().finally(this.onClose);
  }

  execute(command: TurnStartCommand): Promise<HarnessResult<TurnStartAccepted>>;
  execute(command: TurnSteerCommand): Promise<HarnessResult<TurnSteerAccepted>>;
  execute(command: TurnCancelCommand): Promise<HarnessResult<TurnCancelAccepted>>;
  execute(command: InteractionRespondCommand): Promise<HarnessResult<InteractionRespondAccepted>>;
  execute(command: ModelSelectCommand): Promise<HarnessResult<ModelSelectCompleted>>;
  execute(command: ThinkingSelectCommand): Promise<HarnessResult<ThinkingSelectCompleted>>;
  execute(
    command: PermissionModeSelectCommand,
  ): Promise<HarnessResult<PermissionModeSelectCompleted>>;
  async execute(command: HostCommand): Promise<HarnessResult<Accepted>> {
    if (this.#closed) return failure("invalidState", "Cursor session is closed");
    if (command.type === "interaction.respond") {
      return (
        this.#active?.interactions.respond(command) ??
        failure("invalidState", "Cursor has no active interaction")
      );
    }
    if (command.type === "turn.steer") return this.#steer(command);
    if (command.type === "turn.cancel") {
      if (!this.#active || this.#active.turnId !== command.turnId)
        return failure("invalidState", "Cursor turn is not active");
      this.#active.cancellationRequested = true;
      this.#active.interactions.close();
      try {
        await this.transport.cancel();
        return { ok: true, value: { cancellationRequested: true } };
      } catch (error) {
        return { ok: false, error: cursorError(error) };
      }
    }
    if (this.#active || this.#configuring) return failure("sessionBusy", "Cursor session is busy");
    if (command.type === "thinking.select")
      return failure(
        "unsupported",
        "Cursor reasoning settings are part of its native Model selection",
      );
    if (
      command.type === "permissionMode.select" &&
      isCursorBypassPermissionMode(command.permissionModeId)
    ) {
      // Cursor has no native "run everything" Mode; the Host answers its
      // permission requests instead, so nothing is sent to the CLI.
      this.#bypassPermissions = true;
      this.#channel.emit({
        kind: "event",
        event: {
          type: "session.state.changed",
          state: {
            ...cursorConfiguration(this.native).state,
            effectivePermissionModeId: harnessPermissionModeIdSchema.parse(
              CURSOR_BYPASS_PERMISSION_MODE_ID,
            ),
            ...(this.initialState.nativeRef ? { nativeRef: this.initialState.nativeRef } : {}),
          },
        },
      });
      return { ok: true, value: { completed: true } };
    }
    if (command.type === "model.select" || command.type === "permissionMode.select") {
      this.#bypassPermissions = false;
      this.#configuring = true;
      try {
        await selectNative(
          this.transport,
          this.native,
          command.type === "model.select" ? "model" : "mode",
          command.type === "model.select"
            ? cursorNativeModelId(command.model)
            : command.permissionModeId,
        );
        this.#channel.emit({
          kind: "event",
          event: {
            type: "session.state.changed",
            state: {
              ...cursorConfiguration(this.native).state,
              ...(this.initialState.nativeRef ? { nativeRef: this.initialState.nativeRef } : {}),
            },
          },
        });
        return { ok: true, value: { completed: true } };
      } catch (error) {
        return { ok: false, error: cursorError(error, "invalidRequest") };
      } finally {
        this.#configuring = false;
      }
    }
    const text = command.input.map((part) => part.text).join("\n");
    if (!text.trim()) return failure("invalidRequest", "Cursor requires non-empty text input");
    const turn = new CursorTurn(command.turnId, (output) => this.#channel.emit(output));
    this.#active = turn;
    this.#channel.emit({ kind: "event", event: { type: "turn.started", turnId: command.turnId } });
    this.#runTask = this.#run(turn, text);
    return { ok: true, value: { turnId: command.turnId } };
  }

  /**
   * Cursor's ACP has no mid-prompt injection. A steer therefore interrupts the
   * running prompt and, once that prompt settles as cancelled, re-prompts the
   * same session with the new text — the conversation context is retained and
   * the Host Turn stays open, so Desktop sees one Turn that changed course.
   */
  async #steer(command: TurnSteerCommand): Promise<HarnessResult<TurnSteerAccepted>> {
    const turn = this.#active;
    if (!turn || turn.turnId !== command.turnId) {
      return failure("invalidState", "Cursor steer must reference the active Turn");
    }
    if (turn.cancellationRequested) {
      return failure("invalidState", "Cursor Turn is already being cancelled");
    }
    const text = command.input.map((part) => part.text).join("\n");
    if (!text.trim()) return failure("invalidRequest", "Cursor steer requires non-empty text");
    turn.pendingSteer = turn.pendingSteer ? `${turn.pendingSteer}\n${text}` : text;
    try {
      await this.transport.cancel();
      return { ok: true, value: { accepted: true } };
    } catch (error) {
      turn.pendingSteer = undefined;
      return { ok: false, error: cursorError(error) };
    }
  }

  /**
   * Under the synthetic `bypass` Mode the Host answers Cursor's own permission
   * request with its "allow" option instead of raising a Host approval.
   * Cursor still runs inside its own sandbox: no CLI flag is changed.
   */
  #permission(
    turn: CursorTurn,
    request: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse> {
    if (!this.#bypassPermissions) return turn.interactions.permission(request);
    const allow =
      request.options.find((option) => option.kind === "allow_always") ??
      request.options.find((option) => option.kind === "allow_once");
    if (!allow) return turn.interactions.permission(request);
    return Promise.resolve({ outcome: { outcome: "selected", optionId: allow.optionId } });
  }

  async #run(turn: CursorTurn, text: string): Promise<void> {
    try {
      const previousKeysTask = this.#readHistorySnapshot()
        .then(cursorNativeTurnKeys)
        .catch(() => new Set<string>());
      let response = await this.transport.runTurn(text, {
        update: (update) => turn.update(update),
        permission: (request) => this.#permission(turn, request),
        extension: (method, params) => turn.interactions.extension(method, params),
      });
      // An interrupt that carried a steer re-prompts inside this Host Turn;
      // a user cancel wins over any steer that raced it.
      while (
        this.#active === turn &&
        response.stopReason === "cancelled" &&
        turn.pendingSteer !== undefined &&
        !turn.cancellationRequested
      ) {
        const steerText = turn.pendingSteer;
        turn.pendingSteer = undefined;
        // The re-prompt is the user's steer landing in this Turn: surface it as
        // an in-turn user item before the continuation streams.
        const steerItem: HostUserMessageItem = {
          type: "userMessage",
          itemId: hostItemIdSchema.parse(randomUUID()),
          text: steerText,
        };
        turn.emit({
          kind: "event",
          event: { type: "item.started", turnId: turn.turnId, item: steerItem },
        });
        turn.emit({
          kind: "event",
          event: {
            type: "item.completed",
            turnId: turn.turnId,
            snapshot: { item: steerItem, outcome: { status: "succeeded" } },
          },
        });
        response = await this.transport.runTurn(steerText, {
          update: (update) => turn.update(update),
          permission: (request) => this.#permission(turn, request),
          extension: (method, params) => turn.interactions.extension(method, params),
        });
      }
      turn.acpTerminal = true;
      const reason = response.stopReason;
      const previousKeys = await previousKeysTask;
      const nativeTurnRef =
        reason === "end_turn" ? await this.#settleNativeTurn(previousKeys) : undefined;
      turn.finish(
        reason === "cancelled"
          ? { status: "cancelled", reason: "Cursor turn cancelled" }
          : reason === "end_turn"
            ? { status: "succeeded" }
            : {
                status: "failed",
                error: {
                  code: "nativeFailure",
                  message: `Cursor stopped with ${reason}`,
                  retryable: false,
                },
              },
        nativeTurnRef,
      );
    } catch (error) {
      if (this.#active === turn)
        turn.finish(
          this.#closed && turn.cancellationRequested
            ? { status: "cancelled", reason: "Cursor session closed" }
            : { status: "failed", error: cursorError(error) },
        );
    } finally {
      if (this.#active === turn) this.#active = undefined;
    }
  }

  close(): Promise<void> {
    if (this.#closeTask) return this.#closeTask;
    this.#closed = true;
    this.#closeTask = (async () => {
      const active = this.#active;
      if (active && !active.acpTerminal) {
        active.cancellationRequested = true;
        active.interactions.close();
      }
      await this.transport.close();
      if (active && !active.acpTerminal) {
        active.finish({ status: "cancelled", reason: "Cursor session closed" });
      }
      await this.#runTask?.catch(() => undefined);
      this.#active = undefined;
      this.#channel.end();
      this.onClose();
    })();
    return this.#closeTask;
  }
}

export interface CursorAdapterOptions {
  command?: string;
  environment?: NodeJS.ProcessEnv;
  commandTimeoutMs?: number;
  nativeHistorySettleTimeoutMs?: number;
}

export class CursorAdapter implements HarnessAdapter {
  readonly harnessId = cursorId;
  readonly #sessions = new Set<CursorSession>();
  #configuration = cursorConfiguration({});
  #inspection: HarnessInspection | undefined;
  #closed = false;

  constructor(
    readonly options: CursorAdapterOptions = {},
    readonly createTransport: (options: CursorTransportOptions) => CursorTransport = (options) =>
      new CursorAcpTransport(options),
  ) {}

  async inspect(input: InspectHarnessInput = {}): Promise<HarnessInspection> {
    if (this.#closed)
      return {
        status: "unavailable",
        error: { code: "CURSOR_CLOSED", message: "Cursor adapter is closed", retryable: false },
      };
    if (this.#inspection && !input.refresh) return this.#inspection;
    const transport = this.createTransport({
      ...this.options,
      cwd: input.cwd ?? process.cwd(),
      onFault: () => {},
    });
    try {
      const initialized = await transport.inspect();
      if (initialized.protocolVersion !== 1) throw new Error("Unsupported Cursor ACP protocol");
      this.#inspection = this.#ready();
      return this.#inspection;
    } catch (error) {
      const normalized = cursorError(error, "unavailable");
      return {
        status: normalized.code === "notInstalled" ? "notInstalled" : "unavailable",
        error: normalized,
      };
    } finally {
      await transport.close();
    }
  }

  #ready(): HarnessInspection {
    return {
      status: "ready",
      catalog: this.#configuration.catalog,
      ...(this.#configuration.permissionModes
        ? { permissionModes: this.#configuration.permissionModes }
        : {}),
      capabilities: cursorCapabilities(this.#configuration),
    };
  }

  async open(input: OpenSessionInput): Promise<HarnessResult<HarnessSession>> {
    if (this.#closed) return failure("invalidState", "Cursor adapter is closed");
    if (input.kind === "fork" || input.kind === "rollbackLastTurn") {
      return failure("unsupported", UNSUPPORTED_HISTORY_MESSAGE);
    }
    if (input.kind === "create" && input.executionPolicy === "unattended-full-access")
      return failure(
        "unsupported",
        "Cursor integration preserves native permissions; unattended-full-access is not supported",
      );
    if (input.kind === "create" && input.thinkingOptionId)
      return failure("unsupported", "Cursor has no independent Thinking selector");
    if (!path.isAbsolute(input.cwd))
      return failure("invalidRequest", "Cursor cwd must be absolute");
    if (input.kind === "resume") {
      const parsed = nativeSessionRefSchema.safeParse(input.nativeRef);
      if (!parsed.success || parsed.data.harnessId !== cursorId) {
        return failure("invalidRequest", "Cursor cannot resume another Harness's Native Session");
      }
    }
    let session: CursorSession | undefined;
    let fault: HarnessError | undefined;
    const transport = this.createTransport({
      ...this.options,
      cwd: input.cwd,
      environment: { ...this.options.environment, ...input.environment },
      onFault: (error) => {
        fault = error;
        session?.fault(error);
      },
    });
    try {
      const response =
        input.kind === "resume"
          ? await transport.open({ kind: "resume", sessionId: input.nativeRef.nativeSessionId })
          : await transport.open({ kind: "create" });
      if (input.kind === "create" && input.model)
        await selectNative(transport, response, "model", cursorNativeModelId(input.model));
      // The synthetic `bypass` Mode is not a Cursor Mode: never send it to the
      // CLI, carry it as Host-side auto-approval on the Session instead.
      const bypassAtCreate =
        input.kind === "create" &&
        input.permissionModeId !== undefined &&
        isCursorBypassPermissionMode(input.permissionModeId);
      if (input.kind === "create" && input.permissionModeId && !bypassAtCreate)
        await selectNative(transport, response, "mode", input.permissionModeId);
      if (fault) {
        await transport.close();
        return { ok: false, error: fault };
      }
      this.#configuration = cursorConfiguration(response);
      this.#inspection = this.#ready();
      const sessionId =
        input.kind === "resume"
          ? input.nativeRef.nativeSessionId
          : "sessionId" in response && typeof response.sessionId === "string"
            ? response.sessionId
            : undefined;
      if (!sessionId) {
        await transport.close();
        return failure("protocolError", "Cursor ACP returned no Session identity");
      }
      session = new CursorSession(
        transport,
        response,
        sessionId,
        () => {
          if (session) this.#sessions.delete(session);
        },
        input.kind === "resume" ? (input.knownTurnRefs ?? []) : [],
        this.options.nativeHistorySettleTimeoutMs ?? 2_000,
      );
      if (bypassAtCreate) session.enableBypassPermissions();
      this.#sessions.add(session);
      return { ok: true, value: session };
    } catch (error) {
      await transport.close();
      return { ok: false, error: cursorError(error) };
    }
  }

  async close(): Promise<void> {
    this.#closed = true;
    await Promise.all([...this.#sessions].map((session) => session.close()));
    this.#sessions.clear();
  }
}
