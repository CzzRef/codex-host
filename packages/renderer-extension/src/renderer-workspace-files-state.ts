import { hostThreadIdSchema, type ThreadWorkspaceSnapshot } from "@codexhost/shared-contracts";

import {
  conversationFilesFromItems,
  mergeConversationFiles,
  turnKeyMatches,
  type ThreadConversationFile,
} from "./renderer-conversation-files.js";
import type { RendererModelClient } from "./renderer-model-client.js";

/** Anonymous (Item-less) file updates merge under this key and never retire. */
const LEGACY_ITEM_KEY = "\u0000legacy";
const MAX_EXTRA_PATHS = 64;

/**
 * Per-Thread workspace truth for the Turn header's workspace row: the Host
 * workspace inspection and the conversation's File Change Items, kept in sync
 * through the Host notifications. No DOM.
 */
export interface WorkspaceFilesState {
  snapshot(threadId: string): ThreadWorkspaceSnapshot | null;
  files(threadId: string): ThreadConversationFile[];
  /** Paths touched by the File Change Items of one Turn (fuzzy Turn key). */
  turnFilePaths(threadId: string, turnKey: string | null): Set<string>;
  /** Inspects once per Thread; later calls are no-ops until `reset`. */
  ensureLoaded(threadId: string): void;
  load(threadId: string): void;
  /** Re-inspects with paths outside every known root so `external` roots resolve. */
  requestExtraPaths(threadId: string, unresolved: readonly string[]): void;
  /** (Re)subscribes to Host notifications when the client changes. */
  connect(): void;
  reset(): void;
  dispose(): void;
}

