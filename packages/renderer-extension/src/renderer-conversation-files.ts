import { hostThreadIdSchema } from "@codexhost/shared-contracts";

export const THREAD_FILE_CHANGE_UPDATED_METHOD = "item/fileChange/patchUpdated";

export const CONVERSATION_FILE_PREVIEW_MAX_LINES = 80;
export const CONVERSATION_FILE_PREVIEW_MAX_CHARS = 4_000;

export interface ThreadConversationFile {
  path: string;
  addedLines: number;
  deletedLines: number;
  preview: string;
}

export interface ThreadConversationFileUpdate {
  threadId: string;
  turnId: string | null;
  files: ThreadConversationFile[];
}

export function turnKeyMatches(turnKey: string, turnId: string): boolean {
  if (turnKey.length === 0 || turnId.length === 0) return false;
  if (turnKey === turnId) return true;
  if (turnKey.endsWith(`:${turnId}`) || turnId.endsWith(`:${turnKey}`)) return true;
  const keyTail = turnKey.split(":").at(-1);
  const idTail = turnId.split(":").at(-1);
  return Boolean(keyTail && idTail && keyTail === idTail);
}

export function filesForTurnSelection(
  byTurn: ReadonlyMap<string, readonly ThreadConversationFile[]>,
  selection: string | null,
): ThreadConversationFile[] | null {
  if (selection === null) return null;
  for (const [turnId, files] of byTurn) {
    if (turnKeyMatches(selection, turnId) || turnKeyMatches(turnId, selection)) {
      return [...files];
    }
  }
  return [];
}

export function diffPreview(diff: string): string {
  const lines: string[] = [];
  let chars = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff ") || line.startsWith("index ")) continue;
    if (lines.length >= CONVERSATION_FILE_PREVIEW_MAX_LINES) break;
    if (chars + line.length + 1 > CONVERSATION_FILE_PREVIEW_MAX_CHARS) break;
    lines.push(line);
    chars += line.length + 1;
  }
  return lines.join("\n").trimEnd();
}

export function reviewPathMatches(reviewPath: string, filePath: string): boolean {
  const review = reviewPath.replaceAll("\\", "/");
  const file = filePath.replaceAll("\\", "/").replace(/^\.\//, "");
  if (file.length === 0) return false;
  return review === file || review.endsWith(`/${file}`);
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
): ThreadConversationFileUpdate | null {
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
    files.push({
      path: record.path,
      ...stats,
      preview: typeof record.diff === "string" ? diffPreview(record.diff) : "",
    });
  }
  const turnId =
    typeof params.turnId === "string" && params.turnId.trim().length > 0
      ? params.turnId.trim()
      : null;
  return files.length > 0 ? { threadId: threadId.data, turnId, files } : null;
}

export function mergeConversationFiles(
  current: readonly ThreadConversationFile[],
  incoming: readonly ThreadConversationFile[],
): ThreadConversationFile[] {
  const merged = new Map(current.map((file) => [file.path, file] as const));
  for (const file of incoming) {
    const previous = merged.get(file.path);
    merged.set(file.path, {
      ...file,
      preview: file.preview.length > 0 ? file.preview : (previous?.preview ?? ""),
    });
  }
  return [...merged.values()].sort((left, right) => left.path.localeCompare(right.path));
}
