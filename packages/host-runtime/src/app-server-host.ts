import type { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import type { Readable, Writable } from "node:stream";

import type {
  HarnessAdapter,
  HarnessOutput,
  HarnessSession,
  HostApprovalInteraction,
  HostSubagentState,
  HostApprovalResponse,
  HostQuestionInteraction,
} from "@codexhost/harness-adapter";
import { parseHostUsage, type HostUsage } from "@codexhost/harness-adapter";
import type { StoredThreadRecordV1 } from "@codexhost/mapping-store";
import {
  accountCreditsSnapshotSchema,
  externalThreadForkParamsSchema,
  harnessCommandCatalogSchema,
  harnessIdSchema,
  threadCommandExecuteParamsSchema,
  threadCommandExecuteResultSchema,
  threadCommandsInspectParamsSchema,
  externalThreadForkResultSchema,
  harnessInspectParamsSchema,
  harnessConfigurationStateSchema,
  harnessInspectionSchema,
  harnessModelRefSchema,
  harnessModelSelectionStateSchema,
  harnessThinkingOptionIdSchema,
  hostItemIdSchema,
  hostThreadIdSchema,
  hostTurnIdSchema,
  jsonValueSchema,
  threadInspectionParamsSchema,
  threadInspectionSchema,
  threadModelSelectParamsSchema,
  threadUsageInspectionParamsSchema,
  threadUsageInspectionSchema,
  threadWorkspaceInspectParamsSchema,
  threadWorkspaceSnapshotSchema,
  threadPermissionModeSelectParamsSchema,
  threadThinkingSelectParamsSchema,
  threadOwnershipListParamsSchema,
  threadOwnershipListResultSchema,
  updateCheckResultSchema,
  updateEmptyParamsSchema,
  updateStartResultSchema,
  updateStatusResultSchema,
  workspaceWorktreeCreateParamsSchema,
  workspaceWorktreeCreateResultSchema,
  workspaceWorktreeListParamsSchema,
  workspaceWorktreeListResultSchema,
  type AccountCreditsSnapshot,
  type HarnessModelRef,
  type HarnessPermissionModeId,
  type HarnessThinkingOptionId,
  type HostInteractionId,
  type HostTurnId,
} from "@codexhost/shared-contracts";
import { executeExternalThreadFork } from "./external-thread-fork.js";
import {
  ExternalHistoryRequestError,
  listExternalItems,
  listExternalTurns,
} from "./external-thread-history.js";
import { decodeThreadRedoRequest, executeExternalThreadRedo } from "./external-thread-redo.js";
import {
  executeExternalThreadRollback,
  externalRollbackCapabilities,
} from "./external-thread-rollback.js";
import {
  createExternalThreadRecordInput,
  createProductionExternalThreadStore,
  derivedThreadName,
  ExternalThreadRepository,
  externalThreadValue,
  isEphemeralDerivedThread,
  navigationHostThreadId,
  type ExternalThreadStore,
} from "./external-thread-repository.js";
import {
  createTitleOverlayWatch,
  defaultTitleOverlayDirectory,
  type TitleOverlayWatch,
} from "./external-thread-title-overlay.js";
import {
  ExternalThreadRuntime,
  type ExternalThread,
  type ExternalThreadLocation,
  type ExternalThreadResolution,
} from "./external-thread-runtime.js";
import {
  DELEGATION_CLI_PATH_ENV,
  DELEGATION_RUNTIME_ENDPOINT_ENV,
  DELEGATION_RUNTIME_TOKEN_ENV,
  DELEGATION_THREAD_ID_ENV,
  DelegationControlError,
} from "./delegation-types.js";
import { HarnessDelegationCoordinator } from "./harness-delegation-coordinator.js";
import type {
  DelegationControlRegistration,
  DelegationStartInput,
  DelegationStartResult,
  DelegationThreadListResult,
  DelegationThreadSnapshot,
  DelegationThreadStatus,
  HarnessInspectInput,
  HarnessInspectResult,
  ThreadArchiveInput,
  ThreadArchiveResult,
  ThreadCancelInput,
  ThreadCancelResult,
  ThreadListInput,
  ThreadReadInput,
  ThreadRenameInput,
  ThreadRenameResult,
  ThreadSendInput,
  ThreadSendResult,
} from "./delegation-types.js";
import { projectDelegationThreadSnapshot } from "./delegation-snapshot.js";
import { OfficialRequestBroker } from "./official-request-broker.js";
import {
  spawnOfficialAppServerConnection,
  type OfficialAppServerConnection,
} from "./official-app-server-connection.js";
import type { HostUpdateCoordinator } from "./update-coordinator.js";
import { createThreadWorkspaceWatch, inspectGitWorkspace } from "./thread-workspace.js";
import {
  WorkspaceWorktreeError,
  createWorkspaceWorktree,
  listWorkspaceWorktrees,
} from "./workspace-worktree.js";

const SUBAGENT_TERMINAL_REFRESH_DELAYS_MS = [0, 50, 100, 150] as const;
const THREAD_USAGE_UPDATED_METHOD = "codexhost/thread/usage/updated";
const THREAD_WORKSPACE_UPDATED_METHOD = "codexhost/thread/workspace/updated";
// Native Codex account quota is still pulled through its official API; keep
// that reading briefly cached so concurrent Composer inspections coalesce.
const OFFICIAL_RATE_LIMIT_TTL_MS = 15_000;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
import {
  classifyThreadPurpose,
  RequestRouteObservationTracker,
  type CreateRequestRouteObservation,
  type RequestRouteObservation,
} from "./route-observation.js";
import {
  aggregateThreadList,
  officialThreadListPageFromResponse,
  OfficialThreadListError,
} from "./thread-list-aggregator.js";
import {
  CodexTurnProjector,
  decodeCreateRoute,
  decodeExternalTransportSelection,
  encodeExternalTransportSelection,
  CODEX_PINNED_THREAD_SECTION_ID,
  decodeThreadArchiveRequest,
  decodeThreadForkRequest,
  decodeThreadListRequest,
  decodeThreadMetadataUpdateRequest,
  decodeThreadRevertRequest,
  decodeThreadRollbackRequest,
  decodeThreadSectionMoveRequest,
  effectiveThreadSectionId,
  mapExternalThreadHarnessError,
  projectCodexRateLimitsToCredits,
  observeCodexRateLimits,
  observeCodexTokenUsage,
  parseJsonFrame,
  projectCodexThreadUsage,
  readLfFrames,
  writeFrame,
  writeJsonFrame,
  jsonRpcRequestSchema,
  threadForkResult,
  threadRevertResult,
  threadRollbackResult,
  transportModelIdForHarness,
  type CodexApprovalProjection,
  type CodexQuestionProjection,
  type DecodedThreadForkRequest,
  type DecodedThreadMetadataUpdateRequest,
  type DecodedThreadListRequest,
  type DecodedThreadRevertRequest,
  type DecodedThreadRollbackRequest,
  type DecodedThreadSectionMoveRequest,
  type ExternalThreadRpcError,
  type CodexApprovalRequestProjection,
  type CodexQuestionRequestProjection,
  type ExternalHarnessId,
  type JsonObject,
  type JsonRpcRequest,
  type JsonValue,
  type ProjectableHostEvent,
} from "@codexhost/protocol-core";

export interface AppServerHostOptions {
  stockCodexPath: string;
  arguments: string[];
  defaultAgent: "codex" | "pi";
  environment?: NodeJS.ProcessEnv;
  desktopInput?: Readable;
  desktopOutput?: Writable;
  diagnosticOutput?: Writable;
  externalAdapters: ReadonlyMap<ExternalHarnessId, HarnessAdapter>;
  mappingStore?: ExternalThreadStore;
  titleOverlayDirectory?: string;
  /** Defaults to true. A listener that shares one store across sessions owns closing it. */
  closeMappingStoreOnExit?: boolean;
  spawnOfficial?: typeof spawn;
  createOfficialConnection?: () =>
    OfficialAppServerConnection | Promise<OfficialAppServerConnection>;
  onCreateRequestRoute?: (observation: CreateRequestRouteObservation) => void;
  onRequestRoute?: (observation: RequestRouteObservation) => void;
  updateCoordinator?: HostUpdateCoordinator;
  onDelegationApi?: (api: DelegationControlRegistration) => (() => void) | undefined;
}

interface TurnProjectionGate {
  promise: Promise<void>;
  resolve(): void;
}

interface ProjectedTurn {
  projector: CodexTurnProjector;
}

type HostApprovalRequestId = number;
type HostQuestionRequestId = number;

interface PendingDesktopApproval {
  thread: ExternalThread;
  interaction: HostApprovalInteraction;
  projection: CodexApprovalRequestProjection;
}

interface PendingDesktopQuestion {
  thread: ExternalThread;
  interaction: HostQuestionInteraction;
  projection: CodexQuestionRequestProjection;
  timeout: NodeJS.Timeout | null;
}

type ExternalThreadStatus = { type: "active"; activeFlags: [] } | { type: "idle" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCreditsAdapter(adapter: HarnessAdapter): adapter is HarnessAdapter & {
  credits(): unknown;
  refreshCredits?: () => Promise<unknown>;
} {
  return typeof (adapter as { credits?: unknown }).credits === "function";
}

function projectAccountCredits(value: unknown): AccountCreditsSnapshot | null {
  if (!isRecord(value)) return null;
  const rest = { ...value };
  delete rest.fetchedAt;
  const parsed = accountCreditsSnapshotSchema.safeParse(rest);
  return parsed.success ? parsed.data : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function officialEnvironment(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const allowed = new Set([
    DELEGATION_CLI_PATH_ENV,
    DELEGATION_RUNTIME_ENDPOINT_ENV,
    DELEGATION_RUNTIME_TOKEN_ENV,
  ]);
  const internal = new Set([
    "CODEX_CLI_PATH",
    "CODEXHOST_HOST_NODE_PATH",
    "CODEXHOST_DATA_DIR",
    "CODEXHOST_DEFAULT_AGENT",
    "CODEXHOST_HOST_RUNTIME_PATH",
    "CODEXHOST_PI_COMMAND",
    "CODEXHOST_ENABLE_CLAUDE_CODE",
    "CODEXHOST_CLAUDE_COMMAND",
    "CODEXHOST_STOCK_CODEX_PATH",
    "CODEXHOST_LAUNCHER_PID",
    "CODEXHOST_LAUNCHER_EXECUTABLE",
    "CODEXHOST_RUNTIME_DESCRIPTOR_PATH",
    "CODEXHOST_CONTROL_PORT",
    "CODEXHOST_CONTROL_NONCE",
    "CODEXHOST_NPM_NODE_PATH",
    "CODEXHOST_NPM_CLI_PATH",
    "CODEXHOST_NPM_LAUNCHER_PATH",
    "CODEXHOST_NPM_PACKAGE_ROOT",
    "CODEXHOST_DISABLE_UPDATES",
    "CODEXHOST_REFUSE_RUNNING_DESKTOP",
    "CODEXHOST_CURSOR_COMMAND",
    "CODEXHOST_GROK_COMMAND",
    "CODEXHOST_OMP_COMMAND",
    "CODEXHOST_DEEPSEEK_HARNESS_COMMAND",
    "CODEXHOST_DEEPSEEK_HARNESS_ENDPOINT",
  ]);
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !internal.has(key) || allowed.has(key)),
  );
}

function rpcEnvelope(request: JsonRpcRequest, value: JsonObject): JsonObject {
  return {
    ...(request.jsonrpc === "2.0" ? { jsonrpc: "2.0" } : {}),
    id: request.id,
    ...value,
  };
}

function rpcError(request: JsonRpcRequest, code: number, message: string): JsonObject {
  return rpcEnvelope(request, { error: { code, message } });
}

function unixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function approvalServerName(harnessId: ExternalHarnessId): string {
  switch (harnessId) {
    case "pi":
      return "Pi";
    case "claude-code":
      return "Claude Code";
    case "deepseek-harness":
      return "DeepSeek Harness";
    case "grok":
      return "Grok";
    case "omp":
      return "Oh My Pi";
    case "cursor":
      return "Cursor";
  }
}

const MAX_QUEUED_EXTERNAL_TURN_STARTS = 8;
const HOST_APPROVAL_REQUEST_ID_MIN = -2_000_000;
const HOST_APPROVAL_REQUEST_ID_MAX = -1_000_001;
const HOST_QUESTION_REQUEST_ID_MIN = -1_000_000;
const HOST_QUESTION_REQUEST_ID_MAX = -1;
const EXPLICIT_EXTERNAL_THREAD_METHODS = new Set([
  "thread/archive",
  "thread/delete",
  "thread/fork",
  "thread/inject_items",
  "thread/items/list",
  "thread/metadata/update",
  "thread/name/set",
  "thread/section/move",
  "thread/read",
  "thread/resume",
  "thread/revert",
  "thread/rollback",
  "thread/turns/list",
  "thread/unarchive",
  "thread/unsubscribe",
]);

function isHostApprovalRequestId(value: unknown): value is HostApprovalRequestId {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= HOST_APPROVAL_REQUEST_ID_MIN &&
    value <= HOST_APPROVAL_REQUEST_ID_MAX
  );
}

function isHostQuestionRequestId(value: unknown): value is HostQuestionRequestId {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= HOST_QUESTION_REQUEST_ID_MIN &&
    value <= HOST_QUESTION_REQUEST_ID_MAX
  );
}

export function classifyCreateRequestRoute(
  request: JsonRpcRequest,
  defaultAgent: "codex" | "pi",
): CreateRequestRouteObservation | null {
  const route = decodeCreateRoute(request);
  if (!route) return null;
  if (route.harnessId !== "codex") {
    return {
      requestMethod: "thread/start",
      modelCarrier: `${route.harnessId}-transport`,
      selectedHarness: route.harnessId,
      selectionSource: "transport-model",
    };
  }
  return {
    requestMethod: "thread/start",
    modelCarrier: "official-model",
    selectedHarness: defaultAgent,
    selectionSource: defaultAgent === "pi" ? "default-agent" : "official-model",
  };
}

function requestObject(request: JsonRpcRequest): JsonObject {
  if (!isRecord(request.params)) throw new Error(`${request.method} params must be an object`);
  return request.params as JsonObject;
}

function requestText(params: JsonObject): string {
  if (!Array.isArray(params.input)) throw new Error("turn/start input must be an array");
  const text = params.input
    .filter((item): item is JsonObject => isRecord(item) && item.type === "text")
    .map((item) => item.text)
    .filter((value): value is string => typeof value === "string")
    .join("\n");
  if (!text) throw new Error("turn/start must contain text input");
  return text;
}

function isDetachedSteerClone(request: JsonRpcRequest): boolean {
  return request.id === null;
}

function sandboxResult(params: JsonObject): JsonObject {
  const sandbox = params.sandbox;
  if (sandbox === "read-only") return { type: "readOnly", networkAccess: false };
  if (sandbox === "danger-full-access") return { type: "dangerFullAccess" };
  return {
    type: "workspaceWrite",
    networkAccess: false,
    writableRoots: [],
    excludeTmpdirEnvVar: false,
    excludeSlashTmp: false,
  };
}

function turnProjectionGate(): TurnProjectionGate {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

class OrderedWriter {
  #tail = Promise.resolve();

  constructor(private readonly stream: Writable) {}

  frame(frame: Buffer<ArrayBufferLike>): Promise<void> {
    return this.#enqueue(() => writeFrame(this.stream, frame));
  }

  json(value: JsonValue): Promise<void> {
    return this.#enqueue(() => writeJsonFrame(this.stream, value));
  }

  #enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.#tail.then(operation, operation);
    this.#tail = next.catch(() => undefined);
    return next;
  }
}