export function createWorkspaceFilesState(options: {
  getClient(): RendererModelClient | null;
  onChange(threadId: string): void;
}): WorkspaceFilesState {
  const snapshots = new Map<string, ThreadWorkspaceSnapshot | null>();
  const loaded = new Set<string>();
  const generations = new Map<string, number>();
  // Per Thread: File Change Item id -> that Item's current change set.
  const filesByItem = new Map<string, Map<string, ThreadConversationFile[]>>();
  const turnByItem = new Map<string, Map<string, string>>();
  // Absolute changed paths outside every inspected root, per Thread. They ride
  // along on every inspect so `external` rows survive re-inspection.
  const extraPathsByThread = new Map<string, string[]>();
  const requestedExtraPaths = new Map<string, string>();
  let subscribedClient: RendererModelClient | null = null;
  let unsubscribe: (() => void) | null = null;
  let disposed = false;

  const files = (threadId: string): ThreadConversationFile[] =>
    conversationFilesFromItems(filesByItem.get(threadId) ?? new Map());

  const load = (threadId: string): void => {
    const client = options.getClient();
    if (!client) {
      snapshots.set(threadId, null);
      options.onChange(threadId);
      return;
    }
    const generation = (generations.get(threadId) ?? 0) + 1;
    generations.set(threadId, generation);
    const extraPaths = extraPathsByThread.get(threadId) ?? [];
    void client
      .inspectThreadWorkspace({
        threadId: hostThreadIdSchema.parse(threadId),
        ...(extraPaths.length > 0 ? { extraPaths } : {}),
      })
      .then((snapshot) => {
        if (disposed || generations.get(threadId) !== generation) return;
        snapshots.set(threadId, snapshot);
        options.onChange(threadId);
      })
      .catch(() => {
        if (disposed || generations.get(threadId) !== generation) return;
        loaded.delete(threadId);
        snapshots.set(threadId, null);
        options.onChange(threadId);
      });
  };

  const acceptSnapshot = (threadId: string, snapshot: ThreadWorkspaceSnapshot): void => {
    const knownExtraPaths = extraPathsByThread.get(threadId) ?? [];
    // A Host-side re-inspect triggered by a workspace notification does not
    // know this Thread's external paths; reload so `external` rows persist.
    if (
      knownExtraPaths.length > 0 &&
      !snapshot.repositories.some((repository) => repository.kind === "external")
    ) {
      load(threadId);
      return;
    }
    snapshots.set(threadId, snapshot);
    options.onChange(threadId);
  };

  const connect = (): void => {
    const client = options.getClient();
    if (client === subscribedClient) return;
    unsubscribe?.();
    unsubscribe = null;
    subscribedClient = client;
    const unsubscribers: Array<() => void> = [];
    try {
      if (client?.subscribeThreadWorkspace) {
        unsubscribers.push(
          client.subscribeThreadWorkspace((snapshot) => {
            if (!disposed) acceptSnapshot(snapshot.threadId, snapshot);
          }),
        );
      }
      if (client?.subscribeThreadFileChanges) {
        unsubscribers.push(
          client.subscribeThreadFileChanges((update) => {
            if (disposed) return;
            const items =
              filesByItem.get(update.threadId) ?? new Map<string, ThreadConversationFile[]>();
            const turns = turnByItem.get(update.threadId) ?? new Map<string, string>();
            if (update.itemId === null) {
              // No Item identity: merge under one key per Turn (or one
              // Thread-wide key) so nothing is counted twice.
              const legacyKey = update.turnId
                ? `${LEGACY_ITEM_KEY}:${update.turnId}`
                : LEGACY_ITEM_KEY;
              items.set(
                legacyKey,
                mergeConversationFiles(items.get(legacyKey) ?? [], update.files),
              );
              if (update.turnId) turns.set(legacyKey, update.turnId);
            } else if (update.files.length === 0) {
              items.delete(update.itemId);
              turns.delete(update.itemId);
            } else {
              items.set(update.itemId, [...update.files]);
              if (update.turnId) turns.set(update.itemId, update.turnId);
            }
            filesByItem.set(update.threadId, items);
            turnByItem.set(update.threadId, turns);
            options.onChange(update.threadId);
          }),
        );
      }
    } catch {
      // Fail closed: a request manager that refuses subscriptions leaves the
      // row on its last inspection instead of throwing into the Renderer.
      subscribedClient = null;
      return;
    }
    unsubscribe = () => {
      for (const stop of unsubscribers) stop();
    };
  };

  return {
    snapshot: (threadId) => snapshots.get(threadId) ?? null,
    files,
    turnFilePaths(threadId, turnKey) {
      const paths = new Set<string>();
      if (!turnKey) return paths;
      const items = filesByItem.get(threadId);
      const turns = turnByItem.get(threadId);
      if (!items || !turns) return paths;
      for (const [itemId, turnId] of turns) {
        if (!turnKeyMatches(turnKey, turnId) && !turnKeyMatches(turnId, turnKey)) continue;
        for (const file of items.get(itemId) ?? []) paths.add(file.path);
      }
      return paths;
    },
    ensureLoaded(threadId) {
      if (loaded.has(threadId)) return;
      loaded.add(threadId);
      load(threadId);
    },
    load,
    requestExtraPaths(threadId, unresolved) {
      const merged = [
        ...new Set([...(extraPathsByThread.get(threadId) ?? []), ...unresolved]),
      ].slice(0, MAX_EXTRA_PATHS);
      extraPathsByThread.set(threadId, merged);
      const key = merged.join("\n");
      if (requestedExtraPaths.get(threadId) === key) return;
      requestedExtraPaths.set(threadId, key);
      load(threadId);
    },
    connect,
    reset() {
      snapshots.clear();
      loaded.clear();
      generations.clear();
      filesByItem.clear();
      turnByItem.clear();
      extraPathsByThread.clear();
      requestedExtraPaths.clear();
      subscribedClient = null;
      unsubscribe?.();
      unsubscribe = null;
    },
    dispose() {
      disposed = true;
      unsubscribe?.();
      unsubscribe = null;
      subscribedClient = null;
    },
  };
}
