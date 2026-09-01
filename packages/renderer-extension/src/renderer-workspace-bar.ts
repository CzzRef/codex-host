import {
  hostThreadIdSchema,
  type ThreadWorkspaceRepository,
  type ThreadWorkspaceSnapshot,
} from "@codexhost/shared-contracts";

import {
  mergeConversationFiles,
  type ThreadConversationFile,
} from "./renderer-conversation-files.js";
import { CODEX_COMPOSER_SELECTOR } from "./renderer-composer-dom.js";
import type { RendererModelClient } from "./renderer-model-client.js";
import {
  findComposerModelTarget,
  threadIdFromComposerModelTarget,
} from "./versioned-renderer-adapter.js";

export const WORKSPACE_BAR_ATTRIBUTE = "data-codexhost-workspace-bar";
export const WORKSPACE_BAR_SELECTOR = `[${WORKSPACE_BAR_ATTRIBUTE}]`;
export const WORKSPACE_ROW_ATTRIBUTE = "data-codexhost-workspace-row";
export const WORKSPACE_FILES_ATTRIBUTE = "data-codexhost-workspace-files";

const STYLE_ATTRIBUTE = "data-codexhost-workspace-bar-style";
const BAR_CLASS = "codexhost-workspace-bar";

export interface RendererWorkspaceBar {
  refresh(): void;
  dispose(): void;
}

export interface RendererWorkspaceBarOptions {
  getClient(): RendererModelClient | null;
  root?: ParentNode;
}

