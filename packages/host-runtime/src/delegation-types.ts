import type { RoutedHarnessId } from "@codexhost/protocol-core";
import type {
  HarnessInspection,
  HarnessModelRef,
  HarnessPermissionModeId,
  HarnessSessionState,
  HarnessThinkingOptionId,
} from "@codexhost/harness-adapter";

export const DELEGATION_RUNTIME_ENDPOINT_ENV = "CODEXHOST_RUNTIME_ENDPOINT";
export const DELEGATION_RUNTIME_TOKEN_ENV = "CODEXHOST_RUNTIME_TOKEN";
export const DELEGATION_CLI_PATH_ENV = "CODEXHOST_CLI_PATH";
export const DELEGATION_THREAD_ID_ENV = "CODEXHOST_THREAD_ID";

export type DelegationThreadStatus =
  "creating" | "running" | "completed" | "failed" | "interrupted";

export type DelegationResultAvailability = "pending" | "available" | "unavailable";

export interface DelegationMessage {
  id: string;
  turnId: string;
  role: "user" | "agent";
  text: string;
  phase?: "commentary" | "final";
}

export interface DelegationProgress {
  id: string;
  turnId: string;
  text: string;
}

export interface DelegationThreadSnapshot {
  threadId: string;
  harnessId: RoutedHarnessId;
  status: DelegationThreadStatus;
  turn: { turnId: string; status: DelegationThreadStatus } | null;
  progress: DelegationProgress[];
  result: {
    availability: DelegationResultAvailability;
    text?: string;
    message?: string;
  };
  messages?: DelegationMessage[];
  nextCursor: string | null;
}

export interface DelegationStartInput {
  harnessId: RoutedHarnessId;
  task: string;
  cwd: string;
  parentThreadId?: string;
  requestId?: string;
  model?: HarnessModelRef;
  thinkingOptionId?: HarnessThinkingOptionId;
  /** Harness Permission Mode id from `harness inspect` permissionModes; the child runs in it from its first Turn. */
  permissionModeId?: HarnessPermissionModeId;
}

export interface HarnessInspectInput {
  harnessId: RoutedHarnessId;
  cwd?: string;
  refresh?: boolean;
}

export interface HarnessInspectResult {
  harnessId: RoutedHarnessId;
  inspection: HarnessInspection;
}

export interface DelegationConfigurationResult {
  requested?: {
    model?: HarnessModelRef;
    thinkingOptionId?: HarnessThinkingOptionId;
    permissionModeId?: HarnessPermissionModeId;
  };
  effective?: Pick<
    HarnessSessionState,
    | "effectiveModel"
    | "resolvedModelLabel"
    | "effectiveThinkingOptionId"
    | "effectivePermissionModeId"
  >;
}

export interface DelegationStartResult {
  delegationId: string;
  threadId: string;
  turnId: string;
  harnessId: RoutedHarnessId;
  deepLink: string;
  status: DelegationThreadStatus;
  configuration?: DelegationConfigurationResult;
  next: { read: string; wait: string };
}

export interface ThreadSendInput {
  threadId: string;
  message: string;
  /**
   * Inject into the active Turn through the Harness's native steer instead of
   * failing with THREAD_BUSY. Only honored while a Turn runs and the Session
   * declares `turns.steer`; an idle Thread starts a new Turn as usual.
   */
  steer?: boolean;
}

export interface ThreadSendResult {
  threadId: string;
  turnId: string;
  harnessId: RoutedHarnessId;
  status: "running";
  next: { read: string; wait: string };
}

export interface ThreadCancelInput {
  threadId: string;
}

export interface ThreadCancelResult {
  threadId: string;
  turnId: string | null;
  harnessId: RoutedHarnessId;
  cancelled: boolean;
}

export interface ThreadReadInput {
  threadId: string;
  view: "result" | "messages";
  cursor?: string;
  limit?: number;
}

