import type { HarnessAdapter } from "@codexhost/harness-adapter";
import {
  mapExternalThreadHarnessError,
  type ExternalHarnessId,
  type ExternalThreadRpcError,
  type JsonObject,
} from "@codexhost/protocol-core";
import { hostThreadIdSchema, type NativeSessionRef } from "@codexhost/shared-contracts";

import { DELEGATION_THREAD_ID_ENV } from "./delegation-types.js";
import {
  currentConfiguration,
  restoreCurrentConfiguration,
  sameCurrentConfiguration,
} from "./external-thread-rollback.js";
import {
  externalThreadValue,
  type ExternalThreadRepository,
} from "./external-thread-repository.js";
import type { ExternalThread, ExternalThreadRuntime } from "./external-thread-runtime.js";

export type ExternalThreadRedoResult =
  { ok: false; error: ExternalThreadRpcError } | { ok: true; thread: JsonObject };

export function decodeThreadRedoRequest(request: {
  method?: unknown;
  params?: unknown;
}): { threadId: string } | null {
  if (request.method !== "codexhost/thread/redo") return null;
  const params = request.params;
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    throw new Error("codexhost/thread/redo params must be an object");
  }
  const threadId = (params as { threadId?: unknown }).threadId;
  if (typeof threadId !== "string" || threadId.length === 0) {
    throw new Error("codexhost/thread/redo params.threadId must be non-empty text");
  }
  return { threadId: hostThreadIdSchema.parse(threadId) };
}

export async function executeExternalThreadRedo(input: {
  current: ExternalThread;
  adapters: Map<ExternalHarnessId, HarnessAdapter>;
  repository: ExternalThreadRepository;
  runtime: ExternalThreadRuntime;
  environment?: NodeJS.ProcessEnv;
}): Promise<ExternalThreadRedoResult> {
  const { current, adapters, repository, runtime } = input;
  if (current.running) {
    return { ok: false, error: { code: -32072, message: "External Thread has an active Turn" } };
  }
  const refreshError = await runtime.refresh(current);
  if (refreshError) return { ok: false, error: refreshError };
  const historyRedo = current.record.historyRedo;
  if (!historyRedo) {
    return {
      ok: false,
      error: { code: -32076, message: "External Thread has no last-Turn Redo slot" },
    };
  }
  const adapter = adapters.get(current.harnessId);
  if (!adapter) {
    return {
      ok: false,
      error: { code: -32079, message: "External Native Session is unavailable" },
    };
  }

  let opened: Awaited<ReturnType<HarnessAdapter["open"]>>;
  try {
    opened = await adapter.open({
      kind: "resume",
      cwd: current.cwd,
      environment: {
        ...(input.environment ?? process.env),
        [DELEGATION_THREAD_ID_ENV]: current.id,
      },
      nativeRef: historyRedo.nativeSessionRef as NativeSessionRef,
      knownTurnRefs: historyRedo.turnMappings.map((mapping) => mapping.nativeTurnRef),
    });
  } catch {
    return { ok: false, error: { code: -32076, message: "External Thread redo failed" } };
  }
  if (!opened.ok) {
    return { ok: false, error: mapExternalThreadHarnessError(opened.error, "resume") };
  }

  const session = opened.value;
  const finalNativeRef = session.initialState.nativeRef;
  if (
    !finalNativeRef ||
    finalNativeRef.harnessId !== current.harnessId ||
    finalNativeRef.nativeSessionId !== historyRedo.nativeSessionRef.nativeSessionId
  ) {
    await session.close().catch(() => undefined);
    return {
      ok: false,
      error: { code: -32076, message: "External redo did not return the stashed Session" },
    };
  }
  const configuration = currentConfiguration(current);
  const configurationError = await restoreCurrentConfiguration(session, configuration);
  if (configurationError) {
    await session.close().catch(() => undefined);
    return { ok: false, error: configurationError };
  }
  const snapshot = await session.readSnapshot();
  if (!snapshot.ok) {
    await session.close().catch(() => undefined);
    return { ok: false, error: mapExternalThreadHarnessError(snapshot.error, "read") };
  }
  if (snapshot.value.turns.length !== historyRedo.turnMappings.length) {
    await session.close().catch(() => undefined);
    return {
      ok: false,
      error: { code: -32080, message: "External redo did not restore the stashed Turns" },
    };
  }
  const replacementState = snapshot.value.state ?? session.initialState;
  if (!sameCurrentConfiguration(configuration, replacementState)) {
    await session.close().catch(() => undefined);
    return {
      ok: false,
      error: { code: -32080, message: "External redo changed configuration" },
    };
  }

  let aligned;
  try {
    aligned = await repository.commitLastTurnRedo(
      current.record,
      finalNativeRef as NativeSessionRef,
      snapshot.value,
    );
  } catch {
    await session.close().catch(() => undefined);
    return {
      ok: false,
      error: { code: -32081, message: "External redo could not be persisted" },
    };
  }
  const thread = externalThreadValue({
    record: aligned.record,
    turns: aligned.turns,
    sessionId: current.sessionId,
  });
  await runtime.replace(current, {
    record: aligned.record,
    session,
    sessionId: current.sessionId,
    thread,
    turns: aligned.turns,
    restoredState: replacementState,
  });
  return { ok: true, thread };
}