export class AppServerHost {
  readonly #options: Required<
    Pick<AppServerHostOptions, "desktopInput" | "desktopOutput" | "diagnosticOutput">
  > &
    AppServerHostOptions;
  #official: OfficialAppServerConnection | null = null;
  #externalAdapters: Map<ExternalHarnessId, HarnessAdapter>;
  #externalRuntime: ExternalThreadRuntime;
  #repository: ExternalThreadRepository;
  #pendingDesktopApprovals = new Map<HostApprovalRequestId, PendingDesktopApproval>();
  #pendingDesktopQuestions = new Map<HostQuestionRequestId, PendingDesktopQuestion>();
  #nextApprovalRequestId = HOST_APPROVAL_REQUEST_ID_MAX;
  #nextQuestionRequestId = HOST_QUESTION_REQUEST_ID_MAX;
  #officialRequestBroker: OfficialRequestBroker;
  #delegationCoordinator: HarnessDelegationCoordinator;
  #unregisterDelegationApi: (() => void) | undefined;
  #activeOfficialTurns = new Map<string, string>();
  #pendingOfficialDelegationThreads = new Set<string>();
  #pendingOfficialTerminalStatuses = new Map<string, DelegationStartResult["status"]>();
  #officialUsageByThread = new Map<string, HostUsage>();
  #officialRateLimitUsage: Partial<HostUsage> | null = null;
  #officialRateLimitRefresh: Promise<void> | null = null;
  #officialRateLimitFreshUntilMs = 0;
  #officialAccountGeneration = 0;
  #routeObservationTracker = new RequestRouteObservationTracker();
  #writer: OrderedWriter;
  #subagentThreadStatuses = new Map<string, "active" | "idle">();
  #runningSubagentsByParent = new Map<string, Set<string>>();
  /** External Threads whose latest finished Turn the Desktop has not viewed.
   * Host-owned because the Desktop's persisted unread atom excludes external
   * Threads; cleared by Desktop-side read/resume, never by the delegation
   * CLI's non-consuming reads. In-memory: a Host restart starts read. */
  #closeRequested = false;
  #workspaceWatch = createThreadWorkspaceWatch((threadId) => {
    void this.#writer.json({
      method: THREAD_WORKSPACE_UPDATED_METHOD,
      params: { threadId },
    });
  });
  #titleOverlayWatch: TitleOverlayWatch;

  constructor(options: AppServerHostOptions) {
    this.#options = {
      desktopInput: process.stdin,
      desktopOutput: process.stdout,
      diagnosticOutput: process.stderr,
      ...options,
    };
    this.#writer = new OrderedWriter(this.#options.desktopOutput);
    this.#officialRequestBroker = new OfficialRequestBroker({
      send: async (request) => {
        const official = this.#official;
        if (!official) throw new Error("official app-server is unavailable");
        await writeJsonFrame(official.stdin, request);
      },
    });
    this.#repository = new ExternalThreadRepository(
      options.mappingStore ??
        createProductionExternalThreadStore(this.#options.environment ?? process.env),
    );
    this.#externalAdapters = new Map(options.externalAdapters);
    for (const [harnessId, adapter] of this.#externalAdapters) {
      if (adapter.harnessId !== harnessId) {
        throw new Error(`External Adapter '${harnessId}' has mismatched Harness ID`);
      }
    }
    this.#externalRuntime = new ExternalThreadRuntime({
      adapters: this.#externalAdapters,
      environment: this.#options.environment ?? process.env,
      repository: this.#repository,
      consumeOutputs: (thread) => this.#consumeHarnessOutputs(thread),
      diagnose: (error) => this.#diagnose(error),
    });
    this.#delegationCoordinator = new HarnessDelegationCoordinator({
      adapters: this.#externalAdapters,
      environment: this.#options.environment ?? process.env,
      externalRuntime: this.#externalRuntime,
      repository: this.#repository,
      registerExternalThread: (input) => this.#registerExternalThread(input),
      startExternalTurn: (thread, text, turnId) =>
        this.#startDelegatedExternalTurn(thread, text, turnId),
      notifyThreadStarted: (thread) => this.#notifyExternalThreadStarted(thread),
      inspectOfficial: (input) => this.#inspectOfficialDelegationTarget(input),
      readOfficial: (input) => this.#readOfficialDelegationThread(input),
      sendOfficial: (input) => this.#sendOfficialDelegationThread(input),
      cancelOfficial: (input) => this.#cancelOfficialDelegationThread(input),
      startOfficial: (input) => this.#startOfficialDelegation(input),
      listOfficial: (input) => this.#listDelegationThreads(input),
      activeOfficialParents: () => [...this.#activeOfficialTurns.keys()],
    });
    const unregisterDelegationApi = options.onDelegationApi?.({
      inspect: (input) => this.#delegationCoordinator.inspect(input),
      start: (input) => this.#delegationCoordinator.start(input),
      send: (input) => this.#delegationCoordinator.send(input),
      cancel: (input) => this.#delegationCoordinator.cancel(input),
      read: (input) => this.#delegationCoordinator.read(input),
      wait: (input) => this.#delegationCoordinator.wait(input),
      list: (input) => this.#delegationCoordinator.list(input),
      rename: (input) => this.#renameDelegationThread(input),
      archive: (input) => this.#archiveDelegationThread(input),
      canHandleStart: (input) => this.#canHandleDelegationStart(input),
      ownsThread: (threadId) => this.#ownsDelegationThread(threadId),
    });
    this.#unregisterDelegationApi =
      typeof unregisterDelegationApi === "function" ? unregisterDelegationApi : undefined;
    this.#titleOverlayWatch = createTitleOverlayWatch({
      directory:
        options.titleOverlayDirectory ??
        defaultTitleOverlayDirectory(this.#options.environment ?? process.env),
      onTitle: (threadId, title) => {
        void this.#applyHostTitleOverlay(threadId, title).catch((error) => {
          this.#diagnose(error);
        });
      },
    });
  }

  close(): void {
    if (this.#closeRequested) return;
    this.#closeRequested = true;
    this.#titleOverlayWatch.dispose();
    this.#workspaceWatch.dispose();
    this.#options.desktopInput.destroy();
    this.#terminateOfficial();
  }

  async run(): Promise<number> {
    try {
      await this.#repository.initialize();
      await this.#titleOverlayWatch.start();
    } catch (error) {
      this.#diagnose(`Mapping Store initialization failed: ${errorMessage(error)}`);
      this.#titleOverlayWatch.dispose();
      return 1;
    }
    let official: OfficialAppServerConnection;
    try {
      official = this.#options.createOfficialConnection
        ? await this.#options.createOfficialConnection()
        : spawnOfficialAppServerConnection({
            stockCodexPath: this.#options.stockCodexPath,
            arguments: this.#options.arguments,
            environment: officialEnvironment(this.#options.environment ?? process.env),
            ...(this.#options.spawnOfficial ? { spawnOfficial: this.#options.spawnOfficial } : {}),
          });
    } catch (error) {
      this.#diagnose(`Official app-server connection failed: ${errorMessage(error)}`);
      await Promise.allSettled(
        [...new Set(this.#externalAdapters.values())].map((adapter) => adapter.close()),
      );
      if (this.#options.closeMappingStoreOnExit !== false) {
        await this.#repository.close().catch((closeError) => this.#diagnose(closeError));
      }
      return 1;
    }
    official.stderr.pipe(this.#options.diagnosticOutput, { end: false });
    this.#official = official;
    const exited = official.closed;
    if (this.#closeRequested) this.#terminateOfficial();
    try {
      await Promise.all([this.#forwardDesktop(), this.#forwardOfficial()]);
      const result = await exited;
      if (result.error) throw result.error;
      if (result.signal) {
        if (this.#closeRequested) return 0;
        throw new Error(`official app-server exited by signal ${result.signal}`);
      }
      return result.code ?? 1;
    } catch (error) {
      if (!this.#closeRequested) this.#diagnose(error);
      this.#terminateOfficial();
      await exited.catch(() => undefined);
      return this.#closeRequested ? 0 : 1;
    } finally {
      const threads = this.#externalRuntime.values();
      await Promise.allSettled(threads.map(({ session }) => session.close()));
      await Promise.allSettled(threads.map(({ outputTask }) => outputTask));
      await Promise.allSettled(
        [...new Set(this.#externalAdapters.values())].map((adapter) => adapter.close()),
      );
      for (const pending of [...this.#pendingDesktopApprovals.values()]) {
        await this.#resolveDesktopApproval(pending.interaction.interactionId).catch(
          () => undefined,
        );
      }
      for (const pending of [...this.#pendingDesktopQuestions.values()]) {
        await this.#resolveDesktopQuestion(pending.interaction.interactionId).catch(
          () => undefined,
        );
      }
      this.#officialRequestBroker.failAll(new Error("codexhost Host Runtime closed"));
      this.#externalRuntime.clear();
      this.#routeObservationTracker.clear();
      this.#unregisterDelegationApi?.();
      this.#unregisterDelegationApi = undefined;
      this.#titleOverlayWatch.dispose();
      if (this.#options.closeMappingStoreOnExit !== false) {
        await this.#repository.close().catch((error) => this.#diagnose(error));
      }
    }
  }

  #terminateOfficial(): void {
    const official = this.#official;
    if (!official) return;
    official.close();
  }

  async #forwardDesktop(): Promise<void> {
    const official = this.#official;
    if (!official) throw new Error("official app-server is unavailable");
    for await (const frame of readLfFrames(this.#options.desktopInput)) {
      const parsed = parseJsonFrame(frame);
      if (await this.#handleDesktopApprovalResponse(parsed)) continue;
      if (await this.#handleDesktopQuestionResponse(parsed)) continue;
      const requestResult = jsonRpcRequestSchema.safeParse(parsed);
      if (!requestResult.success) {
        await writeFrame(official.stdin, frame);
        continue;
      }
      const request = requestResult.data;
      if (
        request.method === "codexhost/update/check" ||
        request.method === "codexhost/update/start" ||
        request.method === "codexhost/update/status"
      ) {
        this.#dispatchDesktopRequest(() => this.#handleUpdateRequest(request));
        continue;
      }
      if (request.method === "codexhost/harness/inspect") {
        this.#dispatchDesktopRequest(() => this.#inspectHarness(request));
        continue;
      }
      if (request.method === "codexhost/thread/fork") {
        await this.#forkExternalThreadFromRenderer(request);
        continue;
      }
      if (request.method === "codexhost/thread/inspect") {
        await this.#inspectThread(request);
        continue;
      }
      if (request.method === "codexhost/thread/usage/inspect") {
        await this.#inspectThreadUsage(request);
        continue;
      }
      if (request.method === "codexhost/thread/workspace/inspect") {
        await this.#inspectThreadWorkspace(request);
        continue;
      }
      if (request.method === "codexhost/workspace/worktree/list") {
        await this.#listWorkspaceWorktrees(request);
        continue;
      }
      if (request.method === "codexhost/workspace/worktree/create") {
        await this.#createWorkspaceWorktree(request);
        continue;
      }
      if (request.method === "codexhost/thread/ownership/list") {
        await this.#listThreadOwnership(request);
        continue;
      }
      if (request.method === "codexhost/thread/model/select") {
        await this.#selectThreadModel(request);
        continue;
      }
      if (request.method === "codexhost/thread/thinking/select") {
        await this.#selectThreadThinking(request);
        continue;
      }
      if (request.method === "codexhost/thread/permission-mode/select") {
        await this.#selectThreadPermissionMode(request);
        continue;
      }
      if (request.method === "codexhost/thread/commands/inspect") {
        await this.#inspectThreadCommands(request);
        continue;
      }
      if (request.method === "codexhost/thread/command/execute") {
        await this.#executeThreadCommand(request);
        continue;
      }
      if (request.method === "codexhost/thread/redo") {
        await this.#redoExternalThread(request);
        continue;
      }
      if (request.method === "thread/list") {
        let listRequest: DecodedThreadListRequest;
        try {
          const decoded = decodeThreadListRequest(request);
          if (!decoded) throw new Error("Expected thread/list request");
          listRequest = decoded;
        } catch (error) {
          await this.#writer.json(rpcError(request, -32602, errorMessage(error)));
          continue;
        }
        if (!listRequest.supportsExternal) {
          await writeFrame(official.stdin, frame);
          continue;
        }
        this.#dispatchDesktopRequest(() => this.#listThreads(request, listRequest));
        continue;
      }
      if (request.method === "thread/archive" || request.method === "thread/unarchive") {
        let threadId: string;
        try {
          const decoded = decodeThreadArchiveRequest(request);
          if (!decoded) throw new Error(`Expected ${request.method} request`);
          threadId = decoded.threadId;
        } catch (error) {
          await this.#writer.json(rpcError(request, -32602, errorMessage(error)));
          continue;
        }
        const location = await this.#locateExternalThread(threadId);
        if (await this.#writeResolutionError(request, location)) continue;
        if (location.kind === "official") {
          await writeFrame(official.stdin, frame);
          continue;
        }
        if (location.kind === "external") {
          await this.#setExternalThreadArchived(
            request,
            location,
            request.method === "thread/archive",
          );
        }
        continue;
      }
      if (request.method === "thread/metadata/update") {
        let decoded;
        try {
          decoded = decodeThreadMetadataUpdateRequest(request);
          if (!decoded) throw new Error("Expected thread/metadata/update request");
        } catch (error) {
          await this.#writer.json(rpcError(request, -32602, errorMessage(error)));
          continue;
        }
        const location = await this.#locateExternalThread(decoded.threadId);
        if (await this.#writeResolutionError(request, location)) continue;
        if (location.kind === "official") {
          await writeFrame(official.stdin, frame);
          continue;
        }
        if (location.kind === "external") {
          await this.#updateExternalThreadMetadata(request, location, decoded);
        }
        continue;
      }
      if (request.method === "thread/section/move") {
        let decoded;
        try {
          decoded = decodeThreadSectionMoveRequest(request);
          if (!decoded) throw new Error("Expected thread/section/move request");
        } catch (error) {
          await this.#writer.json(rpcError(request, -32602, errorMessage(error)));
          continue;
        }
        const location = await this.#locateExternalThread(decoded.threadId);
        if (await this.#writeResolutionError(request, location)) continue;
        if (location.kind === "official") {
          await writeFrame(official.stdin, frame);
          continue;
        }
        if (location.kind === "external") {
          await this.#moveExternalThreadSection(request, location, decoded);
        }
        continue;
      }
      let createRoute: CreateRequestRouteObservation | null;
      try {
        createRoute = classifyCreateRequestRoute(request, this.#options.defaultAgent);
      } catch (error) {
        await this.#writer.json(rpcError(request, -32602, errorMessage(error)));
        continue;
      }
      if (createRoute) {
        this.#options.onCreateRequestRoute?.(createRoute);
        this.#options.onRequestRoute?.(
          this.#routeObservationTracker.registerCreate(
            request.id,
            createRoute,
            classifyThreadPurpose(request),
          ),
        );
      }
      if (createRoute && createRoute.selectedHarness !== "codex") {
        await this.#startExternalThread(request, createRoute.selectedHarness);
        continue;
      }
      if (request.method === "thread/fork") {
        const params = isRecord(request.params) ? request.params : {};
        const resolution =
          typeof params.threadId === "string"
            ? await this.#resolveExternalThread(params.threadId)
            : ({ kind: "official" } as const);
        if (resolution.kind === "error") {
          await this.#writer.json(
            rpcError(request, resolution.error.code, resolution.error.message),
          );
          continue;
        }
        if (resolution.kind === "external") {
          let fork: DecodedThreadForkRequest;
          try {
            const decoded = decodeThreadForkRequest(request);
            if (!decoded) throw new Error("Expected thread/fork request");
            fork = decoded;
          } catch (error) {
            await this.#writer.json(rpcError(request, -32602, errorMessage(error)));
            continue;
          }
          await this.#forkExternalThread(request, resolution.thread, fork);
          continue;
        }
      }
      if (request.method === "thread/revert") {
        const params = isRecord(request.params) ? request.params : {};
        const resolution =
          typeof params.threadId === "string"
            ? await this.#resolveExternalThread(params.threadId)
            : ({ kind: "official" } as const);
        if (resolution.kind === "error") {
          await this.#writer.json(
            rpcError(request, resolution.error.code, resolution.error.message),
          );
          continue;
        }
        if (resolution.kind === "external") {
          let revert: DecodedThreadRevertRequest;
          try {
            const decoded = decodeThreadRevertRequest(request);
            if (!decoded) throw new Error("Expected thread/revert request");
            revert = decoded;
          } catch (error) {
            await this.#writer.json(rpcError(request, -32602, errorMessage(error)));
            continue;
          }
          await this.#revertExternalThread(request, resolution.thread, revert);
          continue;
        }
      }
      if (request.method === "thread/rollback") {
        const params = isRecord(request.params) ? request.params : {};
        const resolution =
          typeof params.threadId === "string"
            ? await this.#resolveExternalThread(params.threadId)
            : ({ kind: "official" } as const);
        if (resolution.kind === "error") {
          await this.#writer.json(
            rpcError(request, resolution.error.code, resolution.error.message),
          );
          continue;
        }
        if (resolution.kind === "external") {
          let rollback: DecodedThreadRollbackRequest;
          try {
            const decoded = decodeThreadRollbackRequest(request);
            if (!decoded) throw new Error("Expected thread/rollback request");
            rollback = decoded;
          } catch (error) {
            await this.#writer.json(rpcError(request, -32602, errorMessage(error)));
            continue;
          }
          await this.#rollbackExternalThread(request, resolution.thread, rollback);
          continue;
        }
      }
      if (request.method === "thread/turns/list" || request.method === "thread/items/list") {
        const params = requestObject(request);
        const resolution =
          typeof params.threadId === "string"
            ? await this.#resolveExternalThread(params.threadId)
            : ({ kind: "official" } as const);
        if (await this.#writeResolutionError(request, resolution)) continue;
        if (resolution.kind === "external") {
          await this.#listExternalHistory(
            request,
            resolution.thread,
            params,
            resolution.historyFresh,
          );
          continue;
        }
      }
      if (request.method === "thread/inject_items") {
        const params = requestObject(request);
        const location =
          typeof params.threadId === "string"
            ? await this.#locateExternalThread(params.threadId)
            : ({ kind: "official" } as const);
        if (await this.#writeResolutionError(request, location)) continue;
        if (location.kind === "external") {
          await this.#injectExternalThreadItems(request, params);
          continue;
        }
      }
      if (request.method === "turn/start") {
        const params = requestObject(request);
        const threadId = params.threadId;
        const resolution =
          typeof threadId === "string"
            ? await this.#resolveExternalThread(threadId)
            : ({ kind: "official" } as const);
        if (typeof threadId === "string") {
          this.#options.onRequestRoute?.(
            this.#routeObservationTracker.observeTurn(
              threadId,
              resolution.kind === "external" ? resolution.thread.harnessId : "codex",
            ),
          );
        }
        if (await this.#writeResolutionError(request, resolution)) continue;
        if (resolution.kind === "external") {
          await this.#startExternalTurn(request, resolution.thread);
          continue;
        }
      }
      if (request.method === "turn/interrupt") {
        const params = requestObject(request);
        const resolution =
          typeof params.threadId === "string"
            ? await this.#resolveExternalThread(params.threadId)
            : ({ kind: "official" } as const);
        if (await this.#writeResolutionError(request, resolution)) continue;
        if (resolution.kind === "external") {
          await this.#interruptExternalTurn(request, resolution.thread, params.turnId);
          continue;
        }
      }
      if (request.method === "turn/steer") {
        const params = requestObject(request);
        const resolution =
          typeof params.threadId === "string"
            ? await this.#resolveExternalThread(params.threadId)
            : ({ kind: "official" } as const);
        if (await this.#writeResolutionError(request, resolution)) continue;
        if (resolution.kind === "external") {
          await this.#steerExternalTurn(request, resolution.thread, params);
          continue;
        }
      }
      if (
        request.method.startsWith("turn/") &&
        request.method !== "turn/start" &&
        request.method !== "turn/interrupt" &&
        isRecord(request.params) &&
        typeof request.params.threadId === "string"
      ) {
        // Codex Desktop's Steer control sends turn/steer while a Turn runs.
        // External Threads must answer explicitly instead of leaking the
        // request to the official app-server, which does not know them.
        const location = await this.#locateExternalThread(request.params.threadId);
        if (await this.#writeResolutionError(request, location)) continue;
        if (location.kind === "external") {
          await this.#writer.json(
            rpcError(request, -32076, `External Thread does not support ${request.method}`),
          );
          continue;
        }
      }
      if (request.method === "thread/read") {
        const params = requestObject(request);
        const location =
          typeof params.threadId === "string"
            ? await this.#locateExternalThread(params.threadId)
            : ({ kind: "official" } as const);
        if (location.kind === "error") {
          await this.#writer.json(rpcError(request, location.error.code, location.error.message));
          continue;
        }
        if (location.kind === "official") {
          await writeFrame(official.stdin, frame);
          continue;
        }
        if (params.includeTurns !== true) {
          await this.#readExternalThreadMetadata(request, location);
          continue;
        }
        if (location.record.historyMode === "paginated") {
          await this.#writer.json(
            rpcError(request, -32602, "Paginated External Threads require thread/turns/list"),
          );
          continue;
        }
      }
      if (request.method === "thread/read" || request.method === "thread/resume") {
        const params = requestObject(request);
        const resolution =
          typeof params.threadId === "string"
            ? await this.#resolveExternalThread(params.threadId)
            : ({ kind: "official" } as const);
        if (await this.#writeResolutionError(request, resolution)) continue;
        if (resolution.kind === "external") {
          if (request.method === "thread/read") {
            await this.#readExternalThread(
              request,
              resolution.thread,
              params.includeTurns === true,
              resolution.historyFresh,
            );
          } else {
            await this.#resumeExternalThread(
              request,
              resolution.thread,
              params,
              resolution.historyFresh,
            );
          }
          continue;
        }
      }
      if (request.method === "thread/unsubscribe") {
        const params = requestObject(request);
        if (typeof params.threadId === "string") {
          const location = await this.#locateExternalThread(params.threadId);
          if (await this.#writeResolutionError(request, location)) continue;
          if (location.kind === "official") {
            await writeFrame(official.stdin, frame);
            continue;
          }
          if (location.kind === "external") {
            await this.#writer.json(
              rpcEnvelope(request, {
                result: { status: location.thread ? "notSubscribed" : "notLoaded" },
              }),
            );
            continue;
          }
        }
      }
      if (request.method === "thread/name/set" || request.method === "thread/delete") {
        const params = requestObject(request);
        const location =
          typeof params.threadId === "string"
            ? await this.#locateExternalThread(params.threadId)
            : ({ kind: "official" } as const);
        if (await this.#writeResolutionError(request, location)) continue;
        if (location.kind === "external") {
          if (request.method === "thread/name/set") {
            await this.#setExternalThreadName(request, location, params.name);
          } else {
            await this.#deleteExternalThread(request, location);
          }
          continue;
        }
      }
      if (
        request.method.startsWith("thread/") &&
        !EXPLICIT_EXTERNAL_THREAD_METHODS.has(request.method) &&
        isRecord(request.params) &&
        typeof request.params.threadId === "string"
      ) {
        const location = await this.#locateExternalThread(request.params.threadId);
        if (await this.#writeResolutionError(request, location)) continue;
        if (location.kind === "external") {
          await this.#writer.json(
            rpcError(request, -32076, `External Thread does not support ${request.method}`),
          );
          continue;
        }
      }
      await writeFrame(official.stdin, frame);
    }
    official.stdin.end();
  }

  async #forwardOfficial(): Promise<void> {
    const official = this.#official;
    if (!official) throw new Error("official app-server is unavailable");
    try {
      for await (const frame of readLfFrames(official.stdout)) {
        const parsed = parseJsonFrame(frame);
        if (isRecord(parsed) && parsed.method === "account/updated")
          this.#resetOfficialUsageState();
        if (this.#officialRequestBroker.handle(parsed)) continue;
        const tokenUsage = observeCodexTokenUsage(parsed);
        if (tokenUsage) {
          const previous = this.#officialUsageByThread.get(tokenUsage.threadId);
          try {
            this.#officialUsageByThread.set(
              tokenUsage.threadId,
              parseHostUsage({ ...(previous ?? {}), ...tokenUsage.usage }),
            );
          } catch {
            // Ignore an invalid native observation while preserving the official frame.
          }
        }
        const rateLimits = observeCodexRateLimits(parsed);
        if (rateLimits) this.#mergeOfficialRateLimits(rateLimits, "push");
        try {
          await this.#observeOfficialTurnLifecycle(parsed);
        } catch (error) {
          this.#diagnose(error);
        }
        this.#routeObservationTracker.bindOfficialResponse(parsed);
        await this.#writer.frame(frame);
      }
    } finally {
      this.#officialRequestBroker.failAll(new Error("official app-server output closed"));
    }
  }

  async #observeOfficialTurnLifecycle(value: JsonValue): Promise<void> {
    if (!isRecord(value) || !isRecord(value.params)) return;
    const params = value.params;
    if (value.method === "turn/started" && typeof params.threadId === "string") {
      const turn = isRecord(params.turn) ? params.turn : null;
      if (turn && typeof turn.id === "string")
        this.#activeOfficialTurns.set(params.threadId, turn.id);
    }
    if (value.method === "turn/completed" && typeof params.threadId === "string") {
      this.#activeOfficialTurns.delete(params.threadId);
      const delegation = await this.#repository.getDelegationByChild(
        hostThreadIdSchema.parse(params.threadId),
      );
      const turn = isRecord(params.turn) ? params.turn : null;
      const status =
        turn?.status === "failed"
          ? "failed"
          : turn?.status === "interrupted" || turn?.status === "cancelled"
            ? "interrupted"
            : "completed";
      if (this.#pendingOfficialDelegationThreads.has(params.threadId)) {
        this.#pendingOfficialTerminalStatuses.set(params.threadId, status);
      }
      if (delegation) {
        await this.#repository.setDelegationStatus(delegation.delegationId, status);
      }
    }
  }

  async #canHandleDelegationStart(input: DelegationStartInput): Promise<boolean> {
    if (input.parentThreadId) return this.#ownsDelegationThread(input.parentThreadId);
    const externalActive = this.#externalRuntime.values().some((thread) => thread.running);
    return externalActive || this.#activeOfficialTurns.size > 0;
  }

  async #ownsDelegationThread(threadId: string): Promise<boolean> {
    if (
      this.#externalRuntime.get(threadId) !== undefined ||
      this.#activeOfficialTurns.has(threadId)
    ) {
      return true;
    }
    const parsed = hostThreadIdSchema.safeParse(threadId);
    if (!parsed.success) return false;
    const [thread, childDelegation, delegation] = await Promise.all([
      this.#repository.find(parsed.data),
      this.#repository.getDelegationByChild(parsed.data),
      this.#repository.getDelegation(parsed.data),
    ]);
    return thread !== null || childDelegation !== null || delegation !== null;
  }

  async #inspectOfficialDelegationTarget(
    input: HarnessInspectInput,
  ): Promise<HarnessInspectResult> {
    const response = await this.#officialRequestBroker.request("model/list", {});
    if (isRecord(response.error)) {
      throw new DelegationControlError(
        "DELEGATION_FAILED",
        typeof response.error.message === "string"
          ? response.error.message
          : "Official Model catalog could not be read",
      );
    }
    const result = isRecord(response.result) ? response.result : null;
    const data = result && Array.isArray(result.data) ? result.data : [];
    const thinkingById = new Map<ReturnType<typeof harnessThinkingOptionIdSchema.parse>, string>();
    const models = data.flatMap((candidate) => {
      if (!isRecord(candidate) || typeof candidate.model !== "string" || !candidate.model.trim()) {
        return [];
      }
      const supportedThinkingOptionIds = Array.isArray(candidate.supportedReasoningEfforts)
        ? candidate.supportedReasoningEfforts.flatMap((option) => {
            if (
              !isRecord(option) ||
              typeof option.reasoningEffort !== "string" ||
              !option.reasoningEffort.trim()
            ) {
              return [];
            }
            const id = harnessThinkingOptionIdSchema.safeParse(option.reasoningEffort);
            if (!id.success) return [];
            thinkingById.set(
              id.data,
              typeof option.description === "string" && option.description.trim()
                ? option.description
                : option.reasoningEffort,
            );
            return [id.data];
          })
        : [];
      return [
        {
          ref: harnessModelRefSchema.parse({ id: candidate.model }),
          label:
            typeof candidate.displayName === "string" && candidate.displayName.trim()
              ? candidate.displayName
              : candidate.model,
          ...(supportedThinkingOptionIds.length > 0 ? { supportedThinkingOptionIds } : {}),
        },
      ];
    });
    const defaultEntry = data.find(
      (candidate) => isRecord(candidate) && candidate.isDefault === true,
    );
    const defaultModel =
      isRecord(defaultEntry) && typeof defaultEntry.model === "string"
        ? harnessModelRefSchema.parse({ id: defaultEntry.model })
        : undefined;
    return {
      harnessId: input.harnessId,
      inspection: {
        status: "ready",
        catalog: {
          models,
          ...(defaultModel ? { defaultModel } : {}),
          thinkingOptions: [...thinkingById].map(([id, label]) => ({ id, label })),
        },
        capabilities: {
          configuration: {
            selectModel: models.length > 0,
            selectThinkingOption: thinkingById.size > 0,
            selectPermissionMode: false,
          },
          history: { fork: true, forkAcrossCwd: true, rollbackLastTurn: true },
        },
      },
    };
  }

  async #startOfficialDelegation(
    input: DelegationStartInput & { parentThreadId: string },
  ): Promise<DelegationStartResult> {
    const digest = createHash("sha256")
      .update(
        JSON.stringify({
          task: input.task,
          cwd: input.cwd,
          modelId: input.model?.id ?? null,
          thinkingOptionId: input.thinkingOptionId ?? null,
        }),
      )
      .digest("hex");
    const existing = input.requestId
      ? await this.#repository.findDelegationByRequest(input.requestId)
      : await this.#repository.findRecentDelegation({
          parentHostThreadId: hostThreadIdSchema.parse(input.parentThreadId),
          targetHarnessId: harnessIdSchema.parse("codex"),
          taskDigest: digest,
          since: new Date(Date.now() - 30_000),
        });
    if (
      existing &&
      input.requestId &&
      (existing.targetHarnessId !== "codex" || existing.taskDigest !== digest)
    ) {
      throw new DelegationControlError(
        "INVALID_ARGUMENT",
        "Request ID is already associated with another Delegation configuration",
      );
    }
    if (existing) {
      const turnId = this.#activeOfficialTurns.get(existing.childHostThreadId) ?? "pending";
      return {
        delegationId: existing.delegationId,
        threadId: existing.childHostThreadId,
        turnId,
        harnessId: "codex",
        deepLink: `codex://threads/${existing.childHostThreadId}`,
        status: existing.status,
        next: {
          read: `codexhost thread read ${existing.childHostThreadId}`,
          wait: `codexhost thread wait ${existing.childHostThreadId} --timeout-ms 30000`,
        },
      };
    }
    if (input.model || input.thinkingOptionId) {
      const inspected = await this.#inspectOfficialDelegationTarget({
        harnessId: "codex",
        cwd: input.cwd,
      });
      if (inspected.inspection.status !== "ready") {
        throw new DelegationControlError(
          "DELEGATION_FAILED",
          "Official Model catalog is unavailable",
        );
      }
      if (
        input.model &&
        !inspected.inspection.catalog.models.some(
          (candidate) => candidate.ref.id === input.model?.id,
        )
      ) {
        throw new DelegationControlError("INVALID_ARGUMENT", "Official Model is unavailable", {
          validModelIds: inspected.inspection.catalog.models.map((candidate) => candidate.ref.id),
        });
      }
      if (input.thinkingOptionId) {
        const selectedModel = input.model ?? inspected.inspection.catalog.defaultModel;
        const selectedEntry = selectedModel
          ? inspected.inspection.catalog.models.find(
              (candidate) => candidate.ref.id === selectedModel.id,
            )
          : undefined;
        const validThinkingOptionIds = selectedEntry?.supportedThinkingOptionIds ?? [];
        if (!validThinkingOptionIds.includes(input.thinkingOptionId)) {
          throw new DelegationControlError(
            "INVALID_ARGUMENT",
            "Official Thinking option is unavailable for the selected Model",
            { validThinkingOptionIds },
          );
        }
      }
    }
    const started = await this.#officialRequestBroker.request("thread/start", {
      cwd: input.cwd,
      ...(input.model ? { model: input.model.id } : {}),
      ephemeral: false,
      historyMode: "paginated",
    });
    const startedResult = isRecord(started.result) ? started.result : null;
    const thread = startedResult && isRecord(startedResult.thread) ? startedResult.thread : null;
    const threadId = thread && typeof thread.id === "string" ? thread.id : null;
    if (!threadId) throw new Error("Official thread/start returned no Thread identity");
    this.#pendingOfficialDelegationThreads.add(threadId);
    let turnId: string;
    try {
      const turn = await this.#officialRequestBroker.request("turn/start", {
        threadId,
        input: [{ type: "text", text: input.task }],
        ...(input.model ? { model: input.model.id } : {}),
        ...(input.thinkingOptionId ? { effort: input.thinkingOptionId } : {}),
      });
      const turnResult = isRecord(turn.result) ? turn.result : null;
      const turnValue = turnResult && isRecord(turnResult.turn) ? turnResult.turn : null;
      const parsedTurnId = turnValue && typeof turnValue.id === "string" ? turnValue.id : null;
      if (!parsedTurnId) throw new Error("Official turn/start returned no Turn identity");
      turnId = parsedTurnId;
    } catch (error) {
      this.#pendingOfficialDelegationThreads.delete(threadId);
      this.#pendingOfficialTerminalStatuses.delete(threadId);
      await this.#officialRequestBroker
        .request("thread/delete", { threadId })
        .catch(() => undefined);
      throw error;
    }
    this.#activeOfficialTurns.set(threadId, turnId);
    const delegationId = hostThreadIdSchema.parse(randomUUID());
    try {
      const source = await this.#repository.find(input.parentThreadId);
      const pendingTerminal = this.#pendingOfficialTerminalStatuses.get(threadId);
      await this.#repository.createDelegation({
        delegationId,
        parentHostThreadId: hostThreadIdSchema.parse(input.parentThreadId),
        childHostThreadId: hostThreadIdSchema.parse(threadId),
        sourceHarnessId: source?.harnessId ?? harnessIdSchema.parse("codex"),
        targetHarnessId: harnessIdSchema.parse("codex"),
        status: pendingTerminal ?? "running",
        ...(input.requestId ? { requestId: input.requestId } : {}),
        taskDigest: digest,
      });
      return {
        delegationId,
        threadId,
        turnId,
        harnessId: "codex",
        deepLink: `codex://threads/${threadId}`,
        status: pendingTerminal ?? "running",
        ...(input.model || input.thinkingOptionId
          ? {
              configuration: {
                requested: {
                  ...(input.model ? { model: input.model } : {}),
                  ...(input.thinkingOptionId ? { thinkingOptionId: input.thinkingOptionId } : {}),
                },
                effective: {
                  ...(startedResult && typeof startedResult.model === "string"
                    ? { effectiveModel: harnessModelRefSchema.parse({ id: startedResult.model }) }
                    : {}),
                },
              },
            }
          : {}),
        next: {
          read: `codexhost thread read ${threadId}`,
          wait: `codexhost thread wait ${threadId} --timeout-ms 30000`,
        },
      };
    } catch (error) {
      this.#activeOfficialTurns.delete(threadId);
      await this.#officialRequestBroker
        .request("thread/delete", { threadId })
        .catch(() => undefined);
      throw error;
    } finally {
      this.#pendingOfficialDelegationThreads.delete(threadId);
      this.#pendingOfficialTerminalStatuses.delete(threadId);
    }
  }

  async #sendOfficialDelegationThread(input: ThreadSendInput): Promise<ThreadSendResult> {
    if (!input.message?.trim()) {
      throw new DelegationControlError("INVALID_ARGUMENT", "Message must not be empty");
    }
    const activeTurnId = this.#activeOfficialTurns.get(input.threadId);
    if (activeTurnId !== undefined) {
      if (input.steer === true) return this.#steerOfficialDelegationThread(input, activeTurnId);
      throw new DelegationControlError("THREAD_BUSY", "Thread already has an active Turn");
    }
    const current = await this.#officialRequestBroker.request("thread/read", {
      threadId: input.threadId,
      includeTurns: true,
    });
    if (isRecord(current.error) || !isRecord(current.result)) {
      throw new DelegationControlError("THREAD_NOT_FOUND", "Official Thread was not found");
    }
    const currentThread = isRecord(current.result.thread) ? current.result.thread : null;
    const currentTurns =
      currentThread && Array.isArray(currentThread.turns) ? currentThread.turns : [];
    const latestTurn = currentTurns.at(-1);
    if (
      (currentThread && isRecord(currentThread.status) && currentThread.status.type === "active") ||
      (isRecord(latestTurn) &&
        (latestTurn.status === "inProgress" || latestTurn.status === "running"))
    ) {
      if (input.steer === true) {
        const latestTurnId =
          isRecord(latestTurn) && typeof latestTurn.id === "string" ? latestTurn.id : null;
        if (latestTurnId) return this.#steerOfficialDelegationThread(input, latestTurnId);
      }
      throw new DelegationControlError("THREAD_BUSY", "Thread already has an active Turn");
    }
    const response = await this.#officialRequestBroker.request("turn/start", {
      threadId: input.threadId,
      input: [{ type: "text", text: input.message }],
    });
    if (isRecord(response.error)) {
      throw new DelegationControlError(
        "DELEGATION_FAILED",
        typeof response.error.message === "string" ? response.error.message : "Turn start failed",
      );
    }
    const result = isRecord(response.result) ? response.result : null;
    const turn = result && isRecord(result.turn) ? result.turn : null;
    const turnId = turn && typeof turn.id === "string" ? turn.id : null;
    if (!turnId) throw new Error("Official turn/start returned no Turn identity");
    this.#activeOfficialTurns.set(input.threadId, turnId);
    return {
      threadId: input.threadId,
      turnId,
      harnessId: "codex",
      status: "running",
      next: {
        read: `codexhost thread read ${input.threadId}`,
        wait: `codexhost thread wait ${input.threadId} --timeout-ms 30000`,
      },
    };
  }

  /** Official Codex steers through the same `turn/steer` Desktop's composer uses. */
  async #steerOfficialDelegationThread(
    input: ThreadSendInput,
    turnId: string,
  ): Promise<ThreadSendResult> {
    const response = await this.#officialRequestBroker.request("turn/steer", {
      threadId: input.threadId,
      input: [{ type: "text", text: input.message }],
    });
    if (isRecord(response.error)) {
      throw new DelegationControlError(
        "DELEGATION_FAILED",
        typeof response.error.message === "string" ? response.error.message : "Turn steer failed",
      );
    }
    return {
      threadId: input.threadId,
      turnId,
      harnessId: "codex",
      status: "running",
      next: {
        read: `codexhost thread read ${input.threadId}`,
        wait: `codexhost thread wait ${input.threadId} --timeout-ms 30000`,
      },
    };
  }

  async #cancelOfficialDelegationThread(input: ThreadCancelInput): Promise<ThreadCancelResult> {
    let turnId = this.#activeOfficialTurns.get(input.threadId);
    if (!turnId) {
      const current = await this.#officialRequestBroker.request("thread/read", {
        threadId: input.threadId,
        includeTurns: true,
      });
      if (isRecord(current.error) || !isRecord(current.result)) {
        throw new DelegationControlError("THREAD_NOT_FOUND", "Official Thread was not found");
      }
      const currentThread = isRecord(current.result.thread) ? current.result.thread : null;
      const currentTurns =
        currentThread && Array.isArray(currentThread.turns) ? currentThread.turns : [];
      const latestTurn = currentTurns.at(-1);
      if (
        isRecord(latestTurn) &&
        typeof latestTurn.id === "string" &&
        (latestTurn.status === "inProgress" || latestTurn.status === "running")
      ) {
        turnId = latestTurn.id;
        this.#activeOfficialTurns.set(input.threadId, turnId);
      } else {
        return { threadId: input.threadId, turnId: null, harnessId: "codex", cancelled: false };
      }
    }
    const response = await this.#officialRequestBroker.request("turn/interrupt", {
      threadId: input.threadId,
      turnId,
    });
    if (isRecord(response.error)) {
      throw new DelegationControlError(
        "DELEGATION_FAILED",
        typeof response.error.message === "string" ? response.error.message : "Turn cancel failed",
      );
    }
    return { threadId: input.threadId, turnId, harnessId: "codex", cancelled: true };
  }

  async #readOfficialDelegationThread(input: ThreadReadInput): Promise<DelegationThreadSnapshot> {
    const response = await this.#officialRequestBroker.request("thread/read", {
      threadId: input.threadId,
      includeTurns: true,
    });
    if (isRecord(response.error)) {
      throw new DelegationControlError(
        "THREAD_NOT_FOUND",
        typeof response.error.message === "string"
          ? response.error.message
          : "Official Thread was not found",
      );
    }
    const result = isRecord(response.result) ? response.result : null;
    const thread = result && isRecord(result.thread) ? result.thread : null;
    if (!thread)
      throw new DelegationControlError("THREAD_NOT_FOUND", "Official Thread was not found");
    const turns = Array.isArray(thread.turns)
      ? thread.turns.filter((turn): turn is JsonObject => isRecord(turn))
      : [];
    const running =
      this.#activeOfficialTurns.has(input.threadId) ||
      (isRecord(thread.status) && thread.status.type === "active");
    const snapshot = projectDelegationThreadSnapshot({
      threadId: input.threadId,
      harnessId: "codex",
      thread,
      turns,
      running,
      view: input.view,
      ...(input.cursor ? { cursor: input.cursor } : {}),
      ...(input.limit !== undefined ? { limit: input.limit } : {}),
    });
    const delegation = await this.#repository.getDelegationByChild(
      hostThreadIdSchema.parse(input.threadId),
    );
    if (delegation && delegation.status !== snapshot.status) {
      await this.#repository.setDelegationStatus(delegation.delegationId, snapshot.status);
    }
    return snapshot;
  }

  async #listDelegationThreads(input: ThreadListInput): Promise<DelegationThreadListResult> {
    const [sortKey, sortDirection] = input.sort.split("-") as [string, "asc" | "desc"];
    const request: JsonRpcRequest = {
      id: `codexhost:delegation-list:${randomUUID()}`,
      method: "thread/list",
      params: {
        cwd: input.cwd ? [input.cwd] : null,
        limit: input.limit,
        cursor: input.cursor ?? null,
        archived: input.archived ?? false,
        sortKey: `${sortKey}_at`,
        sortDirection,
      },
    };
    const decoded = decodeThreadListRequest(request);
    if (!decoded) throw new Error("Delegation thread/list request could not be decoded");
    const records = await this.#repository.list();
    const result = await aggregateThreadList({
      query: decoded,
      records,
      runtimeFor: (threadId) => {
        const thread = this.#externalRuntime.get(threadId);
        return thread ? { running: thread.running } : null;
      },
      requestOfficialPage: async (params) =>
        officialThreadListPageFromResponse(
          await this.#officialRequestBroker.request("thread/list", params),
        ),
    });
    return {
      threads: result.data.flatMap((entry) => {
        if (typeof entry.id !== "string") return [];
        const record = records.find((candidate) => candidate.hostThreadId === entry.id);
        const status = record
          ? this.#delegationListStatus(entry.id, entry.status)
          : isRecord(entry.status) && entry.status.type === "active"
            ? "running"
            : "completed";
        const attention = record ? this.#delegationListAttention(entry.id) : undefined;
        return [
          {
            threadId: entry.id,
            harnessId: record ? (record.harnessId as ExternalHarnessId) : "codex",
            deepLink: `codex://threads/${record ? navigationHostThreadId(record) : entry.id}`,
            status,
            // Only external Threads carry Host-owned unread; official rows
            // keep the Desktop's own unread authority and omit the field.
            // A record written before external unread was persisted has no
            // value to report — omit it there too, so a consumer can tell
            // "the Host says read" from "the Host has no record" and fall
            // back to the Desktop's own unread instead of assuming read.
            ...(record && typeof record.unread === "boolean"
              ? { hasUnreadTurn: record.unread }
              : {}),
            // Host-persisted archive state; a Desktop archive removes the row
            // from the live listing, and only this field tells a consumer why.
            // Native rows keep the Desktop's archive authority and omit it.
            ...(record ? { archived: record.archived } : {}),
            // A Turn blocked on a Desktop question or approval is
            // caller-visible attention; consumers surface it instead of a
            // plain "running". Questions map to input; approvals stay
            // approval. A pending question wins when both exist.
            ...(attention ? { attention } : {}),
            ...(typeof entry.cwd === "string" ? { cwd: entry.cwd } : {}),
            ...(typeof entry.name === "string"
              ? { title: entry.name }
              : typeof entry.preview === "string"
                ? { title: entry.preview }
                : {}),
          },
        ];
      }),
      nextCursor: result.nextCursor,
    };
  }

  async #listThreads(
    request: JsonRpcRequest,
    listRequest: DecodedThreadListRequest,
  ): Promise<void> {
    try {
      const records = await this.#repository.list();
      const result = await aggregateThreadList({
        query: listRequest,
        records,
        runtimeFor: (threadId) => {
          const thread = this.#externalRuntime.get(threadId);
          return thread ? { running: thread.running } : null;
        },
        requestOfficialPage: async (params) =>
          officialThreadListPageFromResponse(
            await this.#officialRequestBroker.request("thread/list", params),
          ),
      });
      await this.#writer.json(rpcEnvelope(request, { result }));
    } catch (error) {
      if (error instanceof OfficialThreadListError) {
        await this.#writer.json(rpcEnvelope(request, { error: error.rpcError }));
        return;
      }
      await this.#writer.json(rpcError(request, -32082, "Thread list aggregation failed"));
      this.#diagnose(error);
    }
  }

  async #setExternalThreadArchived(
    request: JsonRpcRequest,
    location: Extract<ExternalThreadLocation, { kind: "external" }>,
    archived: boolean,
  ): Promise<void> {
    const applied = await this.#applyExternalArchiveState(location, archived);
    if (!applied.ok) {
      await this.#writer.json(rpcError(request, applied.code, applied.message));
      return;
    }
    await this.#writer.json(
      rpcEnvelope(request, { result: archived ? {} : { thread: applied.projected } }),
    );
    await this.#notifyExternalArchiveState(applied.record.hostThreadId, archived);
    await this.#cascadeSideChatArchiveState(applied.record.hostThreadId, archived);
  }

  /**
   * Desktop nests side chats inside their source Thread and hides them from
   * every listing, so archiving the source is the only archive gesture a
   * user can make for them. Persist the same state on every side chat under
   * the root, nested ones included, refreshing loaded projections. No Desktop
   * frame is emitted for them: they are not sidebar rows, and the root's own
   * thread/archived already carries the gesture.
   */
  async #cascadeSideChatArchiveState(rootThreadId: string, archived: boolean): Promise<void> {
    let records: StoredThreadRecordV1[];
    try {
      records = await this.#repository.list();
    } catch (error) {
      this.#diagnose(error);
      return;
    }
    const childrenBySource = new Map<string, StoredThreadRecordV1[]>();
    for (const record of records) {
      if (!isEphemeralDerivedThread(record) || !record.forkSource) continue;
      const siblings = childrenBySource.get(record.forkSource.hostThreadId) ?? [];
      siblings.push(record);
      childrenBySource.set(record.forkSource.hostThreadId, siblings);
    }
    const queue = [rootThreadId];
    const visited = new Set<string>([rootThreadId]);
    while (queue.length > 0) {
      const sourceId = queue.shift() as string;
      for (const child of childrenBySource.get(sourceId) ?? []) {
        if (visited.has(child.hostThreadId)) continue;
        visited.add(child.hostThreadId);
        queue.push(child.hostThreadId);
        if (child.archived === archived) continue;
        const loaded = this.#externalRuntime.get(child.hostThreadId) ?? null;
        const applied = await this.#applyExternalArchiveState(
          { kind: "external", record: loaded?.record ?? child, thread: loaded },
          archived,
        );
        if (!applied.ok) {
          this.#diagnose(`Side chat archive state could not be persisted: ${applied.message}`);
        }
      }
    }
  }

  /**
   * Persists one external Thread's archive state and refreshes the loaded
   * projection. Shared by the Desktop `thread/archive` request path and the
   * delegation CLI, so both leave the record, the loaded Thread and the
   * Desktop notification in the same shape; only the reply envelope differs.
   */
  async #applyExternalArchiveState(
    location: Extract<ExternalThreadLocation, { kind: "external" }>,
    archived: boolean,
  ): Promise<
    | { ok: true; record: StoredThreadRecordV1; projected: ReturnType<typeof externalThreadValue> }
    | { ok: false; code: number; message: string }
  > {
    if (location.record.state !== "ready" || !location.record.nativeSessionRef) {
      return { ok: false, code: -32079, message: "External Native Session is unavailable" };
    }
    const sessionId =
      location.thread?.sessionId ??
      (await this.#repository.sessionTreeId(location.record).catch(() => null));
    if (!sessionId) {
      return {
        ok: false,
        code: -32081,
        message: "External Thread metadata could not be projected",
      };
    }
    let record: StoredThreadRecordV1;
    try {
      record = await this.#repository.setArchived(location.record.hostThreadId, archived);
    } catch {
      return {
        ok: false,
        code: -32081,
        message: "External Thread archive state could not be persisted",
      };
    }
    const projected = externalThreadValue({
      record,
      turns: [],
      sessionId,
      ...(location.thread ? { running: location.thread.running } : { loaded: false }),
    });
    if (location.thread) {
      location.thread.record = record;
      location.thread.thread = {
        ...location.thread.thread,
        ...projected,
        turns: location.thread.thread.turns ?? [],
      };
    }
    return { ok: true, record, projected };
  }

  #notifyExternalArchiveState(threadId: string, archived: boolean): Promise<void> {
    return this.#writer.json({
      method: archived ? "thread/archived" : "thread/unarchived",
      params: { threadId },
    });
  }

  async #handleUpdateRequest(request: JsonRpcRequest): Promise<void> {
    const params = updateEmptyParamsSchema.safeParse(
      request.params === undefined ? {} : request.params,
    );
    if (!params.success) {
      await this.#writer.json(rpcError(request, -32602, "Update params must be empty"));
      return;
    }
    const coordinator = this.#options.updateCoordinator;
    if (!coordinator) {
      await this.#writer.json(rpcError(request, -32090, "Application updates are unavailable"));
      return;
    }
    try {
      if (request.method === "codexhost/update/check") {
        const result = updateCheckResultSchema.parse(await coordinator.check());
        await this.#writer.json(rpcEnvelope(request, { result: jsonValueSchema.parse(result) }));
        return;
      }
      if (request.method === "codexhost/update/status") {
        const result = updateStatusResultSchema.parse(await coordinator.status());
        await this.#writer.json(rpcEnvelope(request, { result: jsonValueSchema.parse(result) }));
        return;
      }
      const result = updateStartResultSchema.parse(await coordinator.start());
      await this.#writer.json(rpcEnvelope(request, { result: jsonValueSchema.parse(result) }));
    } catch (error) {
      await this.#writer.json(rpcError(request, -32091, errorMessage(error).slice(0, 500)));
    }
  }

  async #inspectHarness(request: JsonRpcRequest): Promise<void> {
    const params = harnessInspectParamsSchema.safeParse(request.params);
    if (!params.success) {
      await this.#writer.json(rpcError(request, -32602, "Invalid Harness inspection params"));
      return;
    }
    const registered = [...this.#externalAdapters].find(
      ([harnessId]) => harnessId === params.data.harnessId,
    );
    const adapter = registered?.[1];
    if (!adapter) {
      await this.#writer.json(
        rpcError(request, -32077, `Harness '${params.data.harnessId}' is unavailable`),
      );
      return;
    }
    let inspection: unknown;
    try {
      inspection = await adapter.inspect({
        ...(params.data.cwd ? { cwd: params.data.cwd } : {}),
        ...(params.data.refresh !== undefined ? { refresh: params.data.refresh } : {}),
      });
    } catch (error) {
      await this.#writer.json(
        rpcError(request, -32077, `Harness inspection failed: ${errorMessage(error)}`),
      );
      return;
    }
    const validated = harnessInspectionSchema.safeParse(inspection);
    if (!validated.success) {
      await this.#writer.json(
        rpcError(request, -32077, "Harness inspection returned an invalid result"),
      );
      return;
    }
    await this.#writer.json(
      rpcEnvelope(request, { result: jsonValueSchema.parse(validated.data) }),
    );
  }

  async #inspectThread(request: JsonRpcRequest): Promise<void> {
    const params = threadInspectionParamsSchema.safeParse(request.params);
    if (!params.success) {
      await this.#writer.json(rpcError(request, -32602, "Invalid Thread inspection params"));
      return;
    }
    const resolution = await this.#resolveExternalThread(params.data.threadId);
    if (resolution.kind === "error") {
      await this.#writer.json(rpcError(request, resolution.error.code, resolution.error.message));
      return;
    }
    const inspection = threadInspectionSchema.parse(
      resolution.kind === "official"
        ? { owner: "codex", locked: true }
        : {
            owner: "external",
            harnessId: resolution.thread.harnessId,
            transportModelId: resolution.thread.transportModelId,
            ...(resolution.thread.stateObserver.state.effectiveModel
              ? { effectiveModel: resolution.thread.stateObserver.state.effectiveModel }
              : {}),
            ...(resolution.thread.stateObserver.state.resolvedModelLabel
              ? { resolvedModelLabel: resolution.thread.stateObserver.state.resolvedModelLabel }
              : {}),
            ...(resolution.thread.stateObserver.state.effectiveThinkingOptionId
              ? {
                  effectiveThinkingOptionId:
                    resolution.thread.stateObserver.state.effectiveThinkingOptionId,
                }
              : {}),
            ...(resolution.thread.stateObserver.state.availableThinkingOptions
              ? {
                  availableThinkingOptions:
                    resolution.thread.stateObserver.state.availableThinkingOptions,
                }
              : {}),
            ...(resolution.thread.stateObserver.state.effectivePermissionModeId
              ? {
                  effectivePermissionModeId:
                    resolution.thread.stateObserver.state.effectivePermissionModeId,
                }
              : {}),
            history: resolution.thread.session.capabilities.history,
            ...(resolution.thread.record.historyRedo ? { historyRedoAvailable: true } : {}),
            rollback: externalRollbackCapabilities(resolution.thread),
            ...(resolution.thread.latestUsage ? { usage: resolution.thread.latestUsage } : {}),
            locked: true,
          },
    );
    await this.#writer.json(rpcEnvelope(request, { result: jsonValueSchema.parse(inspection) }));
  }

  async #inspectThreadUsage(request: JsonRpcRequest): Promise<void> {
    const params = threadUsageInspectionParamsSchema.safeParse(request.params);
    if (!params.success) {
      await this.#writer.json(rpcError(request, -32602, "Invalid Thread Usage inspection params"));
      return;
    }
    const resolution = await this.#resolveExternalThread(params.data.threadId);
    if (resolution.kind === "error") {
      await this.#writer.json(rpcError(request, resolution.error.code, resolution.error.message));
      return;
    }
    if (resolution.kind === "official") {
      if (params.data.refresh !== undefined) {
        await this.#writer.json(
          rpcError(request, -32602, "Exact Usage refresh is only available for External Threads"),
        );
        return;
      }
      // A native Codex thread may have no token-usage observation yet, but its
      // account quota is still useful to the Credits pill. Start a refresh for
      // that case without blocking the first inspection; subsequent renderer
      // retries will observe the populated snapshot. When token usage already
      // exists, await the refresh so Usage and Credits arrive together.
      const rateLimitRefresh = this.#refreshOfficialRateLimits();
      if (this.#officialUsageByThread.has(params.data.threadId)) {
        await rateLimitRefresh;
      }
      const accountCredits = projectCodexRateLimitsToCredits(this.#officialRateLimitUsage);
      const result = threadUsageInspectionSchema.parse({
        threadId: params.data.threadId,
        usage: this.#combinedOfficialUsage(this.#officialUsageByThread.get(params.data.threadId)),
        ...(accountCredits ? { accountCredits } : {}),
      });
      await this.#writer.json(rpcEnvelope(request, { result: jsonValueSchema.parse(result) }));
      return;
    }
    if (params.data.refresh === "exact") void resolution.thread.session.refreshUsage?.();
    const adapter = this.#externalAdapters.get(resolution.thread.harnessId);
    if (adapter && isCreditsAdapter(adapter)) void adapter.refreshCredits?.();
    const credits =
      adapter && isCreditsAdapter(adapter) ? projectAccountCredits(adapter.credits()) : null;
    const result = threadUsageInspectionSchema.parse({
      threadId: params.data.threadId,
      usage: resolution.thread.latestUsage,
      ...(credits ? { accountCredits: credits } : {}),
    });
    await this.#writer.json(rpcEnvelope(request, { result: jsonValueSchema.parse(result) }));
  }

  async #inspectThreadWorkspace(request: JsonRpcRequest): Promise<void> {
    const params = threadWorkspaceInspectParamsSchema.safeParse(request.params);
    if (!params.success) {
      await this.#writer.json(
        rpcError(request, -32602, "Invalid Thread workspace inspection params"),
      );
      return;
    }
    const location = await this.#externalRuntime.locate(params.data.threadId);
    if (location.kind === "error") {
      await this.#writer.json(rpcError(request, location.error.code, location.error.message));
      return;
    }
    let cwd: string | null = null;
    const extraRoots: string[] = [];
    const collectExtraRoots = (thread: Record<string, unknown> | null): void => {
      if (!thread || !Array.isArray(thread.runtimeWorkspaceRoots)) return;
      for (const root of thread.runtimeWorkspaceRoots) {
        if (typeof root === "string" && root.trim().length > 0 && root !== cwd)
          extraRoots.push(root);
      }
    };
    if (location.kind === "external") {
      cwd = location.record.cwd;
      collectExtraRoots(isRecord(location.thread?.thread) ? location.thread.thread : null);
    } else {
      try {
        const response = await this.#officialRequestBroker.request("thread/read", {
          threadId: params.data.threadId,
          includeTurns: false,
        });
        if (!isRecord(response.error) && isRecord(response.result)) {
          const thread = isRecord(response.result.thread) ? response.result.thread : null;
          if (thread && typeof thread.cwd === "string" && thread.cwd.trim().length > 0) {
            cwd = thread.cwd;
          }
          collectExtraRoots(thread);
        }
      } catch {
        cwd = null;
      }
    }
    const inspection = cwd
      ? await inspectGitWorkspace(cwd, extraRoots, params.data.extraPaths ?? [])
      : { cwd: "", repositories: [], watchPaths: [] };
    if (cwd) this.#workspaceWatch.track(params.data.threadId, inspection);
    const result = threadWorkspaceSnapshotSchema.parse({
      threadId: params.data.threadId,
      cwd,
      repositories: inspection.repositories,
    });
    await this.#writer.json(rpcEnvelope(request, { result: jsonValueSchema.parse(result) }));
  }

  /**
   * Worktree list/create are Host-owned Git operations on a project root the
   * Renderer already knows; they never touch a Thread, so no locate step.
   */
  async #listWorkspaceWorktrees(request: JsonRpcRequest): Promise<void> {
    const params = workspaceWorktreeListParamsSchema.safeParse(request.params);
    if (!params.success) {
      await this.#writer.json(rpcError(request, -32602, "Invalid worktree list params"));
      return;
    }
    try {
      const result = workspaceWorktreeListResultSchema.parse(
        await listWorkspaceWorktrees(params.data.projectRoot),
      );
      await this.#writer.json(rpcEnvelope(request, { result: jsonValueSchema.parse(result) }));
    } catch (error) {
      const code = error instanceof WorkspaceWorktreeError ? error.code : -32603;
      await this.#writer.json(rpcError(request, code, errorMessage(error)));
    }
  }

  async #createWorkspaceWorktree(request: JsonRpcRequest): Promise<void> {
    const params = workspaceWorktreeCreateParamsSchema.safeParse(request.params);
    if (!params.success) {
      await this.#writer.json(rpcError(request, -32602, "Invalid worktree create params"));
      return;
    }
    try {
      const result = workspaceWorktreeCreateResultSchema.parse(
        await createWorkspaceWorktree(params.data),
      );
      await this.#writer.json(rpcEnvelope(request, { result: jsonValueSchema.parse(result) }));
    } catch (error) {
      const code = error instanceof WorkspaceWorktreeError ? error.code : -32603;
      await this.#writer.json(rpcError(request, code, errorMessage(error)));
    }
  }

  /**
   * Native Codex reports account quota the same two ways the Claude Code
   * Adapter does, and arbitrates them the same way: the on-demand
   * `account/rateLimits/read` pull is authoritative, while a notification push
   * may only fill an empty snapshot or expire the cached one. Letting both
   * write freely made the credits pill flip between readings taken at
   * different moments. See `ClaudeCodeAdapter#recordPlanLimit`.
   */
  #mergeOfficialRateLimits(rateLimits: Partial<HostUsage>, source: "push" | "pull"): void {
    if (source === "push" && this.#officialRateLimitUsage) {
      this.#officialRateLimitFreshUntilMs = 0;
      return;
    }
    try {
      this.#officialRateLimitUsage = parseHostUsage({
        ...(this.#officialRateLimitUsage ?? {}),
        ...rateLimits,
      });
      this.#officialRateLimitFreshUntilMs =
        source === "pull" ? Date.now() + OFFICIAL_RATE_LIMIT_TTL_MS : 0;
    } catch {
      // Ignore a malformed sparse update while preserving the last valid snapshot.
    }
  }

  #resetOfficialUsageState(): void {
    // Native Codex can change accounts without restarting the app-server. Do
    // not carry the previous account's thread or quota snapshot into the next
    // account's Usage popover.
    this.#officialAccountGeneration += 1;
    this.#officialUsageByThread.clear();
    this.#officialRateLimitUsage = null;
    this.#officialRateLimitFreshUntilMs = 0;
  }

  #combinedOfficialUsage(usage: HostUsage | undefined): HostUsage | null {
    const combined = { ...(usage ?? {}), ...(this.#officialRateLimitUsage ?? {}) };
    if (Object.keys(combined).length === 0) return null;
    try {
      return parseHostUsage(combined);
    } catch {
      return usage ?? this.#officialRateLimitUsage;
    }
  }

  async #refreshOfficialRateLimits(): Promise<void> {
    // Serve the cached snapshot only while it is still fresh. This used to
    // return on any non-null snapshot, which made the refresh a permanent
    // no-op after the first success: the pill then froze at that first reading
    // for the rest of the process, and only a push could ever move it again.
    if (this.#officialRateLimitUsage && Date.now() < this.#officialRateLimitFreshUntilMs) return;
    if (this.#officialRateLimitRefresh) return this.#officialRateLimitRefresh;
    const accountGeneration = this.#officialAccountGeneration;
    this.#officialRateLimitRefresh = this.#officialRequestBroker
      .request("account/rateLimits/read", {})
      .then((response) => {
        if (accountGeneration !== this.#officialAccountGeneration) return;
        const rateLimits = observeCodexRateLimits(response);
        if (rateLimits) this.#mergeOfficialRateLimits(rateLimits, "pull");
      })
      .catch(() => undefined)
      .finally(() => {
        this.#officialRateLimitRefresh = null;
      });
    return this.#officialRateLimitRefresh;
  }

  async #listThreadOwnership(request: JsonRpcRequest): Promise<void> {
    const params = threadOwnershipListParamsSchema.safeParse(request.params);
    if (!params.success) {
      await this.#writer.json(rpcError(request, -32602, "Invalid Thread ownership-list params"));
      return;
    }
    try {
      const threads = await Promise.all(
        params.data.threadIds.map(async (threadId) => {
          const record = await this.#repository.find(threadId);
          return record
            ? { threadId, owner: "external" as const, harnessId: record.harnessId }
            : { threadId, owner: "codex" as const };
        }),
      );
      const result = threadOwnershipListResultSchema.parse({ threads });
      await this.#writer.json(rpcEnvelope(request, { result: jsonValueSchema.parse(result) }));
    } catch {
      await this.#writer.json(
        rpcError(request, -32081, "Thread ownership metadata could not be read"),
      );
    }
  }

  async #inspectThreadCommands(request: JsonRpcRequest): Promise<void> {
    const params = threadCommandsInspectParamsSchema.safeParse(request.params);
    if (!params.success) {
      await this.#writer.json(
        rpcError(request, -32602, "Invalid Thread command inspection params"),
      );
      return;
    }
    const resolution = await this.#resolveExternalThread(params.data.threadId);
    if (await this.#writeResolutionError(request, resolution)) return;
    if (resolution.kind !== "external" || !resolution.thread.session.commands) {
      await this.#writer.json(rpcEnvelope(request, { result: { commands: [] } }));
      return;
    }
    const result = await resolution.thread.session.commands.list();
    if (!result.ok) {
      await this.#writer.json(rpcError(request, -32078, result.error.message));
      return;
    }
    try {
      await this.#writer.json(
        rpcEnvelope(request, {
          result: jsonValueSchema.parse(harnessCommandCatalogSchema.parse(result.value)),
        }),
      );
    } catch (error) {
      await this.#writer.json(
        rpcError(request, -32078, `Harness command catalog is invalid: ${errorMessage(error)}`),
      );
    }
  }

  async #executeThreadCommand(request: JsonRpcRequest): Promise<void> {
    const params = threadCommandExecuteParamsSchema.safeParse(request.params);
    if (!params.success) {
      await this.#writer.json(rpcError(request, -32602, "Invalid Thread command parameters"));
      return;
    }
    const resolution = await this.#resolveExternalThread(params.data.threadId);
    if (await this.#writeResolutionError(request, resolution)) return;
    if (resolution.kind !== "external") {
      await this.#writer.json(rpcError(request, -32078, "Thread is not externally owned"));
      return;
    }
    const thread = resolution.thread;
    if (thread.running) {
      await this.#writer.json(
        rpcError(request, -32072, "External Thread already has an active operation"),
      );
      return;
    }
    const commands = thread.session.commands;
    if (!commands) {
      await this.#writer.json(
        rpcError(request, -32078, "External Harness does not expose commands"),
      );
      return;
    }
    const catalog = await commands.list();
    if (!catalog.ok) {
      await this.#writer.json(rpcError(request, -32078, catalog.error.message));
      return;
    }
    if (!catalog.value.commands.some(({ id }) => id === params.data.commandId)) {
      await this.#writer.json(
        rpcError(
          request,
          -32078,
          `External Harness does not expose command '${params.data.commandId}'`,
        ),
      );
      return;
    }

    try {
      await this.#startExternalCommand(
        request,
        thread,
        params.data.commandId,
        params.data.arguments,
        params.data.turnId,
        "command",
      );
    } catch (error) {
      this.#diagnose(error);
      await this.#writer.json(
        rpcError(request, -32073, `External Harness command failed: ${errorMessage(error)}`),
      );
    }
  }

  async #startExternalCommand(
    request: JsonRpcRequest,
    thread: ExternalThread,
    commandId: string,
    arguments_: JsonObject | undefined,
    requestedTurnId: HostTurnId | undefined,
    responseKind: "command" | "turn",
  ): Promise<void> {
    const commands = thread.session.commands;
    if (!commands) {
      await this.#writer.json(
        rpcError(request, -32078, "External Harness does not expose commands"),
      );
      return;
    }
    if (thread.running) {
      await this.#writer.json(
        rpcError(request, -32072, "External Thread already has an active operation"),
      );
      return;
    }
    const turnId = requestedTurnId ?? hostTurnIdSchema.parse(randomUUID());
    const projection: ProjectedTurn = {
      projector: new CodexTurnProjector({
        threadId: thread.id,
        turnId,
        cwd: thread.cwd,
        startedAtMs: Date.now(),
      }),
    };
    const gate = turnProjectionGate();
    thread.running = true;
    thread.activeTurnId = turnId;
    thread.projectedTurns.set(turnId, projection);
    thread.responseGates.set(turnId, gate);
    thread.ephemeralTurnIds.add(turnId);

    let result: Awaited<ReturnType<NonNullable<HarnessSession["commands"]>["execute"]>>;
    try {
      result = await commands.execute({
        turnId,
        commandId,
        ...(arguments_ ? { arguments: arguments_ } : {}),
      });
    } catch (error) {
      thread.running = false;
      thread.activeTurnId = null;
      thread.projectedTurns.delete(turnId);
      thread.responseGates.delete(turnId);
      thread.ephemeralTurnIds.delete(turnId);
      gate.resolve();
      throw error;
    }
    if (!result.ok) {
      thread.running = false;
      thread.activeTurnId = null;
      thread.projectedTurns.delete(turnId);
      thread.responseGates.delete(turnId);
      thread.ephemeralTurnIds.delete(turnId);
      gate.resolve();
      await this.#writer.json(rpcError(request, -32073, result.error.message));
      return;
    }
    try {
      const response =
        responseKind === "command"
          ? jsonValueSchema.parse(
              threadCommandExecuteResultSchema.parse({
                accepted: true,
                turnId: result.value.turnId,
              }),
            )
          : { turn: projection.projector.pendingTurn() };
      await this.#writer.json(rpcEnvelope(request, { result: response as JsonObject }));
    } finally {
      gate.resolve();
    }
  }

  async #selectThreadModel(request: JsonRpcRequest): Promise<void> {
    const params = threadModelSelectParamsSchema.safeParse(request.params);
    if (!params.success) {
      await this.#writer.json(rpcError(request, -32602, "Invalid Thread Model selection params"));
      return;
    }
    const resolution = await this.#resolveExternalThread(params.data.threadId);
    if (resolution.kind === "error") {
      await this.#writer.json(rpcError(request, resolution.error.code, resolution.error.message));
      return;
    }
    const thread = resolution.kind === "external" ? resolution.thread : undefined;
    if (!thread) {
      await this.#writer.json(
        rpcError(request, -32078, "Model selection requires a current-process external Thread"),
      );
      return;
    }
    if (!thread.session.capabilities.configuration.selectModel) {
      await this.#writer.json(
        rpcError(request, -32078, "External Harness does not support Model selection"),
      );
      return;
    }
    const beforeRevision = thread.stateObserver.revision;
    const result = await thread.session.execute({
      type: "model.select",
      model: params.data.model,
    });
    if (!result.ok) {
      await this.#writer.json(rpcError(request, -32078, result.error.message));
      return;
    }
    try {
      const state = await thread.stateObserver.waitForChange(beforeRevision);
      const projected = harnessModelSelectionStateSchema.parse({
        ...(state.effectiveModel ? { effectiveModel: state.effectiveModel } : {}),
        ...(state.resolvedModelLabel ? { resolvedModelLabel: state.resolvedModelLabel } : {}),
        ...(state.effectiveThinkingOptionId
          ? { effectiveThinkingOptionId: state.effectiveThinkingOptionId }
          : {}),
        ...(state.availableThinkingOptions
          ? { availableThinkingOptions: state.availableThinkingOptions }
          : {}),
        ...(state.effectivePermissionModeId
          ? { effectivePermissionModeId: state.effectivePermissionModeId }
          : {}),
      });
      if (!projected.effectiveModel) {
        throw new Error("Harness Session did not report an effective Model");
      }
      await this.#writer.json(rpcEnvelope(request, { result: jsonValueSchema.parse(projected) }));
    } catch (error) {
      await this.#writer.json(
        rpcError(request, -32078, `Model state was not confirmed: ${errorMessage(error)}`),
      );
    }
  }

  async #selectThreadThinking(request: JsonRpcRequest): Promise<void> {
    const params = threadThinkingSelectParamsSchema.safeParse(request.params);
    if (!params.success) {
      await this.#writer.json(
        rpcError(request, -32602, "Invalid Thread Thinking selection params"),
      );
      return;
    }
    const resolution = await this.#resolveExternalThread(params.data.threadId);
    if (resolution.kind === "error") {
      await this.#writer.json(rpcError(request, resolution.error.code, resolution.error.message));
      return;
    }
    const thread = resolution.kind === "external" ? resolution.thread : undefined;
    if (!thread) {
      await this.#writer.json(
        rpcError(request, -32078, "Thinking selection requires a current-process external Thread"),
      );
      return;
    }
    if (!thread.session.capabilities.configuration.selectThinkingOption) {
      await this.#writer.json(
        rpcError(request, -32078, "External Harness does not support Thinking selection"),
      );
      return;
    }
    const beforeRevision = thread.stateObserver.revision;
    const result = await thread.session.execute({
      type: "thinking.select",
      thinkingOptionId: params.data.thinkingOptionId,
    });
    if (!result.ok) {
      await this.#writer.json(rpcError(request, -32078, result.error.message));
      return;
    }
    try {
      const state = await thread.stateObserver.waitForChange(beforeRevision);
      const projected = harnessModelSelectionStateSchema.parse({
        ...(state.effectiveModel ? { effectiveModel: state.effectiveModel } : {}),
        ...(state.resolvedModelLabel ? { resolvedModelLabel: state.resolvedModelLabel } : {}),
        ...(state.effectiveThinkingOptionId
          ? { effectiveThinkingOptionId: state.effectiveThinkingOptionId }
          : {}),
        ...(state.availableThinkingOptions
          ? { availableThinkingOptions: state.availableThinkingOptions }
          : {}),
        ...(state.effectivePermissionModeId
          ? { effectivePermissionModeId: state.effectivePermissionModeId }
          : {}),
      });
      if (!projected.effectiveThinkingOptionId) {
        throw new Error("Harness Session did not report effective Thinking");
      }
      thread.requestedThinkingOptionId = projected.effectiveThinkingOptionId;
      const previousSelection = decodeExternalTransportSelection(
        thread.harnessId,
        thread.transportModelId,
      );
      const effectiveModel =
        projected.effectiveModel ?? thread.requestedModel ?? previousSelection?.model;
      if (effectiveModel) {
        const transportModelId = encodeExternalTransportSelection(thread.harnessId, {
          ...(previousSelection ?? {}),
          model: effectiveModel,
          thinkingOptionId: projected.effectiveThinkingOptionId,
        });
        thread.transportModelId = transportModelId;
        thread.requestedModel = effectiveModel;
        try {
          thread.record = await this.#repository.setTransportModelId(
            thread.record.hostThreadId,
            transportModelId,
          );
        } catch (error) {
          this.#diagnose(error);
        }
        thread.thread = externalThreadValue({
          record: { ...thread.record, transportModelId },
          turns: thread.turns,
          sessionId: thread.sessionId,
          running: thread.running,
        });
      }
      await this.#writer.json(rpcEnvelope(request, { result: jsonValueSchema.parse(projected) }));
    } catch (error) {
      await this.#writer.json(
        rpcError(request, -32078, `Thinking state was not confirmed: ${errorMessage(error)}`),
      );
    }
  }

  async #selectThreadPermissionMode(request: JsonRpcRequest): Promise<void> {
    const params = threadPermissionModeSelectParamsSchema.safeParse(request.params);
    if (!params.success) {
      await this.#writer.json(
        rpcError(request, -32602, "Invalid Thread Permission Mode selection params"),
      );
      return;
    }
    const resolution = await this.#resolveExternalThread(params.data.threadId);
    if (resolution.kind === "error") {
      await this.#writer.json(rpcError(request, resolution.error.code, resolution.error.message));
      return;
    }
    const thread = resolution.kind === "external" ? resolution.thread : undefined;
    if (!thread) {
      await this.#writer.json(
        rpcError(
          request,
          -32078,
          "Permission Mode selection requires a current-process external Thread",
        ),
      );
      return;
    }
    if (!thread.session.capabilities.configuration.selectPermissionMode) {
      await this.#writer.json(
        rpcError(request, -32078, "External Harness does not support Permission Mode selection"),
      );
      return;
    }
    const beforeRevision = thread.stateObserver.revision;
    const result = await thread.session.execute({
      type: "permissionMode.select",
      permissionModeId: params.data.permissionModeId,
    });
    if (!result.ok) {
      await this.#writer.json(rpcError(request, -32078, result.error.message));
      return;
    }
    try {
      const state = await thread.stateObserver.waitForChange(beforeRevision);
      const projected = harnessConfigurationStateSchema.parse({
        ...(state.effectiveModel ? { effectiveModel: state.effectiveModel } : {}),
        ...(state.resolvedModelLabel ? { resolvedModelLabel: state.resolvedModelLabel } : {}),
        ...(state.effectiveThinkingOptionId
          ? { effectiveThinkingOptionId: state.effectiveThinkingOptionId }
          : {}),
        ...(state.availableThinkingOptions
          ? { availableThinkingOptions: state.availableThinkingOptions }
          : {}),
        ...(state.effectivePermissionModeId
          ? { effectivePermissionModeId: state.effectivePermissionModeId }
          : {}),
      });
      if (!projected.effectivePermissionModeId) {
        throw new Error("Harness Session did not report its current Permission Mode");
      }
      thread.requestedPermissionModeId = projected.effectivePermissionModeId;
      const previousSelection = decodeExternalTransportSelection(
        thread.harnessId,
        thread.transportModelId,
      );
      const effectiveModel =
        projected.effectiveModel ?? thread.requestedModel ?? previousSelection?.model;
      if (effectiveModel) {
        const transportModelId = encodeExternalTransportSelection(thread.harnessId, {
          ...(previousSelection ?? {}),
          model: effectiveModel,
          permissionModeId: projected.effectivePermissionModeId,
        });
        thread.transportModelId = transportModelId;
        thread.requestedModel = effectiveModel;
        try {
          thread.record = await this.#repository.setTransportModelId(
            thread.record.hostThreadId,
            transportModelId,
          );
        } catch (error) {
          this.#diagnose(error);
        }
        thread.thread = externalThreadValue({
          record: { ...thread.record, transportModelId },
          turns: thread.turns,
          sessionId: thread.sessionId,
          running: thread.running,
        });
      }
      await this.#writer.json(rpcEnvelope(request, { result: jsonValueSchema.parse(projected) }));
    } catch (error) {
      await this.#writer.json(
        rpcError(
          request,
          -32078,
          `Permission Mode state was not confirmed: ${errorMessage(error)}`,
        ),
      );
    }
  }

  async #startExternalThread(request: JsonRpcRequest, harnessId: ExternalHarnessId): Promise<void> {
    const adapter = this.#externalAdapters.get(harnessId);
    if (!adapter) {
      this.#routeObservationTracker.rejectCreate(request.id);
      await this.#writer.json(
        rpcError(request, -32070, `External Harness '${harnessId}' is unavailable`),
      );
      return;
    }
    const params = requestObject(request);
    const route = decodeCreateRoute(request);
    const requestedModel = route && route.harnessId !== "codex" ? route.model : undefined;
    const requestedThinkingOptionId =
      route && route.harnessId !== "codex" ? route.thinkingOptionId : undefined;
    const requestedPermissionModeId =
      route && route.harnessId !== "codex" ? route.permissionModeId : undefined;
    const transportModelId =
      route && route.harnessId === harnessId
        ? route.transportModelId
        : transportModelIdForHarness(harnessId);
    const cwd = params.cwd;
    if (typeof cwd !== "string" || cwd.length === 0) {
      this.#routeObservationTracker.rejectCreate(request.id);
      await this.#writer.json(
        rpcError(request, -32602, `External Harness '${harnessId}' thread/start requires cwd`),
      );
      return;
    }

    const recordInput = createExternalThreadRecordInput({
      harnessId: adapter.harnessId,
      cwd,
      transportModelId,
      ephemeral: params.ephemeral === true,
      historyMode: params.historyMode === "paginated" ? "paginated" : "legacy",
    });
    let record: StoredThreadRecordV1;
    try {
      record = await this.#repository.createProvisional(recordInput);
    } catch {
      this.#routeObservationTracker.rejectCreate(request.id);
      await this.#writer.json(rpcError(request, -32081, "External Thread could not be persisted"));
      return;
    }

    // A Desktop-level bypass (approval policy "never" plus danger-full-access
    // Sandbox) follows into the created Harness Session as unattended full
    // access, unless the caller explicitly selected a Permission Mode. The
    // Adapter stays the authority: one that does not support the policy
    // rejects it as "unsupported" and creation falls back to its native
    // default instead of failing the Thread.
    const followDesktopBypass =
      !requestedPermissionModeId &&
      (typeof params.approvalPolicy === "string" ? params.approvalPolicy : "never") === "never" &&
      params.sandbox === "danger-full-access";
    const openSession = (executionPolicy: "default" | "unattended-full-access") =>
      adapter.open({
        kind: "create",
        cwd,
        environment: {
          ...(this.#options.environment ?? process.env),
          [DELEGATION_THREAD_ID_ENV]: record.hostThreadId,
        },
        executionPolicy,
        ...(requestedModel ? { model: requestedModel } : {}),
        ...(requestedThinkingOptionId ? { thinkingOptionId: requestedThinkingOptionId } : {}),
        ...(requestedPermissionModeId ? { permissionModeId: requestedPermissionModeId } : {}),
      });
    let sessionResult = await openSession(
      followDesktopBypass ? "unattended-full-access" : "default",
    );
    if (!sessionResult.ok && followDesktopBypass && sessionResult.error.code === "unsupported") {
      sessionResult = await openSession("default");
    }
    if (!sessionResult.ok) {
      this.#routeObservationTracker.rejectCreate(request.id);
      await this.#repository.removeProvisional(record.hostThreadId).catch(() => undefined);
      const mapped = mapExternalThreadHarnessError(sessionResult.error, "create");
      await this.#writer.json(rpcError(request, mapped.code, mapped.message));
      return;
    }
    const session = sessionResult.value;
    try {
      if (session.initialState.nativeRef) {
        record = await this.#repository.commitNative(
          record.hostThreadId,
          session.initialState.nativeRef,
        );
      }
      const thread = externalThreadValue({
        record,
        turns: [],
        sessionId: record.hostThreadId,
      });
      const externalThread = this.#registerExternalThread({
        record,
        session,
        sessionId: record.hostThreadId,
        thread,
        turns: [],
        ...(requestedModel ? { requestedModel } : {}),
        ...(requestedThinkingOptionId ? { requestedThinkingOptionId } : {}),
        ...(requestedPermissionModeId ? { requestedPermissionModeId } : {}),
      });
      this.#routeObservationTracker.bindCreatedThread(request.id, externalThread.id);
      await this.#writer.json(
        rpcEnvelope(request, {
          result: {
            thread,
            model: transportModelId,
            modelProvider: "codexhost",
            cwd,
            approvalPolicy:
              typeof params.approvalPolicy === "string" ? params.approvalPolicy : "never",
            approvalsReviewer: "user",
            sandbox: sandboxResult(params),
            reasoningEffort: "medium",
            serviceTier: "flex",
            multiAgentMode: "explicitRequestOnly",
            activePermissionProfile: null,
            runtimeWorkspaceRoots: Array.isArray(params.runtimeWorkspaceRoots)
              ? params.runtimeWorkspaceRoots
              : [],
            instructionSources: [],
          },
        }),
      );
      await this.#writer.json({
        method: "thread/started",
        emittedAtMs: Date.now(),
        params: { thread },
      });
    } catch {
      this.#externalRuntime.remove(record.hostThreadId);
      this.#routeObservationTracker.forgetThread(record.hostThreadId);
      await session.close().catch(() => undefined);
      await this.#repository.removeProvisional(record.hostThreadId).catch(() => undefined);
      await this.#writer.json(rpcError(request, -32081, "External Thread could not be persisted"));
    }
  }

  #registerExternalThread(input: {
    record: StoredThreadRecordV1;
    session: HarnessSession;
    sessionId: string;
    thread: JsonObject;
    turns: JsonObject[];
    requestedModel?: HarnessModelRef;
    requestedThinkingOptionId?: HarnessThinkingOptionId;
    requestedPermissionModeId?: HarnessPermissionModeId;
  }): ExternalThread {
    return this.#externalRuntime.register(input);
  }

  #locateExternalThread(threadId: string): Promise<ExternalThreadLocation> {
    return this.#externalRuntime.locate(threadId);
  }

  #resolveExternalThread(threadId: string): Promise<ExternalThreadResolution> {
    return this.#externalRuntime.resolve(threadId);
  }

  async #writeResolutionError(
    request: JsonRpcRequest,
    resolution: ExternalThreadLocation | ExternalThreadResolution,
  ): Promise<boolean> {
    if (resolution.kind !== "error") return false;
    await this.#writer.json(rpcError(request, resolution.error.code, resolution.error.message));
    return true;
  }

  #refreshExternalThread(thread: ExternalThread): Promise<ExternalThreadRpcError | null> {
    return this.#externalRuntime.refresh(thread);
  }

  #persistTerminalIdentity(
    thread: ExternalThread,
    event: Parameters<ExternalThreadRuntime["persistTerminalIdentity"]>[1],
  ): Promise<Error | null> {
    return this.#externalRuntime.persistTerminalIdentity(thread, event);
  }

  async #forkExternalThreadFromRenderer(request: JsonRpcRequest): Promise<void> {
    const parsed = externalThreadForkParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      await this.#writer.json(rpcError(request, -32602, "External Fork request is invalid"));
      return;
    }
    const resolution = await this.#resolveExternalThread(parsed.data.threadId);
    if (await this.#writeResolutionError(request, resolution)) return;
    if (resolution.kind !== "external") {
      await this.#writer.json(rpcError(request, -32078, "Thread is not externally owned"));
      return;
    }
    const result = await executeExternalThreadFork({
      source: resolution.thread,
      fork: {
        threadId: parsed.data.threadId,
        lastTurnId: parsed.data.lastTurnId,
        excludeTurns: true,
      },
      adapters: this.#externalAdapters,
      repository: this.#repository,
      runtime: this.#externalRuntime,
      environment: this.#options.environment ?? process.env,
    });
    if (!result.ok) {
      await this.#writer.json(rpcError(request, result.error.code, result.error.message));
      return;
    }
    await this.#writer.json(
      rpcEnvelope(request, {
        result: externalThreadForkResultSchema.parse({ threadId: result.derived.id }),
      }),
    );
    await this.#notifyExternalThreadStarted(result.thread);
  }

  async #forkExternalThread(
    request: JsonRpcRequest,
    source: ExternalThread,
    fork: DecodedThreadForkRequest,
  ): Promise<void> {
    const result = await executeExternalThreadFork({
      source,
      fork,
      adapters: this.#externalAdapters,
      repository: this.#repository,
      runtime: this.#externalRuntime,
      environment: this.#options.environment ?? process.env,
    });
    if (!result.ok) {
      await this.#writer.json(rpcError(request, result.error.code, result.error.message));
      return;
    }
    const params: JsonObject = {
      ...(fork.sandbox ? { sandbox: fork.sandbox } : {}),
    };
    await this.#writer.json(
      rpcEnvelope(request, {
        result: threadForkResult(result.responseThread, {
          model: result.derived.transportModelId,
          cwd: result.derived.cwd,
          ...(fork.runtimeWorkspaceRoots
            ? { runtimeWorkspaceRoots: fork.runtimeWorkspaceRoots }
            : {}),
          ...(fork.approvalPolicy ? { approvalPolicy: fork.approvalPolicy } : {}),
          sandbox: sandboxResult(params),
          ...(fork.serviceTier ? { serviceTier: fork.serviceTier } : {}),
        }),
      }),
    );
    await this.#notifyExternalThreadStarted(result.thread);
  }

  async #injectExternalThreadItems(request: JsonRpcRequest, params: JsonObject): Promise<void> {
    if (!Array.isArray(params.items)) {
      await this.#writer.json(
        rpcError(request, -32602, "thread/inject_items params.items must be an array"),
      );
      return;
    }
    // Codex Desktop injects side-conversation boundary items immediately after
    // a side-chat thread/fork. An External Fork's derived Native Session
    // already carries the full parent context, and injected Codex items have
    // no native representation, so the injection is acknowledged without a
    // history projection.
    await this.#writer.json(rpcEnvelope(request, { result: {} }));
  }

  async #notifyExternalThreadStarted(thread: JsonObject): Promise<void> {
    await this.#writer.json({
      method: "thread/started",
      emittedAtMs: Date.now(),
      params: { thread: { ...thread, turns: [] } },
    });
  }

  async #revertExternalThread(
    request: JsonRpcRequest,
    thread: ExternalThread,
    revert: DecodedThreadRevertRequest,
  ): Promise<void> {
    if (thread.record.historyMode !== "paginated") {
      await this.#writer.json(
        rpcError(request, -32602, "External thread/revert requires paginated history"),
      );
      return;
    }
    const result = await executeExternalThreadRollback({
      derived: thread,
      rollback: { threadId: revert.threadId, numTurns: 1 },
      expectedLastTurnId: revert.beforeTurnId,
      adapters: this.#externalAdapters,
      repository: this.#repository,
      runtime: this.#externalRuntime,
      environment: this.#options.environment ?? process.env,
    });
    if (!result.ok) {
      await this.#writer.json(rpcError(request, result.error.code, result.error.message));
      return;
    }
    await this.#writer.json(rpcEnvelope(request, { result: threadRevertResult(result.thread) }));
    await this.#writer.json({ method: "thread/reverted", params: { threadId: thread.id } });
  }

  async #redoExternalThread(request: JsonRpcRequest): Promise<void> {
    let threadId: string;
    try {
      const decoded = decodeThreadRedoRequest(request);
      if (!decoded) throw new Error("Expected codexhost/thread/redo request");
      threadId = decoded.threadId;
    } catch (error) {
      await this.#writer.json(rpcError(request, -32602, errorMessage(error)));
      return;
    }
    const resolution = await this.#resolveExternalThread(threadId);
    if (resolution.kind === "error") {
      await this.#writer.json(rpcError(request, resolution.error.code, resolution.error.message));
      return;
    }
    if (resolution.kind !== "external") {
      await this.#writer.json(
        rpcError(request, -32076, "Official Codex Thread does not use Host Redo"),
      );
      return;
    }
    const result = await executeExternalThreadRedo({
      current: resolution.thread,
      adapters: this.#externalAdapters,
      repository: this.#repository,
      runtime: this.#externalRuntime,
      environment: this.#options.environment ?? process.env,
    });
    if (!result.ok) {
      await this.#writer.json(rpcError(request, result.error.code, result.error.message));
      return;
    }
    await this.#writer.json(rpcEnvelope(request, { result: { thread: result.thread } }));
    await this.#notifyExternalHistoryReplaced(resolution.thread);
  }

  /**
   * Desktop's paginated transcript only re-reads a Thread on `thread/reverted`
   * (the official Revert path). A Renderer-initiated `thread/rollback` or Host
   * Redo replaces history behind Desktop's back, so the same notification is
   * emitted for paginated Threads; legacy transcripts update from the result.
   */
  async #notifyExternalHistoryReplaced(thread: ExternalThread): Promise<void> {
    if (thread.record.historyMode !== "paginated") return;
    await this.#writer.json({ method: "thread/reverted", params: { threadId: thread.id } });
  }

  async #rollbackExternalThread(
    request: JsonRpcRequest,
    derived: ExternalThread,
    rollback: DecodedThreadRollbackRequest,
  ): Promise<void> {
    const result = await executeExternalThreadRollback({
      derived,
      rollback,
      adapters: this.#externalAdapters,
      repository: this.#repository,
      runtime: this.#externalRuntime,
      environment: this.#options.environment ?? process.env,
    });
    if (!result.ok) {
      await this.#writer.json(rpcError(request, result.error.code, result.error.message));
      return;
    }
    await this.#writer.json(rpcEnvelope(request, { result: threadRollbackResult(result.thread) }));
    await this.#notifyExternalHistoryReplaced(derived);
  }

  async #persistExternalThreadName(
    location: Extract<ExternalThreadLocation, { kind: "external" }>,
    name: string,
    source: "desktop" | "native",
  ): Promise<StoredThreadRecordV1> {
    const record = await this.#repository.setTitle(location.record.hostThreadId, name, source);
    if (location.thread) {
      location.thread.record = record;
      location.thread.thread.name = name;
      location.thread.thread.updatedAt = unixSeconds();
    }
    await this.#writer.json({
      method: "thread/name/updated",
      params: { threadId: location.record.hostThreadId, threadName: name },
    });
    return record;
  }

  async #setExternalThreadName(
    request: JsonRpcRequest,
    location: Extract<ExternalThreadLocation, { kind: "external" }>,
    name: JsonValue | undefined,
  ): Promise<void> {
    if (typeof name !== "string" || name.length === 0) {
      await this.#writer.json(
        rpcError(request, -32602, "External Thread name must be a non-empty string"),
      );
      return;
    }
    try {
      await this.#persistExternalThreadName(location, name, "desktop");
    } catch {
      await this.#writer.json(
        rpcError(request, -32081, "External Thread title could not be persisted"),
      );
      return;
    }
    await this.#writer.json(rpcEnvelope(request, { result: {} }));
  }

  async #renameDelegationThread(input: ThreadRenameInput): Promise<ThreadRenameResult> {
    const name = input.name.trim();
    if (!name) {
      throw new DelegationControlError(
        "INVALID_ARGUMENT",
        "Thread name must be a non-empty string",
      );
    }
    const title = name.slice(0, 120);
    const location = await this.#locateExternalThread(input.threadId);
    if (location.kind !== "external") {
      throw new DelegationControlError(
        "THREAD_NOT_FOUND",
        "Thread is not a Host-managed extra process",
      );
    }
    // A Desktop first-message fallback is titleSource=desktop with no usable
    // preview after reload; that is not a hand-set title. Only a distinct
    // Desktop name backed by preview evidence is protected.
    const loaded = location.thread;
    const preview = loaded ? this.#threadPreviewEvidence(loaded) : "";
    const desktopHandSet =
      loaded != null &&
      location.record.titleSource === "desktop" &&
      preview.trim().length > 0 &&
      !this.#nativeTitleMayReplace(loaded);
    if (desktopHandSet) {
      throw new DelegationControlError(
        "INVALID_ARGUMENT",
        "Thread title was set by hand in Desktop and will not be overwritten",
      );
    }
    try {
      await this.#persistExternalThreadName(location, title, "native");
    } catch {
      throw new DelegationControlError(
        "INTERNAL_ERROR",
        "External Thread title could not be persisted",
      );
    }
    return { threadId: location.record.hostThreadId, title };
  }

  /**
   * Delegation CLI `thread archive|unarchive`. Mirrors the Desktop
   * `thread/archive` semantics exactly — the row leaves the live listing and
   * the sidebar, a running Turn is not stopped — so a polling consumer such
   * as EyPc can archive an extra process without a Desktop round trip.
   */
  async #archiveDelegationThread(input: ThreadArchiveInput): Promise<ThreadArchiveResult> {
    if (typeof input.threadId !== "string" || input.threadId.length === 0) {
      throw new DelegationControlError("INVALID_ARGUMENT", "Thread identifier is required");
    }
    if (input.archived !== undefined && typeof input.archived !== "boolean") {
      throw new DelegationControlError("INVALID_ARGUMENT", "archived must be a boolean");
    }
    const archived = input.archived !== false;
    const location = await this.#locateExternalThread(input.threadId);
    if (location.kind !== "external") {
      throw new DelegationControlError(
        "THREAD_NOT_FOUND",
        "Thread is not a Host-managed extra process",
      );
    }
    const applied = await this.#applyExternalArchiveState(location, archived);
    if (!applied.ok) throw new DelegationControlError("INTERNAL_ERROR", applied.message);
    await this.#notifyExternalArchiveState(applied.record.hostThreadId, archived);
    await this.#cascadeSideChatArchiveState(applied.record.hostThreadId, archived);
    return { threadId: applied.record.hostThreadId, archived };
  }

  async #applyHostTitleOverlay(threadId: string, title: string): Promise<void> {
    const location = await this.#locateExternalThread(threadId);
    if (location.kind !== "external") return;
    if (location.record.title === title && location.record.titleSource === "native") return;
    await this.#renameDelegationThread({ threadId, name: title });
  }

  /**
   * Codexhost disables Codex title generation for external Threads, so a
   * Thread nobody renamed stays nameless everywhere. Desktop writes a
   * first-user-message fallback of its own, but nothing does when the Thread
   * was started by a Harness or the delegation CLI, and `thread/list`
   * projects records with no Turn items — so a read-side fallback cannot
   * reach the sidebar or the CLI. Persist the same fallback here instead.
   *
   * It is stored as `titleSource: "fallback"` rather than impersonating the
   * Desktop fallback: a name the Host derived is never a hand-set name, and
   * saying so keeps it replaceable without depending on preview evidence that
   * a freshly started Turn does not have yet.
   */
  async #nameUntitledThreadAfterFirstMessage(thread: ExternalThread, text: string): Promise<void> {
    if (thread.record.title.length > 0) return;
    const derived = derivedThreadName(text);
    if (derived === null) return;
    try {
      thread.record = await this.#repository.setTitle(
        thread.record.hostThreadId,
        derived,
        "fallback",
      );
    } catch {
      this.#diagnose("External fallback Thread title could not be persisted");
      return;
    }
    thread.thread.name = derived;
    await this.#writer.json({
      method: "thread/name/updated",
      params: { threadId: thread.record.hostThreadId, threadName: derived },
    });
  }

  /**
   * External unread used to live in a process-local Set, so a Host restart
   * silently reported every extra process as read: nobody had viewed those
   * Threads, the memory was simply gone, and Desktop's own persisted unread
   * then disagreed with the Host about the same Thread. It rides the Thread
   * record instead. `updatedAt` is deliberately left alone — marking a Thread
   * read is not activity and must not reorder the sidebar.
   */
  async #markExternalUnread(thread: ExternalThread, unread: boolean): Promise<void> {
    if ((thread.record.unread ?? false) === unread) return;
    try {
      thread.record = await this.#repository.setUnread(thread.record.hostThreadId, unread);
    } catch {
      this.#diagnose("External Thread unread state could not be persisted");
    }
  }

  async #syncNativeThreadName(
    thread: ExternalThread,
    nativeTitle: { text: string; source: "user" | "generated" },
  ): Promise<void> {
    const text = nativeTitle.text.trim();
    if (text.length === 0 || text.length > 4_096 || text === thread.record.title) return;
    if (nativeTitle.source !== "user" && !this.#nativeTitleMayReplace(thread)) return;
    let record: StoredThreadRecordV1;
    try {
      record = await this.#repository.setTitle(thread.record.hostThreadId, text, "native");
    } catch {
      this.#diagnose("External native title could not be persisted");
      return;
    }
    thread.record = record;
    thread.thread.name = text;
    thread.thread.updatedAt = unixSeconds();
    await this.#writer.json({
      method: "thread/name/updated",
      params: { threadId: thread.record.hostThreadId, threadName: text },
    });
  }

  /**
   * First-message preview used to tell a Desktop fallback title from a
   * hand-set name. The live JSON projection often keeps preview empty until
   * a list/read refresh, so Turn items are the fallback evidence.
   */
  #threadPreviewEvidence(thread: ExternalThread): string {
    const projected = thread.thread.preview;
    if (typeof projected === "string" && projected.trim().length > 0) return projected;
    const rebuilt = externalThreadValue({
      record: thread.record,
      turns: thread.turns,
      sessionId: thread.sessionId,
      running: thread.running,
    });
    return typeof rebuilt.preview === "string" ? rebuilt.preview : "";
  }

  /**
   * A generated native title may replace an empty name, a Host-derived
   * fallback, or a Desktop first-message fallback. It must not replace a
   * Host CLI / overlay native name. Desktop-side names that match the
   * Thread's first-message preview are still replaceable.
   */
  #nativeTitleMayReplace(thread: ExternalThread): boolean {
    const title = thread.record.title;
    if (title.length === 0) return true;
    // A Host-derived fallback is not a chosen name; it always yields.
    if (thread.record.titleSource === "fallback") return true;
    // Generated Grok titles must not replace a Host CLI / overlay native name.
    // User-sourced native titles still apply in #syncNativeThreadName.
    const preview = this.#threadPreviewEvidence(thread);
    if (preview.length === 0) return false;
    const normalizedTitle = title
      .replace(/[.…]+$/u, "")
      .replace(/\s+/gu, " ")
      .trim();
    if (normalizedTitle.length === 0) return false;
    const normalizedPreview = preview.replace(/\s+/gu, " ").trim();
    return normalizedPreview.startsWith(normalizedTitle);
  }

  async #updateExternalThreadMetadata(
    request: JsonRpcRequest,
    location: Extract<ExternalThreadLocation, { kind: "external" }>,
    decoded: DecodedThreadMetadataUpdateRequest,
  ): Promise<void> {
    if (decoded.gitInfo !== undefined || decoded.isPinned === undefined) {
      await this.#writer.json(
        rpcError(request, -32078, "External Thread metadata updates are unsupported"),
      );
      return;
    }
    const pinned = decoded.isPinned === true;
    const sessionId =
      location.thread?.sessionId ??
      (await this.#repository.sessionTreeId(location.record).catch(() => null));
    if (!sessionId) {
      await this.#writer.json(
        rpcError(request, -32081, "External Thread metadata could not be projected"),
      );
      return;
    }
    let record: StoredThreadRecordV1;
    try {
      record = await this.#repository.assignSection(location.record.hostThreadId, {
        pinned,
        sectionId: pinned ? CODEX_PINNED_THREAD_SECTION_ID : null,
      });
    } catch {
      await this.#writer.json(
        rpcError(request, -32081, "External Thread pin state could not be persisted"),
      );
      return;
    }
    const projected = this.#applyExternalThreadRecord(location, record, sessionId);
    // Official Codex returns { thread } so Desktop can keep the optimistic
    // pinned-section move. An empty result makes the sidebar snap back.
    await this.#writer.json(rpcEnvelope(request, { result: { thread: projected } }));
  }

  async #moveExternalThreadSection(
    request: JsonRpcRequest,
    location: Extract<ExternalThreadLocation, { kind: "external" }>,
    decoded: DecodedThreadSectionMoveRequest,
  ): Promise<void> {
    const pinned = decoded.sectionId === CODEX_PINNED_THREAD_SECTION_ID;
    const records = await this.#repository.list();
    let sectionPosition: number | undefined;
    if (decoded.sectionId != null) {
      const siblings = records.filter(
        (record) =>
          effectiveThreadSectionId(record) === decoded.sectionId &&
          record.hostThreadId !== location.record.hostThreadId,
      );
      if (decoded.beforeThreadId) {
        const before = siblings.find((record) => record.hostThreadId === decoded.beforeThreadId);
        sectionPosition = (before?.sectionPosition ?? 0) - 1;
      } else {
        sectionPosition =
          siblings.reduce((max, record) => Math.max(max, record.sectionPosition ?? 0), 0) + 1;
      }
    }
    let record: StoredThreadRecordV1;
    try {
      record = await this.#repository.assignSection(location.record.hostThreadId, {
        pinned,
        sectionId: decoded.sectionId,
        ...(sectionPosition !== undefined ? { sectionPosition } : {}),
      });
    } catch {
      await this.#writer.json(
        rpcError(request, -32081, "External Thread section could not be persisted"),
      );
      return;
    }
    const sessionId =
      location.thread?.sessionId ??
      (await this.#repository.sessionTreeId(record).catch(() => null));
    if (sessionId) this.#applyExternalThreadRecord(location, record, sessionId);
    else if (location.thread) location.thread.record = record;
    await this.#writer.json(rpcEnvelope(request, { result: {} }));
  }

  #applyExternalThreadRecord(
    location: Extract<ExternalThreadLocation, { kind: "external" }>,
    record: StoredThreadRecordV1,
    sessionId: string,
  ): JsonObject {
    const projected = externalThreadValue({
      record,
      turns: location.thread?.turns ?? [],
      sessionId,
      ...(location.thread ? { running: location.thread.running } : { loaded: false }),
    });
    if (location.thread) {
      location.thread.record = record;
      location.thread.thread = {
        ...location.thread.thread,
        ...projected,
        turns: location.thread.thread.turns ?? [],
      };
    }
    return projected;
  }

  async #deleteExternalThread(
    request: JsonRpcRequest,
    location: Extract<ExternalThreadLocation, { kind: "external" }>,
  ): Promise<void> {
    const thread = location.thread;
    if (thread) {
      await this.#flushQueuedExternalTurns(thread, "External Thread was deleted");
    }
    try {
      await this.#repository.removeThread(location.record.hostThreadId);
    } catch {
      await this.#writer.json(rpcError(request, -32081, "External Thread could not be removed"));
      return;
    }
    this.#externalRuntime.remove(location.record.hostThreadId);
    this.#routeObservationTracker.forgetThread(location.record.hostThreadId);
    if (!thread) {
      await this.#writer.json(rpcEnvelope(request, { result: {} }));
      return;
    }
    thread.stateObserver.fault(new Error("External Thread was deleted"));
    try {
      await thread.session.close();
      await thread.outputTask;
      await this.#writer.json(rpcEnvelope(request, { result: {} }));
    } catch (error) {
      await this.#writer.json(
        rpcError(request, -32075, `External Thread could not close: ${errorMessage(error)}`),
      );
    }
  }

  async #readExternalThreadMetadata(
    request: JsonRpcRequest,
    location: Extract<ExternalThreadLocation, { kind: "external" }>,
  ): Promise<void> {
    try {
      const thread = location.thread
        ? { ...location.thread.thread, turns: [] }
        : externalThreadValue({
            record: location.record,
            turns: [],
            sessionId: await this.#repository.sessionTreeId(location.record),
          });
      await this.#writer.json(rpcEnvelope(request, { result: { thread } }));
      if (location.thread) await this.#replayExternalUsage(location.thread);
    } catch {
      await this.#writer.json(
        rpcError(request, -32081, "External Thread metadata could not be read"),
      );
    }
  }

  async #readExternalThread(
    request: JsonRpcRequest,
    thread: ExternalThread,
    includeTurns: boolean,
    historyFresh: boolean,
  ): Promise<void> {
    // A Desktop-side content read is the "viewed" signal for external unread.
    if (includeTurns) await this.#markExternalUnread(thread, false);
    if (includeTurns && thread.record.historyMode === "paginated") {
      await this.#writer.json(
        rpcError(request, -32602, "Paginated External Threads require thread/turns/list"),
      );
      return;
    }
    if (includeTurns && !thread.running && !historyFresh) {
      const refreshed = await this.#refreshExternalThread(thread);
      if (refreshed) {
        await this.#writer.json(rpcError(request, refreshed.code, refreshed.message));
        return;
      }
    }
    await this.#writer.json(
      rpcEnvelope(request, {
        result: {
          thread: {
            ...thread.thread,
            turns: includeTurns ? this.#externalHistoryTurns(thread) : [],
          },
        },
      }),
    );
    await this.#replayExternalUsage(thread);
  }

  async #listExternalHistory(
    request: JsonRpcRequest,
    thread: ExternalThread,
    params: JsonObject,
    historyFresh: boolean,
  ): Promise<void> {
    const headPage = params.cursor === null || params.cursor === undefined;
    const requiresRefresh =
      request.method === "thread/turns/list" ||
      (request.method === "thread/items/list" && !thread.historyHydrated);
    if (!thread.running && !historyFresh && headPage && requiresRefresh) {
      const refreshed = await this.#refreshExternalThread(thread);
      if (refreshed) {
        await this.#writer.json(rpcError(request, refreshed.code, refreshed.message));
        return;
      }
    }
    try {
      const turns = this.#externalHistoryTurns(thread);
      const result =
        request.method === "thread/turns/list"
          ? listExternalTurns(turns, params)
          : listExternalItems(turns, params);
      await this.#writer.json(rpcEnvelope(request, { result }));
    } catch (error) {
      await this.#writer.json(
        rpcError(
          request,
          error instanceof ExternalHistoryRequestError ? -32602 : -32076,
          error instanceof ExternalHistoryRequestError
            ? error.message
            : "External Thread history projection failed",
        ),
      );
    }
  }

  async #resumeExternalThread(
    request: JsonRpcRequest,
    thread: ExternalThread,
    params: JsonObject,
    historyFresh: boolean,
  ): Promise<void> {
    // Resuming is the Desktop opening the Thread; the unread mark is consumed.
    await this.#markExternalUnread(thread, false);
    if (!thread.running && !historyFresh) {
      const refreshed = await this.#refreshExternalThread(thread);
      if (refreshed) {
        await this.#writer.json(rpcError(request, refreshed.code, refreshed.message));
        return;
      }
    }
    const turns = this.#externalHistoryTurns(thread);
    const responseThread = {
      ...thread.thread,
      turns: params.excludeTurns === true ? [] : turns,
    };
    const result = threadForkResult(responseThread, {
      model: thread.transportModelId,
      cwd: thread.cwd,
      runtimeWorkspaceRoots: Array.isArray(params.runtimeWorkspaceRoots)
        ? params.runtimeWorkspaceRoots.filter((value): value is string => typeof value === "string")
        : [],
      approvalPolicy: typeof params.approvalPolicy === "string" ? params.approvalPolicy : "never",
      sandbox: sandboxResult(params),
      ...(typeof params.serviceTier === "string" ? { serviceTier: params.serviceTier } : {}),
    });
    try {
      if (
        params.initialTurnsPage !== undefined &&
        params.initialTurnsPage !== null &&
        !isRecord(params.initialTurnsPage)
      ) {
        throw new ExternalHistoryRequestError("initialTurnsPage must be an object");
      }
      const initialPageParams = isRecord(params.initialTurnsPage)
        ? (params.initialTurnsPage as JsonObject)
        : null;
      const initialTurnsPage = initialPageParams
        ? listExternalTurns(turns, initialPageParams)
        : null;
      const paginated = thread.record.historyMode === "paginated";
      const turnsBackwardsCursor = paginated
        ? listExternalTurns(turns, { limit: 1, itemsView: "notLoaded" }).backwardsCursor
        : null;
      const itemsBackwardsCursor = paginated
        ? listExternalItems(turns, { limit: 1, sortDirection: "desc" }).backwardsCursor
        : null;
      await this.#writer.json(
        rpcEnvelope(request, {
          result: {
            ...result,
            initialTurnsPage,
            turnsBackwardsCursor,
            itemsBackwardsCursor,
          },
        }),
      );
    } catch (error) {
      await this.#writer.json(
        rpcError(
          request,
          error instanceof ExternalHistoryRequestError ? -32602 : -32076,
          error instanceof ExternalHistoryRequestError
            ? error.message
            : "External Thread history projection failed",
        ),
      );
    }
  }

  #externalHistoryTurns(thread: ExternalThread): JsonObject[] {
    if (!thread.activeTurnId) return thread.turns;
    const active = thread.projectedTurns.get(thread.activeTurnId);
    return active ? [...thread.turns, active.projector.pendingTurn()] : thread.turns;
  }

  async #startDelegatedExternalTurn(
    thread: ExternalThread,
    text: string,
    requestedTurnId: string,
  ): Promise<void> {
    if (thread.running) {
      throw new Error("External Thread already has an active Turn");
    }
    const turnId = hostTurnIdSchema.parse(requestedTurnId);
    const projection: ProjectedTurn = {
      projector: new CodexTurnProjector({
        threadId: thread.id,
        turnId,
        cwd: thread.cwd,
        startedAtMs: Date.now(),
        initialInput: [{ type: "text", text }],
      }),
    };
    thread.running = true;
    thread.activeTurnId = turnId;
    thread.projectedTurns.set(turnId, projection);
    thread.responseGates.set(turnId, { promise: Promise.resolve(), resolve: () => undefined });
    const result = await thread.session.execute({
      type: "turn.start",
      turnId,
      input: [{ type: "text", text }],
    });
    if (!result.ok) {
      thread.running = false;
      thread.activeTurnId = null;
      thread.projectedTurns.delete(turnId);
      thread.responseGates.delete(turnId);
      throw new Error(result.error.message);
    }
  }

  async #startExternalTurn(
    request: JsonRpcRequest,
    thread: ExternalThread,
    alsoAnswer: readonly JsonRpcRequest[] = [],
  ): Promise<void> {
    // A steered follow-up was already acknowledged at enqueue time; its clone
    // carries a null id and every response for it must be suppressed instead
    // of reaching the Desktop as an unmatched frame.
    const writer = request.id === null ? { json: async () => undefined } : this.#writer;
    const replyError = async (code: number, message: string): Promise<void> => {
      await writer.json(rpcError(request, code, message));
      for (const peer of alsoAnswer) {
        if (peer.id === null) continue;
        await this.#writer.json(rpcError(peer, code, message));
      }
    };
    if (thread.running) {
      if (thread.activeTurnId && thread.session.capabilities.turns?.steer === true) {
        await this.#injectExternalTurnStartAsSteer(request, thread, alsoAnswer);
        return;
      }
      if (thread.queuedTurnStarts.length >= MAX_QUEUED_EXTERNAL_TURN_STARTS) {
        await replyError(-32072, "External Thread already has an active Turn");
        return;
      }
      // Codex Desktop queues follow-up messages and marks any turn/start
      // rejection as permanently paused. Hold the request instead and answer
      // it when the active Turn completes and this one actually starts.
      thread.queuedTurnStarts.push(request);
      if (alsoAnswer.length > 0) thread.queuedTurnStarts.push(...alsoAnswer);
      return;
    }
    const params = requestObject(request);
    if (typeof params.model === "string") {
      let route: ReturnType<typeof decodeCreateRoute>;
      try {
        route = decodeCreateRoute({ id: request.id, method: "thread/start", params });
      } catch (error) {
        await replyError(-32602, errorMessage(error));
        return;
      }
      if (route?.harnessId !== "codex" && route?.harnessId !== thread.harnessId) {
        await replyError(-32602, "Turn Model carrier does not belong to the Thread Harness");
        return;
      }
    }
    let text: string;
    try {
      text = requestText(params);
    } catch (error) {
      await replyError(-32602, errorMessage(error));
      return;
    }
    if (alsoAnswer.length === 0 && thread.session.commands) {
      const catalog = await thread.session.commands.list();
      if (!catalog.ok) {
        await replyError(-32073, catalog.error.message);
        return;
      }
      const matched = catalog.value.commands
        .toSorted((left, right) => right.invocation.length - left.invocation.length)
        .find((command) => {
          if (text === command.invocation) return true;
          return command.argumentMode === "text" && text.startsWith(`${command.invocation} `);
        });
      if (matched) {
        const argumentText = text.slice(matched.invocation.length).trimStart();
        try {
          await this.#startExternalCommand(
            request,
            thread,
            matched.id,
            argumentText.length > 0 ? { text: argumentText } : undefined,
            undefined,
            "turn",
          );
        } catch (error) {
          this.#diagnose(error);
          await replyError(-32073, `External Harness command failed: ${errorMessage(error)}`);
        }
        return;
      }
    }
    const turnId = hostTurnIdSchema.parse(randomUUID());
    const startedAtMs = Date.now();
    const projection: ProjectedTurn = {
      projector: new CodexTurnProjector({
        threadId: thread.id,
        turnId,
        cwd: thread.cwd,
        startedAtMs,
      }),
    };
    const gate = turnProjectionGate();
    thread.running = true;
    thread.activeTurnId = turnId;
    thread.projectedTurns.set(turnId, projection);
    thread.responseGates.set(turnId, gate);

    const result = await thread.session.execute({
      type: "turn.start",
      turnId,
      input: [{ type: "text", text }],
    });
    if (!result.ok) {
      thread.running = false;
      thread.activeTurnId = null;
      thread.projectedTurns.delete(turnId);
      thread.responseGates.delete(turnId);
      gate.resolve();
      await replyError(-32073, result.error.message);
      this.#dispatchQueuedExternalTurn(thread);
      return;
    }
    await this.#nameUntitledThreadAfterFirstMessage(thread, text);
    try {
      const pending = projection.projector.pendingTurn();
      await writer.json(rpcEnvelope(request, { result: { turn: pending } }));
      for (const peer of alsoAnswer) {
        if (peer.id === null) continue;
        await this.#writer.json(rpcEnvelope(peer, { result: { turn: pending } }));
      }
    } finally {
      gate.resolve();
    }
  }

  async #interruptExternalTurn(
    request: JsonRpcRequest,
    thread: ExternalThread,
    requestedTurnId: JsonValue | undefined,
  ): Promise<void> {
    if (
      typeof requestedTurnId !== "string" ||
      !thread.running ||
      thread.activeTurnId !== requestedTurnId
    ) {
      await this.#writer.json(
        rpcError(request, -32074, "External turn/interrupt must reference the active Turn"),
      );
      return;
    }
    const turnId = thread.activeTurnId;
    const gate = turnProjectionGate();
    thread.responseGates.set(turnId, gate);
    const result = await thread.session.execute({ type: "turn.cancel", turnId });
    if (!result.ok) {
      gate.resolve();
      await this.#writer.json(rpcError(request, -32074, result.error.message));
      return;
    }
    try {
      await this.#writer.json(rpcEnvelope(request, { result: {} }));
    } finally {
      gate.resolve();
    }
  }

  async #consumeHarnessOutputs(thread: ExternalThread): Promise<void> {
    try {
      for await (const output of thread.session.outputs) {
        await this.#projectHarnessOutput(thread, output);
      }
    } catch (error) {
      this.#diagnose(error);
    }
  }

  async #projectHarnessOutput(thread: ExternalThread, output: HarnessOutput): Promise<void> {
    if (output.kind === "interaction") {
      if (output.interaction.type === "approval") {
        await this.#projectApproval(thread, output.interaction);
      } else {
        await this.#projectQuestion(thread, output.interaction);
      }
      return;
    }
    let event = output.event;
    if (event.type === "item.started" && event.item.type === "subagentDelegation") {
      event = {
        ...event,
        item: {
          ...event.item,
          subagents: await Promise.all(
            event.item.subagents.map((subagent) =>
              this.#materializeSubagent(thread, subagent).catch(() => subagent),
            ),
          ),
        },
      };
    }
    if (event.type === "item.updated" && event.update.type === "subagents.replace") {
      event = {
        ...event,
        update: {
          ...event.update,
          subagents: await Promise.all(
            event.update.subagents.map((subagent) =>
              this.#materializeSubagent(thread, subagent).catch(() => subagent),
            ),
          ),
        },
      };
    }
    if (event.type === "item.completed" && event.snapshot.item.type === "subagentDelegation") {
      event = {
        ...event,
        snapshot: {
          ...event.snapshot,
          item: {
            ...event.snapshot.item,
            subagents: await Promise.all(
              event.snapshot.item.subagents.map((subagent) =>
                this.#materializeSubagent(thread, subagent).catch(() => subagent),
              ),
            ),
          },
        },
      };
    }
    if (event.type === "session.state.changed") {
      try {
        if (event.state.nativeRef) {
          if (!thread.record.nativeSessionRef) {
            thread.record = await this.#repository.commitNative(thread.id, event.state.nativeRef);
          } else if (
            thread.record.nativeSessionRef.harnessId !== event.state.nativeRef.harnessId ||
            thread.record.nativeSessionRef.nativeSessionId !== event.state.nativeRef.nativeSessionId
          ) {
            throw new Error("External Session changed Native identity");
          }
        }
        thread.stateObserver.update(event.state);
        if (event.state.nativeTitle) {
          await this.#syncNativeThreadName(thread, event.state.nativeTitle);
        }
      } catch (error) {
        thread.persistenceError = error instanceof Error ? error : new Error(errorMessage(error));
        thread.stateObserver.fault(thread.persistenceError);
        this.#diagnose("External Session state could not be persisted");
      }
      return;
    }
    if (event.type === "session.usage.changed") {
      if (this.#externalRuntime.get(thread.id) !== thread) return;
      thread.latestUsage = event.usage;
      if (event.usage === null) {
        thread.usageTurnId = null;
        await this.#writer.json({
          method: THREAD_USAGE_UPDATED_METHOD,
          params: { threadId: thread.id },
        });
        return;
      }
      const turnId = event.observedForTurnId
        ? this.#isKnownExternalTurn(thread, event.observedForTurnId)
          ? event.observedForTurnId
          : null
        : (thread.activeTurnId ?? this.#latestCompletedTurnId(thread));
      thread.usageTurnId = turnId;
      if (turnId) {
        await this.#waitForTurnResponse(thread, turnId);
        await this.#writeExternalUsage(thread, turnId);
      }
      await this.#writer.json({
        method: THREAD_USAGE_UPDATED_METHOD,
        params: { threadId: thread.id },
      });
      return;
    }
    if (event.type === "subagent.transcript.changed") {
      const nativeSubagentId = event.nativeSubagentId;
      const record = (await this.#repository.list()).find(
        (candidate) =>
          candidate.subagent?.parentHostThreadId === thread.id &&
          candidate.subagent.nativeSubagentId === nativeSubagentId,
      );
      if (record) await this.#refreshOpenSubagentThread(record.hostThreadId, false);
      return;
    }
    if (event.type === "subagent.state.changed") {
      const nativeSubagentId = event.nativeSubagentId;
      const record = (await this.#repository.list()).find(
        (candidate) =>
          candidate.subagent?.parentHostThreadId === thread.id &&
          candidate.subagent.nativeSubagentId === nativeSubagentId,
      );
      if (!record) return;
      const status = event.status === "pending" || event.status === "running" ? "active" : "idle";
      this.#trackRunningSubagent(thread.id, record.hostThreadId, status);
      await this.#setSubagentThreadStatus(record.hostThreadId, status);
      if (!thread.running && !thread.activeTurnId && !this.#hasRunningSubagents(thread.id)) {
        await this.#setThreadStatus(thread, { type: "idle" });
      }
      return;
    }
    if (event.type === "session.faulted") {
      thread.stateObserver.fault(new Error(event.error.message));
      this.#diagnose(`${thread.harnessId} Harness Session faulted: ${event.error.message}`);
      await this.#flushQueuedExternalTurns(thread, "External Harness Session faulted");
      return;
    }

    if (event.type === "turn.autonomous.started") {
      if (thread.running || thread.activeTurnId) {
        throw new Error("External autonomous Turn started while another Turn is active");
      }
      const projection: ProjectedTurn = {
        projector: new CodexTurnProjector({
          threadId: thread.id,
          turnId: event.turnId,
          cwd: thread.cwd,
          startedAtMs: Date.now(),
        }),
      };
      thread.running = true;
      thread.activeTurnId = event.turnId;
      thread.projectedTurns.set(event.turnId, projection);
      thread.responseGates.set(event.turnId, {
        promise: Promise.resolve(),
        resolve: () => undefined,
      });
      return;
    }

    const projection = this.#projectedTurn(thread, event.turnId);
    await this.#waitForTurnResponse(thread, event.turnId);
    if (
      event.type === "interaction.closed" &&
      thread.ignoredInteractionIds.delete(event.interactionId)
    ) {
      return;
    }
    if (event.type === "interaction.closed") {
      await this.#resolveDesktopApproval(event.interactionId);
      await this.#resolveDesktopQuestion(event.interactionId);
    }
    const ephemeralTurn =
      event.type === "turn.completed" && thread.ephemeralTurnIds.has(event.turnId);
    if (event.type === "turn.completed" && !ephemeralTurn) {
      const persistenceError = await this.#persistTerminalIdentity(thread, event);
      if (persistenceError) {
        event = {
          type: "turn.completed",
          turnId: event.turnId,
          outcome: {
            status: "failed",
            error: {
              code: "internalError",
              message: "External Turn identity could not be persisted",
              retryable: false,
            },
          },
        };
      }
    }
    const result = projection.projector.project(event as ProjectableHostEvent);
    if (event.type === "turn.started") {
      await this.#setThreadStatus(thread, { type: "active", activeFlags: [] });
    }
    if (event.type === "turn.completed") {
      if (!result.completedTurn) throw new Error("Turn projector returned no completed Turn");
      const completedAt = Math.floor(Date.now() / 1000);
      if (ephemeralTurn) {
        thread.ephemeralTurnIds.delete(event.turnId);
      } else {
        thread.turns.push(result.completedTurn);
        thread.thread.updatedAt = completedAt;
        thread.thread.recencyAt = completedAt;
        // The Desktop persists its own unread for native Threads only, so the
        // Host is the owner for extra processes. A finished non-ephemeral Turn
        // is unread until the Desktop views the Thread again.
        await this.#markExternalUnread(thread, true);
      }
      thread.historyHydrated = false;
      thread.running = false;
      thread.activeTurnId = null;
      thread.projectedTurns.delete(event.turnId);
      thread.responseGates.delete(event.turnId);
      const delegation = await this.#repository.getDelegationByChild(thread.record.hostThreadId);
      if (delegation) {
        const status =
          result.completedTurn.status === "failed"
            ? "failed"
            : result.completedTurn.status === "interrupted"
              ? "interrupted"
              : "completed";
        await this.#repository.setDelegationStatus(delegation.delegationId, status);
      }
    }
    for (const message of result.messages) await this.#writer.json(message);
    if (event.type === "turn.completed") {
      await this.#setThreadStatus(
        thread,
        this.#hasRunningSubagents(thread.id)
          ? { type: "active", activeFlags: [] }
          : { type: "idle" },
      );
      if (result.completedTurn?.status === "interrupted") {
        if (thread.retainQueuedTurnsAfterInterrupt) {
          thread.retainQueuedTurnsAfterInterrupt = false;
          this.#dispatchQueuedExternalTurn(thread);
        } else {
          // User Stop matches native Codex: discard queued follow-ups.
          await this.#flushQueuedExternalTurns(
            thread,
            "External queued Turn was discarded after interrupt",
          );
        }
      } else {
        this.#dispatchQueuedExternalTurn(thread);
      }
    }
  }

  async #injectExternalTurnStartAsSteer(
    request: JsonRpcRequest,
    thread: ExternalThread,
    alsoAnswer: readonly JsonRpcRequest[] = [],
  ): Promise<void> {
    const writer = request.id === null ? { json: async () => undefined } : this.#writer;
    const replyError = async (code: number, message: string): Promise<void> => {
      await writer.json(rpcError(request, code, message));
      for (const peer of alsoAnswer) {
        if (peer.id === null) continue;
        await this.#writer.json(rpcError(peer, code, message));
      }
    };
    const turnId = thread.activeTurnId;
    if (!turnId) {
      await replyError(-32072, "External Thread already has an active Turn");
      return;
    }
    let text: string;
    try {
      text = requestText(requestObject(request));
    } catch (error) {
      await replyError(-32602, errorMessage(error));
      return;
    }
    const result = await thread.session.execute({
      type: "turn.steer",
      turnId,
      input: [{ type: "text", text }],
    });
    if (!result.ok) {
      this.#diagnose(
        `External native steer failed: ${result.error.message}; holding turn/start until the active Turn completes`,
      );
      if (thread.queuedTurnStarts.length >= MAX_QUEUED_EXTERNAL_TURN_STARTS) {
        await replyError(-32072, "External Thread already has an active Turn");
        return;
      }
      thread.queuedTurnStarts.push(request);
      if (alsoAnswer.length > 0) thread.queuedTurnStarts.push(...alsoAnswer);
      return;
    }
    const pending = thread.projectedTurns.get(turnId)?.projector.pendingTurn() ?? {
      id: turnId,
      status: "inProgress",
    };
    await writer.json(rpcEnvelope(request, { result: { turn: pending } }));
    for (const peer of alsoAnswer) {
      if (peer.id === null) continue;
      await this.#writer.json(rpcEnvelope(peer, { result: { turn: pending } }));
    }
  }

  async #steerExternalTurn(
    request: JsonRpcRequest,
    thread: ExternalThread,
    params: JsonObject,
  ): Promise<void> {
    const nativeSteer =
      thread.running &&
      thread.activeTurnId !== null &&
      thread.session.capabilities.turns?.steer === true;
    if (nativeSteer && thread.activeTurnId) {
      await this.#writer.json(rpcEnvelope(request, { result: {} }));
      let text: string;
      try {
        text = requestText(params);
      } catch (error) {
        this.#diagnose(error);
        await this.#enqueueExternalSteerFollowUp(thread, params);
        return;
      }
      const result = await thread.session.execute({
        type: "turn.steer",
        turnId: thread.activeTurnId,
        input: [{ type: "text", text }],
      });
      if (!result.ok) {
        this.#diagnose(
          `External native steer failed: ${result.error.message}; falling back to follow-up queue`,
        );
        await this.#enqueueExternalSteerFollowUp(thread, params);
      }
      return;
    }
    if (thread.queuedTurnStarts.length >= MAX_QUEUED_EXTERNAL_TURN_STARTS) {
      await this.#writer.json(rpcError(request, -32072, "External Thread follow-up queue is full"));
      return;
    }
    await this.#writer.json(rpcEnvelope(request, { result: {} }));
    await this.#enqueueExternalSteerFollowUp(thread, params);
  }

  async #enqueueExternalSteerFollowUp(thread: ExternalThread, params: JsonObject): Promise<void> {
    if (thread.queuedTurnStarts.length >= MAX_QUEUED_EXTERNAL_TURN_STARTS) {
      this.#diagnose("External Thread follow-up queue is full");
      return;
    }
    thread.queuedTurnStarts.push({
      jsonrpc: "2.0",
      id: null,
      method: "turn/start",
      params: { threadId: thread.id, input: params.input },
    } as unknown as JsonRpcRequest);
    if (thread.running) {
      await this.#cancelActiveExternalTurnForSteer(thread);
      return;
    }
    this.#dispatchQueuedExternalTurn(thread);
  }

  async #cancelActiveExternalTurnForSteer(thread: ExternalThread): Promise<void> {
    if (!thread.running || !thread.activeTurnId) {
      this.#dispatchQueuedExternalTurn(thread);
      return;
    }
    if (thread.retainQueuedTurnsAfterInterrupt) return;
    thread.retainQueuedTurnsAfterInterrupt = true;
    const result = await thread.session.execute({
      type: "turn.cancel",
      turnId: thread.activeTurnId,
    });
    if (result.ok) return;
    thread.retainQueuedTurnsAfterInterrupt = false;
    this.#diagnose(`External steer could not cancel the active Turn: ${result.error.message}`);
  }

  #dispatchQueuedExternalTurn(thread: ExternalThread): void {
    if (thread.running) return;
    const head = thread.queuedTurnStarts[0];
    if (!head) return;
    if (isDetachedSteerClone(head)) {
      const next = thread.queuedTurnStarts.shift();
      if (!next) return;
      void this.#startExternalTurn(next, thread).catch((error) => {
        this.#diagnose(error);
      });
      return;
    }
    const batch: JsonRpcRequest[] = [];
    while (thread.queuedTurnStarts[0] && !isDetachedSteerClone(thread.queuedTurnStarts[0])) {
      const item = thread.queuedTurnStarts.shift();
      if (item) batch.push(item);
    }
    const [first, ...rest] = batch;
    if (!first) return;
    if (rest.length === 0) {
      void this.#startExternalTurn(first, thread).catch((error) => {
        this.#diagnose(error);
      });
      return;
    }
    let combinedText: string;
    try {
      combinedText = batch.map((queued) => requestText(requestObject(queued))).join("\n\n");
    } catch (error) {
      void Promise.all(
        batch.map((queued) => this.#writer.json(rpcError(queued, -32602, errorMessage(error)))),
      ).then(() => this.#dispatchQueuedExternalTurn(thread));
      return;
    }
    const combined = {
      ...first,
      params: { ...requestObject(first), input: [{ type: "text", text: combinedText }] },
    } as unknown as JsonRpcRequest;
    void this.#startExternalTurn(combined, thread, rest).catch((error) => {
      this.#diagnose(error);
    });
  }

  async #flushQueuedExternalTurns(thread: ExternalThread, message: string): Promise<void> {
    const queued = thread.queuedTurnStarts.splice(0);
    for (const request of queued) {
      // Steered clones were answered at enqueue time; only held turn/start
      // requests still owe the Desktop an explicit failure.
      if (request.id === null) continue;
      await this.#writer.json(rpcError(request, -32072, message));
    }
  }

  async #materializeSubagent(
    parent: ExternalThread,
    subagent: HostSubagentState,
  ): Promise<HostSubagentState> {
    if (!subagent.nativeSubagentId || !parent.record.nativeSessionRef) return subagent;
    const status =
      subagent.status === "pending" || subagent.status === "running" ? "active" : "idle";
    const records = await this.#repository.list();
    const existing = records.find(
      (record) =>
        record.subagent?.parentHostThreadId === parent.id &&
        record.subagent.nativeSubagentId === subagent.nativeSubagentId,
    );
    if (existing) {
      this.#trackRunningSubagent(parent.id, existing.hostThreadId, status);
      await this.#setSubagentThreadStatus(existing.hostThreadId, status);
      return { ...subagent, subagentId: existing.hostThreadId };
    }
    const recordInput = createExternalThreadRecordInput({
      harnessId: parent.record.harnessId,
      cwd: parent.cwd,
      title: subagent.description,
      transportModelId: parent.transportModelId,
      ephemeral: false,
      historyMode: "paginated",
      subagent: {
        parentHostThreadId: parent.id,
        nativeSubagentId: subagent.nativeSubagentId,
        ...(subagent.role ? { role: subagent.role } : {}),
      },
    });
    let record = await this.#repository.createProvisional(recordInput);
    record = await this.#repository.commitNative(
      record.hostThreadId,
      parent.record.nativeSessionRef,
    );
    const thread = externalThreadValue({
      record,
      turns: [],
      sessionId: parent.sessionId,
      running: status === "active",
    });
    this.#subagentThreadStatuses.set(record.hostThreadId, status);
    this.#trackRunningSubagent(parent.id, record.hostThreadId, status);
    await this.#writer.json({
      method: "thread/started",
      emittedAtMs: Date.now(),
      params: { thread },
    });
    return { ...subagent, subagentId: record.hostThreadId };
  }

  async #refreshOpenSubagentThread(threadId: string, terminal = true): Promise<void> {
    const child = this.#externalRuntime.get(threadId);
    if (!child) return;
    const previousItems = new Map(
      child.turns.flatMap((turn) =>
        Array.isArray(turn.items)
          ? turn.items.flatMap((item) =>
              isRecord(item) && typeof item.id === "string"
                ? ([[item.id, JSON.stringify(item)]] as const)
                : [],
            )
          : [],
      ),
    );
    const refreshed = await this.#refreshExternalThread(child);
    if (refreshed) {
      this.#diagnose(refreshed.message);
      return;
    }
    const emittedAtMs = Date.now();
    for (const turn of child.turns) {
      if (typeof turn.id !== "string" || !Array.isArray(turn.items)) continue;
      const changedItems = turn.items.filter(
        (item): item is JsonObject =>
          isRecord(item) &&
          typeof item.id === "string" &&
          previousItems.get(item.id) !== JSON.stringify(item),
      );
      if (changedItems.length > 0) {
        await this.#writer.json({
          method: "turn/started",
          emittedAtMs,
          params: {
            threadId,
            turn: {
              ...turn,
              status: "inProgress",
              completedAt: null,
              durationMs: null,
            },
          },
        });
      }
      for (const item of changedItems) {
        await this.#writer.json({
          method: "item/started",
          emittedAtMs,
          params: {
            threadId,
            turnId: turn.id,
            startedAtMs: emittedAtMs,
            item,
          },
        });
        await this.#writer.json({
          method: "item/completed",
          emittedAtMs,
          params: {
            threadId,
            turnId: turn.id,
            completedAtMs: emittedAtMs,
            item,
          },
        });
      }
      if (terminal) {
        await this.#writer.json({
          method: "turn/completed",
          emittedAtMs,
          params: { threadId, turn },
        });
      }
    }
  }

  #trackRunningSubagent(
    parentThreadId: string,
    childThreadId: string,
    status: "active" | "idle",
  ): void {
    let running = this.#runningSubagentsByParent.get(parentThreadId);
    if (status === "active") {
      if (!running) {
        running = new Set();
        this.#runningSubagentsByParent.set(parentThreadId, running);
      }
      running.add(childThreadId);
      return;
    }
    if (!running) return;
    running.delete(childThreadId);
    if (running.size === 0) this.#runningSubagentsByParent.delete(parentThreadId);
  }

  #hasRunningSubagents(parentThreadId: string): boolean {
    return (this.#runningSubagentsByParent.get(parentThreadId)?.size ?? 0) > 0;
  }

  async #setSubagentThreadStatus(threadId: string, status: "active" | "idle"): Promise<void> {
    const previousStatus = this.#subagentThreadStatuses.get(threadId);
    const child = this.#externalRuntime.get(threadId);
    if (child) {
      child.running = status === "active";
      if (status === "idle") child.historyHydrated = false;
      child.thread = externalThreadValue({
        record: child.record,
        turns: child.turns,
        sessionId: child.sessionId,
        running: child.running,
      });
    }
    if (status === "idle" && previousStatus === "active") {
      for (const [index, waitMs] of SUBAGENT_TERMINAL_REFRESH_DELAYS_MS.entries()) {
        if (waitMs > 0) await delay(waitMs);
        await this.#refreshOpenSubagentThread(
          threadId,
          index === SUBAGENT_TERMINAL_REFRESH_DELAYS_MS.length - 1,
        );
      }
    }
    if (previousStatus === status) return;
    this.#subagentThreadStatuses.set(threadId, status);
    await this.#writer.json({
      method: "thread/status/changed",
      emittedAtMs: Date.now(),
      params: {
        threadId,
        status: status === "active" ? { type: "active", activeFlags: [] } : { type: "idle" },
      },
    });
  }

  /**
   * The source Thread a loaded side chat rolls up to. A side chat is an
   * ephemeral derived Thread (`forkSource` + `ephemeral`): every listing
   * hides it and Desktop shows it inside its source, spinning the source's
   * sidebar row while the side chat works. A list consumer that only sees the
   * source must therefore see the side chat's activity on the source row, or
   * it reads "completed" while Desktop reads "running". Nested side chats
   * climb through loaded Threads; an unloaded source is treated as the root.
   * Returns null for a Thread that is not a side chat.
   */
  #sideChatRootId(record: StoredThreadRecordV1): string | null {
    if (!isEphemeralDerivedThread(record)) return null;
    let current: StoredThreadRecordV1 = record;
    const visited = new Set<string>([record.hostThreadId]);
    while (isEphemeralDerivedThread(current) && current.forkSource) {
      const sourceId = current.forkSource.hostThreadId;
      if (visited.has(sourceId)) return null;
      visited.add(sourceId);
      const source = this.#externalRuntime.get(sourceId);
      if (!source) return sourceId;
      current = source.record;
    }
    return current.hostThreadId;
  }

  #sideChatRunningUnder(threadId: string): boolean {
    return this.#externalRuntime
      .values()
      .some((child) => child.running && this.#sideChatRootId(child.record) === threadId);
  }

  #delegationListStatus(threadId: string, entryStatus: unknown): DelegationThreadStatus {
    const thread = this.#externalRuntime.get(threadId);
    if (thread) {
      if (thread.running || this.#sideChatRunningUnder(threadId)) return "running";
      const last = thread.turns.at(-1);
      const lastStatus = isRecord(last) ? last.status : undefined;
      if (lastStatus === "failed") return "failed";
      if (lastStatus === "interrupted" || lastStatus === "cancelled") return "interrupted";
      if (last) return "completed";
      return "creating";
    }
    if (this.#sideChatRunningUnder(threadId)) return "running";
    return isRecord(entryStatus) && entryStatus.type === "active" ? "running" : "completed";
  }

  #delegationListAttention(threadId: string): "input" | "approval" | undefined {
    const owns = (candidate: ExternalThread): boolean =>
      candidate.record.hostThreadId === threadId ||
      this.#sideChatRootId(candidate.record) === threadId;
    for (const pending of this.#pendingDesktopQuestions.values()) {
      if (owns(pending.thread)) return "input";
    }
    for (const pending of this.#pendingDesktopApprovals.values()) {
      if (owns(pending.thread)) return "approval";
    }
    return undefined;
  }

  async #projectApproval(
    thread: ExternalThread,
    interaction: HostApprovalInteraction,
  ): Promise<void> {
    const projection = this.#projectedTurn(thread, interaction.turnId);
    await this.#waitForTurnResponse(thread, interaction.turnId);
    let result: CodexApprovalProjection;
    try {
      result = projection.projector.projectApproval(
        interaction,
        approvalServerName(thread.harnessId),
      );
    } catch (error) {
      this.#diagnose(error);
      thread.ignoredInteractionIds.add(interaction.interactionId);
      const denied = await this.#denyApproval(thread, interaction);
      if (!denied) thread.ignoredInteractionIds.delete(interaction.interactionId);
      return;
    }
    for (const message of result.messages) await this.#writer.json(message);

    const requestId = this.#allocateApprovalRequestId();
    const pending: PendingDesktopApproval = {
      thread,
      interaction,
      projection: result.approvalRequest,
    };
    this.#pendingDesktopApprovals.set(requestId, pending);
    try {
      await this.#writer.json({ id: requestId, ...result.approvalRequest.request });
    } catch (error) {
      this.#pendingDesktopApprovals.delete(requestId);
      await this.#denyApproval(thread, interaction);
      throw error;
    }
  }

  async #handleDesktopApprovalResponse(value: JsonValue): Promise<boolean> {
    if (!isRecord(value) || !isHostApprovalRequestId(value.id)) return false;
    const pending = this.#pendingDesktopApprovals.get(value.id);
    if (!pending) return true;
    this.#pendingDesktopApprovals.delete(value.id);

    let response: HostApprovalResponse;
    try {
      response =
        "error" in value
          ? pending.projection.denyResponse
          : pending.projection.parseResponse(value.result);
    } catch (error) {
      this.#diagnose(error);
      response = pending.projection.denyResponse;
    }
    const result = await pending.thread.session.execute({
      type: "interaction.respond",
      interactionId: pending.interaction.interactionId,
      response,
    });
    if (!result.ok && result.error.code !== "invalidState") {
      this.#diagnose(`Approval response failed: ${result.error.message}`);
      const cancelled = await pending.thread.session.execute({
        type: "turn.cancel",
        turnId: pending.interaction.turnId,
      });
      if (!cancelled.ok && cancelled.error.code !== "invalidState") {
        this.#diagnose(`Approval fail-closed cancellation failed: ${cancelled.error.message}`);
      }
    }
    return true;
  }

  async #denyApproval(
    thread: ExternalThread,
    interaction: HostApprovalInteraction,
  ): Promise<boolean> {
    const denyActions = interaction.actions.filter(({ effect }) => effect === "deny");
    if (denyActions.length !== 1) {
      const cancelled = await thread.session.execute({
        type: "turn.cancel",
        turnId: interaction.turnId,
      });
      if (!cancelled.ok) {
        this.#diagnose(`Unsupported Approval cancellation failed: ${cancelled.error.message}`);
      }
      return cancelled.ok;
    }
    const action = denyActions[0];
    if (!action) return false;
    const denied = await thread.session.execute({
      type: "interaction.respond",
      interactionId: interaction.interactionId,
      response: { type: "approval", actionId: action.id },
    });
    if (!denied.ok) {
      this.#diagnose(`Unsupported Approval denial failed: ${denied.error.message}`);
    }
    return denied.ok;
  }

  async #resolveDesktopApproval(interactionId: HostInteractionId): Promise<void> {
    for (const [requestId, pending] of this.#pendingDesktopApprovals) {
      if (pending.interaction.interactionId !== interactionId) continue;
      this.#pendingDesktopApprovals.delete(requestId);
      await this.#writer.json({
        method: "serverRequest/resolved",
        params: { threadId: pending.thread.id, requestId },
      });
    }
  }

  #allocateApprovalRequestId(): HostApprovalRequestId {
    if (this.#nextApprovalRequestId < HOST_APPROVAL_REQUEST_ID_MIN) {
      throw new Error("Host Approval Request ID namespace is exhausted");
    }
    const requestId = this.#nextApprovalRequestId;
    this.#nextApprovalRequestId -= 1;
    return requestId;
  }

  async #projectQuestion(
    thread: ExternalThread,
    interaction: HostQuestionInteraction,
  ): Promise<void> {
    const projection = this.#projectedTurn(thread, interaction.turnId);
    await this.#waitForTurnResponse(thread, interaction.turnId);
    let result: CodexQuestionProjection;
    try {
      result = projection.projector.projectQuestion(
        interaction,
        hostItemIdSchema.parse(randomUUID()),
      );
    } catch (error) {
      this.#diagnose(error);
      thread.ignoredInteractionIds.add(interaction.interactionId);
      const cancelled = await thread.session.execute({
        type: "interaction.respond",
        interactionId: interaction.interactionId,
        response: { type: "question", answers: {}, cancelled: true },
      });
      if (!cancelled.ok) {
        thread.ignoredInteractionIds.delete(interaction.interactionId);
        this.#diagnose(`Unsupported Question cancellation failed: ${cancelled.error.message}`);
      }
      return;
    }
    for (const message of result.messages) await this.#writer.json(message);

    const requestId = this.#allocateQuestionRequestId();
    const expiresAtMs = interaction.expiresAt ? Date.parse(interaction.expiresAt) : Number.NaN;
    const timeoutMs = Number.isFinite(expiresAtMs) ? Math.max(0, expiresAtMs - Date.now()) : null;
    const pending: PendingDesktopQuestion = {
      thread,
      interaction,
      projection: result.questionRequest,
      timeout: null,
    };
    if (timeoutMs !== null) {
      pending.timeout = setTimeout(() => {
        void this.#cancelExpiredQuestion(requestId);
      }, timeoutMs);
    }
    this.#pendingDesktopQuestions.set(requestId, pending);
    try {
      await this.#writer.json({ id: requestId, ...result.questionRequest.request });
    } catch (error) {
      this.#retireDesktopQuestion(interaction.interactionId);
      await thread.session
        .execute({
          type: "interaction.respond",
          interactionId: interaction.interactionId,
          response: { type: "question", answers: {}, cancelled: true },
        })
        .catch(() => undefined);
      throw error;
    }
  }

  async #handleDesktopQuestionResponse(value: JsonValue): Promise<boolean> {
    if (!isRecord(value) || !isHostQuestionRequestId(value.id)) return false;
    const pending = this.#pendingDesktopQuestions.get(value.id);
    if (!pending) return true;
    this.#pendingDesktopQuestions.delete(value.id);
    if (pending.timeout) clearTimeout(pending.timeout);

    let response;
    try {
      response =
        "error" in value
          ? { type: "question" as const, answers: {}, cancelled: true as const }
          : pending.projection.parseResponse(value.result);
    } catch (error) {
      this.#diagnose(error);
      response = { type: "question" as const, answers: {}, cancelled: true as const };
    }
    const result = await pending.thread.session.execute({
      type: "interaction.respond",
      interactionId: pending.interaction.interactionId,
      response,
    });
    if (!result.ok && result.error.code !== "invalidState") {
      this.#diagnose(`Question response failed: ${result.error.message}`);
    }
    return true;
  }

  async #cancelExpiredQuestion(requestId: HostQuestionRequestId): Promise<void> {
    const pending = this.#pendingDesktopQuestions.get(requestId);
    if (!pending) return;
    await this.#resolveDesktopQuestion(pending.interaction.interactionId);
    const result = await pending.thread.session.execute({
      type: "interaction.respond",
      interactionId: pending.interaction.interactionId,
      response: { type: "question", answers: {}, cancelled: true },
    });
    if (!result.ok && result.error.code !== "invalidState") {
      this.#diagnose(`Question expiry failed: ${result.error.message}`);
    }
  }

  #retireDesktopQuestion(interactionId: HostInteractionId): void {
    for (const [requestId, pending] of this.#pendingDesktopQuestions) {
      if (pending.interaction.interactionId !== interactionId) continue;
      if (pending.timeout) clearTimeout(pending.timeout);
      this.#pendingDesktopQuestions.delete(requestId);
    }
  }

  async #resolveDesktopQuestion(interactionId: HostInteractionId): Promise<void> {
    for (const [requestId, pending] of this.#pendingDesktopQuestions) {
      if (pending.interaction.interactionId !== interactionId) continue;
      if (pending.timeout) clearTimeout(pending.timeout);
      this.#pendingDesktopQuestions.delete(requestId);
      await this.#writer.json({
        method: "serverRequest/resolved",
        params: { threadId: pending.thread.id, requestId },
      });
    }
  }

  #allocateQuestionRequestId(): HostQuestionRequestId {
    if (this.#nextQuestionRequestId < HOST_QUESTION_REQUEST_ID_MIN) {
      throw new Error("Host Question Request ID namespace is exhausted");
    }
    const requestId = this.#nextQuestionRequestId;
    this.#nextQuestionRequestId -= 1;
    return requestId;
  }

  async #setThreadStatus(thread: ExternalThread, status: ExternalThreadStatus): Promise<void> {
    thread.thread.status = status;
    await this.#writer.json({
      method: "thread/status/changed",
      emittedAtMs: Date.now(),
      params: { threadId: thread.id, status },
    });
  }

  #projectedTurn(thread: ExternalThread, turnId: HostTurnId): ProjectedTurn {
    const projection = thread.projectedTurns.get(turnId);
    if (!projection) throw new Error("Harness output references an unknown Host Turn");
    return projection;
  }

  async #waitForTurnResponse(thread: ExternalThread, turnId: HostTurnId): Promise<void> {
    await thread.responseGates.get(turnId)?.promise;
  }

  #latestCompletedTurnId(thread: ExternalThread): HostTurnId | null {
    const parsed = hostTurnIdSchema.safeParse(thread.turns.at(-1)?.id);
    return parsed.success ? parsed.data : null;
  }

  #isKnownExternalTurn(thread: ExternalThread, turnId: HostTurnId): boolean {
    return thread.projectedTurns.has(turnId) || thread.turns.some((turn) => turn.id === turnId);
  }

  async #replayExternalUsage(thread: ExternalThread): Promise<void> {
    const latestTurnId = this.#latestCompletedTurnId(thread);
    if (!latestTurnId || !thread.latestUsage) return;
    thread.usageTurnId = latestTurnId;
    await this.#writeExternalUsage(thread, latestTurnId);
  }

  async #writeExternalUsage(thread: ExternalThread, turnId: HostTurnId): Promise<void> {
    const usage = thread.latestUsage;
    if (!usage || this.#externalRuntime.get(thread.id) !== thread) return;
    const projection = projectCodexThreadUsage({ threadId: thread.id, turnId, usage });
    if (!projection) return;
    await this.#waitForTurnResponse(thread, turnId);
    if (
      this.#externalRuntime.get(thread.id) !== thread ||
      thread.latestUsage !== usage ||
      thread.usageTurnId !== turnId
    ) {
      return;
    }
    await this.#writer.json(projection);
  }

  #dispatchDesktopRequest(run: () => Promise<void>): void {
    void run().catch((error) => this.#diagnose(error));
  }

  #diagnose(error: unknown): void {
    this.#options.diagnosticOutput.write(`codexhost Host Runtime: ${errorMessage(error)}\n`);
  }
}
