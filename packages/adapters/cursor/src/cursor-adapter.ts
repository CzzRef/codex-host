import path from "node:path";

import type { NewSessionResponse } from "@agentclientprotocol/sdk";
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
} from "@codexhost/harness-adapter";
import { harnessIdSchema, nativeSessionRefSchema } from "@codexhost/shared-contracts";

import {
  CursorAcpTransport,
  cursorError,
  type CursorTransport,
  type CursorTransportOptions,
} from "./acp-transport.js";
import { cursorCapabilities, cursorConfiguration, cursorNativeModelId } from "./cursor-models.js";
import { CursorTurn } from "./cursor-turn.js";

const cursorId = harnessIdSchema.parse("cursor");
const HISTORY_MESSAGE =
  "Cursor ACP exposes no replayable native transcript. This live-only task cannot be restored after codexhost exits; start a new task. Cursor's native session data is left untouched.";

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
  response: NewSessionResponse,
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
  #closed = false;
  #configuring = false;
  #closeTask: Promise<void> | undefined;

  constructor(
    readonly transport: CursorTransport,
    readonly native: NewSessionResponse,
    readonly onClose: () => void,
  ) {
    const configuration = cursorConfiguration(native);
    this.capabilities = cursorCapabilities(configuration);
    this.initialState = {
      ...configuration.state,
      nativeRef: nativeSessionRefSchema.parse({
        harnessId: cursorId,
        nativeSessionId: native.sessionId,
        formatVersion: 1,
        locator: { transcript: "live-only", protocol: "cursor-acp" },
      }),
    };
  }

  async readSnapshot(): Promise<HarnessResult<HostThreadSnapshot>> {
    return failure("unsupported", HISTORY_MESSAGE);
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
    if (command.type === "model.select" || command.type === "permissionMode.select") {
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
    void this.#run(turn, text);
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

  async #run(turn: CursorTurn, text: string): Promise<void> {
    try {
      let response = await this.transport.runTurn(text, {
        update: (update) => turn.update(update),
        permission: (request) => turn.interactions.permission(request),
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
        response = await this.transport.runTurn(steerText, {
          update: (update) => turn.update(update),
          permission: (request) => turn.interactions.permission(request),
          extension: (method, params) => turn.interactions.extension(method, params),
        });
      }
      if (this.#active !== turn) return;
      const reason = response.stopReason;
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
      if (active) {
        active.cancellationRequested = true;
        active.interactions.close();
      }
      await this.transport.close();
      active?.finish({ status: "cancelled", reason: "Cursor session closed" });
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
    if (input.kind !== "create") return failure("unsupported", HISTORY_MESSAGE);
    if (input.executionPolicy === "unattended-full-access")
      return failure(
        "unsupported",
        "Cursor integration preserves native permissions; unattended-full-access is not supported",
      );
    if (input.thinkingOptionId)
      return failure("unsupported", "Cursor has no independent Thinking selector");
    if (!path.isAbsolute(input.cwd))
      return failure("invalidRequest", "Cursor cwd must be absolute");
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
      const response = await transport.open();
      if (input.model)
        await selectNative(transport, response, "model", cursorNativeModelId(input.model));
      if (input.permissionModeId)
        await selectNative(transport, response, "mode", input.permissionModeId);
      if (fault) {
        await transport.close();
        return { ok: false, error: fault };
      }
      this.#configuration = cursorConfiguration(response);
      this.#inspection = this.#ready();
      session = new CursorSession(transport, response, () => {
        if (session) this.#sessions.delete(session);
      });
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