export interface ThreadWaitInput extends ThreadReadInput {
  timeoutMs: number;
}

export interface ThreadRenameInput {
  threadId: string;
  name: string;
}

export interface ThreadRenameResult {
  threadId: string;
  title: string;
}

export interface ThreadArchiveInput {
  threadId: string;
  /** Defaults to true; false restores the Thread to the live listing. */
  archived?: boolean;
}

export interface ThreadArchiveResult {
  threadId: string;
  archived: boolean;
}

export interface ThreadPinInput {
  threadId: string;
  /** Defaults to true; false moves the Thread out of the Desktop Pinned section. */
  pinned?: boolean;
}

export interface ThreadPinResult {
  threadId: string;
  pinned: boolean;
}

export interface ThreadListInput {
  cwd?: string;
  parentThreadId?: string;
  /**
   * List archived Threads instead of live ones. Defaults to false like the
   * Desktop's `thread/list`; an archived external Thread never appears in the
   * live listing, so a consumer reconciles archive state with a second call.
   */
  archived?: boolean;
  limit: number;
  cursor?: string;
  sort:
    | "created-asc"
    | "created-desc"
    | "updated-asc"
    | "updated-desc"
    | "recency-asc"
    | "recency-desc";
}

export interface DelegationThreadListItem {
  threadId: string;
  harnessId: RoutedHarnessId;
  deepLink: string;
  status: DelegationThreadStatus;
  /** Host-owned unread for external Threads only: true while the latest
   * finished Turn has not been viewed in the Desktop. Absent for native
   * Codex rows, whose unread authority stays with the Desktop. */
  hasUnreadTurn?: boolean;
  /** External Threads only: present while the current Turn is blocked on a
   * pending Desktop question (`input`) or approval (`approval`). A pending
   * question wins when both exist. */
  attention?: "approval" | "input";
  /** External Threads only: the Host-persisted archive state of the row.
   * Native Codex rows omit it; the Desktop stays their archive authority. */
  archived?: boolean;
  /** External Threads only: whether the Host holds the row in the Desktop
   * Pinned section. Native Codex rows omit it; their pin lives in the
   * app-server section. */
  pinned?: boolean;
  cwd?: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DelegationThreadListResult {
  threads: DelegationThreadListItem[];
  nextCursor: string | null;
}

export interface DelegationControlApi {
  inspect(input: HarnessInspectInput): Promise<HarnessInspectResult>;
  start(input: DelegationStartInput): Promise<DelegationStartResult>;
  send(input: ThreadSendInput): Promise<ThreadSendResult>;
  cancel(input: ThreadCancelInput): Promise<ThreadCancelResult>;
  read(input: ThreadReadInput): Promise<DelegationThreadSnapshot>;
  wait(input: ThreadWaitInput): Promise<DelegationThreadSnapshot & { timedOut: boolean }>;
  list(input: ThreadListInput): Promise<DelegationThreadListResult>;
  rename(input: ThreadRenameInput): Promise<ThreadRenameResult>;
  archive(input: ThreadArchiveInput): Promise<ThreadArchiveResult>;
  pin(input: ThreadPinInput): Promise<ThreadPinResult>;
}

export interface DelegationControlRegistration extends DelegationControlApi {
  canHandleStart(input: DelegationStartInput): boolean | Promise<boolean>;
  ownsThread(threadId: string): boolean | Promise<boolean>;
}

export type DelegationControlErrorCode =
  | "INVALID_ARGUMENT"
  | "HARNESS_NOT_FOUND"
  | "THREAD_NOT_FOUND"
  | "THREAD_BUSY"
  | "PARENT_THREAD_AMBIGUOUS"
  | "RUNTIME_UNREACHABLE"
  | "DELEGATION_FAILED"
  | "INTERNAL_ERROR";

export class DelegationControlError extends Error {
  constructor(
    readonly code: DelegationControlErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DelegationControlError";
  }
}
