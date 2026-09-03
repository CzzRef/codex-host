import {
  hostThreadIdSchema,
  type ThreadWorkspaceRepository,
  type ThreadWorkspaceSnapshot,
} from "@codexhost/shared-contracts";

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
  /**
   * File Change Item that owns `files`. Each notification carries that Item's
   * complete current change set, so a later update for the same Item replaces
   * the earlier one and an empty set retires the Item's files (revert).
   * `null` when the notification did not identify an Item; such updates only
   * merge.
   */
  itemId: string | null;
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
  const itemId =
    typeof params.itemId === "string" && params.itemId.trim().length > 0
      ? params.itemId.trim()
      : null;
  // An identified Item with no changes left is a revert and must still be
  // delivered; an anonymous empty update carries nothing to merge.
  if (files.length === 0 && itemId === null) return null;
  return { threadId: threadId.data, turnId, itemId, files };
}

/**
 * Conversation file set derived from per-Item change sets. Files are summed
 * by path across Items so one path edited by two Items shows once with the
 * combined line counts and the latest non-empty preview.
 */
export function conversationFilesFromItems(
  items: ReadonlyMap<string, readonly ThreadConversationFile[]>,
): ThreadConversationFile[] {
  const byPath = new Map<string, ThreadConversationFile>();
  for (const files of items.values()) {
    for (const file of files) {
      const previous = byPath.get(file.path);
      byPath.set(file.path, {
        path: file.path,
        addedLines: (previous?.addedLines ?? 0) + file.addedLines,
        deletedLines: (previous?.deletedLines ?? 0) + file.deletedLines,
        preview: file.preview.length > 0 ? file.preview : (previous?.preview ?? ""),
      });
    }
  }
  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
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

function pathBaseName(path: string): string {
  const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
  return parts.at(-1) ?? path;
}

function normalizeWorkspacePath(path: string): string {
  const raw = path.replaceAll("\\", "/");
  const drive = /^[a-z]:\//i.exec(raw)?.[0]?.toLowerCase() ?? null;
  const prefix = raw.startsWith("/") ? "/" : (drive ?? "");
  const source = prefix.length > 0 ? raw.slice(prefix.length) : raw;
  const parts: string[] = [];
  for (const part of source.split("/")) {
    if (part.length === 0 || part === ".") continue;
    if (part === "..") {
      if (parts.length > 0 && parts.at(-1) !== "..") parts.pop();
      else if (prefix.length === 0) parts.push(part);
      continue;
    }
    parts.push(part);
  }
  const normalized = `${prefix}${parts.join("/")}`;
  if (normalized === "/" || /^[a-z]:\/$/i.test(normalized)) return normalized;
  return normalized.replace(/\/$/u, "") || prefix;
}

function absoluteWorkspacePath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/");
  return normalized.startsWith("/") || /^[a-z]:\//i.test(normalized);
}

function workspacePathContains(root: string, candidate: string): boolean {
  const normalizedRoot = normalizeWorkspacePath(root);
  const normalizedCandidate = normalizeWorkspacePath(candidate);
  const windows = /^[a-z]:/i.test(normalizedRoot);
  const comparableRoot = windows ? normalizedRoot.toLowerCase() : normalizedRoot;
  const comparableCandidate = windows ? normalizedCandidate.toLowerCase() : normalizedCandidate;
  return (
    comparableCandidate === comparableRoot ||
    comparableCandidate.startsWith(
      comparableRoot.endsWith("/") ? comparableRoot : `${comparableRoot}/`,
    )
  );
}

export function workspaceLocationLabel(repository: ThreadWorkspaceRepository): string {
  if (repository.isWorktree && repository.worktreeName) return repository.worktreeName;
  return pathBaseName(repository.root) || repository.name;
}

/**
 * One repository row of the compact workspace line. `core` marks the Thread
 * cwd's own root, which is always listed; every other root appears only while
 * conversation files with non-zero line changes live under it.
 */