function ensureStyle(ownerDocument: Document): void {
  if (ownerDocument.querySelector(`style[${STYLE_ATTRIBUTE}]`)) return;
  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "true");
  style.textContent = `
    .${BAR_CLASS} {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      pointer-events: auto;
    }
    .${BAR_CLASS}[${WORKSPACE_BAR_ATTRIBUTE}="empty"] {
      display: none;
    }
    .${BAR_CLASS} [${WORKSPACE_ROW_ATTRIBUTE}] {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      height: 28px;
      padding: 0 10px;
      border: 1px solid rgba(127, 127, 127, 0.22);
      border-radius: 10px;
      background: rgba(127, 127, 127, 0.08);
      color: inherit;
      font-size: 12px;
      line-height: 16px;
    }
    .${BAR_CLASS} [${WORKSPACE_ROW_ATTRIBUTE}] span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .${BAR_CLASS} .codexhost-workspace-name {
      font-weight: 600;
    }
    .${BAR_CLASS} .codexhost-workspace-branch {
      opacity: 0.78;
    }
    .${BAR_CLASS} .codexhost-workspace-tree {
      opacity: 0.78;
    }
    .${BAR_CLASS} .codexhost-workspace-stats {
      margin-left: auto;
      display: inline-flex;
      gap: 6px;
      font-variant-numeric: tabular-nums;
    }
    .${BAR_CLASS} .codexhost-workspace-added {
      color: var(--color-codex-git-added, #3fb950);
    }
    .${BAR_CLASS} .codexhost-workspace-deleted {
      color: var(--color-codex-git-deleted, #f85149);
    }
    .${BAR_CLASS} [${WORKSPACE_FILES_ATTRIBUTE}] {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 88px;
      overflow: auto;
      padding: 4px 10px 6px;
      border: 1px solid rgba(127, 127, 127, 0.18);
      border-radius: 10px;
      font-size: 11px;
      line-height: 16px;
    }
    .${BAR_CLASS} [${WORKSPACE_FILES_ATTRIBUTE}] code {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;
  (ownerDocument.head ?? ownerDocument.documentElement).append(style);
}

function composerVisible(composer: Element): boolean {
  const typed = composer as HTMLElement;
  if (typed.hidden || typed.getAttribute("aria-hidden") === "true") return false;
  const bounds = typed.getBoundingClientRect?.();
  return Boolean(bounds && bounds.width > 0 && bounds.height > 0);
}

export function threadIdForComposer(composer: Element): string | null {
  const portal = [...composer.children].find((child) =>
    child.hasAttribute("data-above-composer-portal"),
  );
  const fromPortal = portal?.getAttribute("data-above-composer-conversation-id");
  const parsedPortal = fromPortal ? hostThreadIdSchema.safeParse(fromPortal) : null;
  if (parsedPortal?.success) return parsedPortal.data;
  try {
    return threadIdFromComposerModelTarget(findComposerModelTarget(composer)) ?? null;
  } catch {
    return null;
  }
}

function chineseLocale(ownerDocument: Document): boolean {
  return (ownerDocument.documentElement.lang || "").toLowerCase().startsWith("zh");
}

export function worktreeLabel(repository: ThreadWorkspaceRepository, chinese: boolean): string {
  if (!repository.isWorktree || !repository.worktreeName) return "";
  return chinese ? `工作树 ${repository.worktreeName}` : `wt ${repository.worktreeName}`;
}

function snapshotSignature(
  snapshot: ThreadWorkspaceSnapshot | null,
  files: readonly ThreadConversationFile[],
): string {
  return JSON.stringify({
    threadId: snapshot?.threadId ?? null,
    cwd: snapshot?.cwd ?? null,
    repositories: snapshot?.repositories ?? [],
    files,
  });
}

function renderRow(
  ownerDocument: Document,
  repository: ThreadWorkspaceRepository,
  chinese: boolean,
): HTMLDivElement {
  const row = ownerDocument.createElement("div");
  row.setAttribute(WORKSPACE_ROW_ATTRIBUTE, repository.kind);
  const name = ownerDocument.createElement("span");
  name.className = "codexhost-workspace-name";
  name.textContent = repository.name;
  const branch = ownerDocument.createElement("span");
  branch.className = "codexhost-workspace-branch";
  branch.textContent = repository.branch ?? repository.headSha;
  row.append(name, branch);
  const tree = worktreeLabel(repository, chinese);
  if (tree) {
    const worktree = ownerDocument.createElement("span");
    worktree.className = "codexhost-workspace-tree";
    worktree.textContent = tree;
    row.append(worktree);
  }
  const stats = ownerDocument.createElement("span");
  stats.className = "codexhost-workspace-stats";
  const added = ownerDocument.createElement("span");
  added.className = "codexhost-workspace-added";
  added.textContent = `+${repository.addedLines.toLocaleString()}`;
  const deleted = ownerDocument.createElement("span");
  deleted.className = "codexhost-workspace-deleted";
  deleted.textContent = `-${repository.deletedLines.toLocaleString()}`;
  stats.append(added, deleted);
  row.append(stats);
  return row;
}

function placeBar(bar: HTMLElement, composer: Element): void {
  const parent = composer.parentElement;
  if (!parent || typeof parent.insertBefore !== "function") return;
  if (bar.parentElement === parent && bar.nextElementSibling === composer) return;
  parent.insertBefore(bar, composer);
}

export function installRendererWorkspaceBar(
  options: RendererWorkspaceBarOptions,
): RendererWorkspaceBar {
  const root = options.root ?? document;
  const documentNode =
    root instanceof Document ? root : ((root as Element).ownerDocument ?? document);
  ensureStyle(documentNode);
  const bars = new Map<Element, HTMLElement>();
  const signatures = new Map<Element, string>();
  const generations = new Map<Element, number>();
  const loadedThreadIds = new Map<Element, string>();
  const conversationFiles = new Map<string, ThreadConversationFile[]>();
  const lastSnapshot = new Map<Element, ThreadWorkspaceSnapshot | null>();
  let disposed = false;
  let unsubscribe: (() => void) | null = null;
  let subscribedClient: RendererModelClient | null = null;

  const removeBar = (composer: Element): void => {
    bars.get(composer)?.remove();
    bars.delete(composer);
    signatures.delete(composer);
    generations.delete(composer);
    loadedThreadIds.delete(composer);
    lastSnapshot.delete(composer);
  };

  const paint = (composer: Element, snapshot: ThreadWorkspaceSnapshot | null): void => {
    lastSnapshot.set(composer, snapshot);
    const threadId = snapshot?.threadId ?? threadIdForComposer(composer);
    const files = threadId ? (conversationFiles.get(threadId) ?? []) : [];
    const signature = snapshotSignature(snapshot, files);
    if (signatures.get(composer) === signature && bars.get(composer)?.isConnected) {
      const existing = bars.get(composer);
      if (existing) placeBar(existing, composer);
      return;
    }
    signatures.set(composer, signature);
    let bar = bars.get(composer);
    if (!bar) {
      bar = documentNode.createElement("div");
      bar.className = BAR_CLASS;
      bar.setAttribute(WORKSPACE_BAR_ATTRIBUTE, "empty");
      bars.set(composer, bar);
    }
    bar.replaceChildren();
    const repositories = snapshot?.repositories ?? [];
    if (repositories.length === 0 && files.length === 0) {
      bar.setAttribute(WORKSPACE_BAR_ATTRIBUTE, "empty");
      bar.remove();
      return;
    }
    const chinese = chineseLocale(documentNode);
    for (const repository of repositories) bar.append(renderRow(documentNode, repository, chinese));
    if (files.length > 0) {
      const list = documentNode.createElement("div");
      list.setAttribute(WORKSPACE_FILES_ATTRIBUTE, "true");
      const heading = documentNode.createElement("div");
      heading.textContent = chinese
        ? `本轮 ${files.length} 个文件`
        : `${files.length} files this conversation`;
      list.append(heading);
      for (const file of files) {
        const row = documentNode.createElement("div");
        const path = documentNode.createElement("code");
        path.textContent = file.path;
        const stats = documentNode.createElement("span");
        stats.className = "codexhost-workspace-stats";
        const added = documentNode.createElement("span");
        added.className = "codexhost-workspace-added";
        added.textContent = `+${file.addedLines.toLocaleString()}`;
        const deleted = documentNode.createElement("span");
        deleted.className = "codexhost-workspace-deleted";
        deleted.textContent = `-${file.deletedLines.toLocaleString()}`;
        stats.append(added, deleted);
        row.append(path, stats);
        list.append(row);
      }
      bar.append(list);
    }
    bar.setAttribute(WORKSPACE_BAR_ATTRIBUTE, snapshot?.threadId ?? "ready");
    placeBar(bar, composer);
  };

  const load = (composer: Element, threadId: string): void => {
    const client = options.getClient();
    if (!client) {
      paint(composer, null);
      return;
    }
    const generation = (generations.get(composer) ?? 0) + 1;
    generations.set(composer, generation);
    void client
      .inspectThreadWorkspace({ threadId: hostThreadIdSchema.parse(threadId) })
      .then((snapshot) => {
        if (disposed || generations.get(composer) !== generation || !composer.isConnected) return;
        paint(composer, snapshot);
      })
      .catch(() => {
        if (disposed || generations.get(composer) !== generation) return;
        loadedThreadIds.delete(composer);
        paint(composer, null);
      });
  };

  const scan = (): void => {
    if (disposed) return;
    const composers = [...root.querySelectorAll(CODEX_COMPOSER_SELECTOR)];
    const live = new Set<Element>();
    for (const composer of composers) {
      if (!composerVisible(composer)) continue;
      live.add(composer);
      const threadId = threadIdForComposer(composer);
      if (!threadId) {
        loadedThreadIds.delete(composer);
        paint(composer, null);
        continue;
      }
      if (loadedThreadIds.get(composer) === threadId) {
        const existing = bars.get(composer);
        if (existing?.isConnected) placeBar(existing, composer);
        continue;
      }
      loadedThreadIds.set(composer, threadId);
      load(composer, threadId);
    }
    for (const composer of [...bars.keys()]) {
      if (!live.has(composer) || !composer.isConnected) removeBar(composer);
    }
    connectNotifications();
  };

  const paintThread = (threadId: string, snapshot: ThreadWorkspaceSnapshot | null): void => {
    for (const composer of root.querySelectorAll(CODEX_COMPOSER_SELECTOR)) {
      if (threadIdForComposer(composer) === threadId) {
        paint(composer, snapshot ?? lastSnapshot.get(composer) ?? null);
      }
    }
  };

  const connectNotifications = (): void => {
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
            if (!disposed) paintThread(snapshot.threadId, snapshot);
          }),
        );
      }
      if (client?.subscribeThreadFileChanges) {
        unsubscribers.push(
          client.subscribeThreadFileChanges((update) => {
            if (disposed) return;
            conversationFiles.set(
              update.threadId,
              mergeConversationFiles(conversationFiles.get(update.threadId) ?? [], update.files),
            );
            paintThread(update.threadId, null);
          }),
        );
      }
    } catch {
      subscribedClient = null;
      return;
    }
    unsubscribe = () => {
      for (const stop of unsubscribers) stop();
    };
  };

  let scanTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleScan = (): void => {
    if (disposed || scanTimer !== null) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan();
    }, 0);
  };

  const observer = new MutationObserver(scheduleScan);
  observer.observe(documentNode.documentElement ?? documentNode, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "hidden",
      "aria-hidden",
      "data-codex-composer-root",
      "data-above-composer-conversation-id",
    ],
  });
  scan();

  return {
    refresh() {
      signatures.clear();
      loadedThreadIds.clear();
      conversationFiles.clear();
      lastSnapshot.clear();
      subscribedClient = null;
      unsubscribe?.();
      unsubscribe = null;
      scan();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      if (scanTimer !== null) clearTimeout(scanTimer);
      unsubscribe?.();
      unsubscribe = null;
      for (const composer of [...bars.keys()]) removeBar(composer);
    },
  };
}
