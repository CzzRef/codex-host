import { hostThreadIdSchema } from "@codexhost/shared-contracts";

export const THREAD_FILE_CHANGE_UPDATED_METHOD = "item/fileChange/patchUpdated";

export interface ThreadConversationFile {
  path: string;
  addedLines: number;
  deletedLines: number;
}

export interface ThreadConversationFileUpdate {
  threadId: string;
  files: ThreadConversationFile[];
}

export function diffLineStats(diff: string): { addedLines: number; deletedLines: number } {
  let addedLines = 0;
  let deletedLines = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("\\")) continue;
    if (line.startsWith("+")) addedLines += 1;
    else if (line.startsWith("-")) deletedLines += 1;
  }
  return { addedLines, deletedLines };
}

export function conversationFilesFromNotification(
  notification: unknown,
): { threadId: string; files: ThreadConversationFile[] } | null {
  if (
    typeof notification !== "object" ||
    notification === null ||
    !("method" in notification) ||
    notification.method !== THREAD_FILE_CHANGE_UPDATED_METHOD
  ) {
    return null;
  }
  const params =
    "params" in notification && typeof notification.params === "object" && notification.params
      ? (notification.params as Record<string, unknown>)
      : null;
  if (!params) return null;
  const threadId = hostThreadIdSchema.safeParse(params.threadId);
  if (!threadId.success || !Array.isArray(params.changes)) return null;
  const files: ThreadConversationFile[] = [];
  for (const change of params.changes) {
    if (typeof change !== "object" || change === null) continue;
    const record = change as Record<string, unknown>;
    if (typeof record.path !== "string" || record.path.trim().length === 0) continue;
    const stats =
      typeof record.diff === "string"
        ? diffLineStats(record.diff)
        : { addedLines: 0, deletedLines: 0 };
    files.push({ path: record.path, ...stats });
  }
  return files.length > 0 ? { threadId: threadId.data, files } : null;
}

export function mergeConversationFiles(
  current: readonly ThreadConversationFile[],
  incoming: readonly ThreadConversationFile[],
): ThreadConversationFile[] {
  const merged = new Map(current.map((file) => [file.path, file] as const));
  for (const file of incoming) merged.set(file.path, file);
  return [...merged.values()].sort((left, right) => left.path.localeCompare(right.path));
}