export interface ConversationFileGroup {
  repository: ThreadWorkspaceRepository;
  files: ThreadConversationFile[];
  addedLines: number;
  deletedLines: number;
  core: boolean;
}

export function groupConversationFilesByRepository(
  snapshot: ThreadWorkspaceSnapshot | null,
  files: readonly ThreadConversationFile[],
): { groups: ConversationFileGroup[]; unresolved: string[] } {
  const primary = snapshot?.repositories.find((repository) => repository.kind === "primary");
  if (!snapshot || !primary) return { groups: [], unresolved: [] };
  const filesByRoot = new Map<string, ThreadConversationFile[]>();
  const unresolved: string[] = [];
  for (const file of files) {
    const absolute = absoluteWorkspacePath(file.path);
    const filePath = absolute
      ? normalizeWorkspacePath(file.path)
      : normalizeWorkspacePath(`${primary.root}/${file.path}`);
    const owner = snapshot.repositories
      .filter((repository) => workspacePathContains(repository.root, filePath))
      .sort((left, right) => right.root.length - left.root.length)[0];
    if (!owner) {
      if (absolute) unresolved.push(filePath);
      continue;
    }
    const bucket = filesByRoot.get(owner.root) ?? [];
    bucket.push(file);
    filesByRoot.set(owner.root, bucket);
  }
  const groups: ConversationFileGroup[] = [];
  for (const repository of snapshot.repositories) {
    const owned = filesByRoot.get(repository.root) ?? [];
    const stats = aggregateConversationFileStats(owned);
    const core = repository.root === primary.root;
    if (!core && stats.addedLines + stats.deletedLines === 0) continue;
    groups.push({ repository, files: owned, ...stats, core });
  }
  groups.sort((left, right) => Number(right.core) - Number(left.core));
  return { groups, unresolved: [...new Set(unresolved)] };
}

export function repositoriesForConversationFiles(
  snapshot: ThreadWorkspaceSnapshot | null,
  files: readonly ThreadConversationFile[],
): ThreadWorkspaceRepository[] {
  if (files.length === 0) return [];
  return groupConversationFilesByRepository(snapshot, files)
    .groups.filter((group) => group.files.length > 0)
    .map((group) => group.repository);
}

export function aggregateConversationFileStats(files: readonly ThreadConversationFile[]): {
  addedLines: number;
  deletedLines: number;
} {
  return files.reduce(
    (total, file) => ({
      addedLines: total.addedLines + file.addedLines,
      deletedLines: total.deletedLines + file.deletedLines,
    }),
    { addedLines: 0, deletedLines: 0 },
  );
}

export function repositoryDisplayName(repository: ThreadWorkspaceRepository): string {
  if (
    (repository.kind === "worktree" || repository.isWorktree) &&
    repository.primaryRoot &&
    repository.primaryRoot !== repository.root
  ) {
    return pathBaseName(repository.primaryRoot);
  }
  return repository.name;
}

export function worktreeLabel(repository: ThreadWorkspaceRepository, chinese: boolean): string {
  if (!repository.isWorktree || !repository.worktreeName) return "";
  const display = repositoryDisplayName(repository);
  if (
    repository.worktreeName === display ||
    repository.worktreeName === (repository.branch ?? "")
  ) {
    return "";
  }
  return chinese ? `工作树 ${repository.worktreeName}` : `wt ${repository.worktreeName}`;
}

/** Repaint guard: the inputs that decide what a workspace surface shows. */
export function snapshotSignature(
  snapshot: ThreadWorkspaceSnapshot | null,
  files: readonly ThreadConversationFile[],
  selectedTurn: string | null,
): string {
  return JSON.stringify({
    threadId: snapshot?.threadId ?? null,
    cwd: snapshot?.cwd ?? null,
    repositories: snapshot?.repositories ?? [],
    files,
    selectedTurn,
  });
}
