import {
  hostThreadIdSchema,
  type ThreadWorkspaceRepository,
  type ThreadWorkspaceSnapshot,
} from "@codexhost/shared-contracts";

import {
  filesForTurnSelection,
  mergeConversationFiles,
  reviewPathMatches,
  turnKeyMatches,
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
export const WORKSPACE_FILE_ATTRIBUTE = "data-codexhost-workspace-file";
export const WORKSPACE_PREVIEW_ATTRIBUTE = "data-codexhost-workspace-preview";
export const TURN_FILES_ATTRIBUTE = "data-codexhost-turn-files";

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
      appearance: none;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      padding: 0;
      font: inherit;
    }
    .${BAR_CLASS} .codexhost-workspace-stats:hover {
      text-decoration: underline;
      text-underline-offset: 2px;
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
      padding: 4px 8px 6px;
      border: 1px solid rgba(127, 127, 127, 0.18);
      border-radius: 10px;
      font-size: 11px;
      line-height: 16px;
    }
    .${BAR_CLASS} .codexhost-workspace-files-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      appearance: none;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      padding: 2px 2px 4px;
      font: inherit;
      text-align: left;
    }
    .${BAR_CLASS} .codexhost-workspace-files-list {
      display: flex;
      flex-direction: column;
      gap: 1px;
      max-height: 132px;
      overflow: auto;
    }
    .${BAR_CLASS} [${WORKSPACE_FILES_ATTRIBUTE}="collapsed"] .codexhost-workspace-files-list {
      display: none;
    }
    .${BAR_CLASS} [${WORKSPACE_FILE_ATTRIBUTE}] {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      appearance: none;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      padding: 2px 4px;
      font: inherit;
      text-align: left;
    }
    .${BAR_CLASS} [${WORKSPACE_FILE_ATTRIBUTE}]:hover {
      background: rgba(127, 127, 127, 0.16);
    }
    .${BAR_CLASS} [${WORKSPACE_FILE_ATTRIBUTE}] code {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    [${WORKSPACE_PREVIEW_ATTRIBUTE}] {
      position: fixed;
      z-index: 40;
      width: min(420px, calc(100vw - 24px));
      max-height: 280px;
      overflow: auto;
      padding: 8px 10px;
      border: 1px solid rgba(127, 127, 127, 0.28);
      border-radius: 10px;
      background: rgba(20, 20, 20, 0.96);
      color: inherit;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      line-height: 16px;
      white-space: pre;
      pointer-events: none;
    }
    [${WORKSPACE_PREVIEW_ATTRIBUTE}] .codexhost-workspace-preview-add {
      color: var(--color-codex-git-added, #3fb950);
    }
    [${WORKSPACE_PREVIEW_ATTRIBUTE}] .codexhost-workspace-preview-del {
      color: var(--color-codex-git-deleted, #f85149);
    }
    [${WORKSPACE_PREVIEW_ATTRIBUTE}] .codexhost-workspace-preview-meta {
      opacity: 0.62;
    }
    [${TURN_FILES_ATTRIBUTE}] {
      outline: 1px solid rgba(63, 185, 80, 0.55);
      outline-offset: 4px;
      border-radius: 12px;
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

function controlLabel(element: Element): string {
  return [element.getAttribute("aria-label"), element.getAttribute("title"), element.textContent]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

function controlVisible(element: Element): boolean {
  const typed = element as HTMLElement;
  if (typed.hidden || typed.getAttribute("aria-hidden") === "true") return false;
  const bounds = typed.getBoundingClientRect?.();
  return Boolean(bounds && bounds.width > 0 && bounds.height > 0);
}

export function isNativeWorkspaceDiffControl(element: Element): boolean {
  const label = controlLabel(element);
  if (
    element.getAttribute("data-slot") === "thread-summary-panel-item-button" &&
    /changes|files changed|变更|文件变更/i.test(label)
  ) {
    return true;
  }
  if (element.getAttribute("data-tab-id") === "diff") return true;
  return /open review tab|打开审查|打开变更/i.test(label);
}

function nativeWorkspaceDiffRank(element: Element): number {
  if (element.getAttribute("data-slot") === "thread-summary-panel-item-button") return 0;
  if (/open review tab|打开审查|打开变更/i.test(controlLabel(element))) return 1;
  if (element.getAttribute("data-tab-id") === "diff") return 2;
  return 3;
}

export function nativeWorkspaceDiffControl(root: ParentNode): HTMLElement | null {
  const candidates = [
    ...root.querySelectorAll("button, [role='button'], [data-tab-id='diff']"),
  ].filter((element) => isNativeWorkspaceDiffControl(element) && controlVisible(element));
  candidates.sort((left, right) => nativeWorkspaceDiffRank(left) - nativeWorkspaceDiffRank(right));
  const match = candidates[0];
  if (!match) return null;
  if (match instanceof HTMLElement && match.tagName === "BUTTON") return match;
  const inner = match.querySelector("button");
  return inner instanceof HTMLElement ? inner : match instanceof HTMLElement ? match : null;
}

export function openNativeWorkspaceDiff(root: ParentNode = document): boolean {
  const control = nativeWorkspaceDiffControl(root);
  if (!control) return false;
  control.click();
  return true;
}

export function nativeReviewFileControl(root: ParentNode, filePath: string): HTMLElement | null {
  for (const element of root.querySelectorAll("[data-review-path]")) {
    const reviewPath = element.getAttribute("data-review-path") ?? "";
    if (!reviewPathMatches(reviewPath, filePath)) continue;
    const header = element.querySelector<HTMLElement>('[class*="diff-header"]');
    return header ?? (element instanceof HTMLElement ? element : null);
  }
  return null;
}

function snapshotSignature(
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
  const stats = ownerDocument.createElement("button");
  stats.type = "button";
  stats.className = "codexhost-workspace-stats";
  stats.setAttribute("aria-label", chinese ? "打开变更" : "Open review");
  stats.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openNativeWorkspaceDiff(ownerDocument);
  });
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

function fillDiffPreview(host: HTMLElement, preview: string, chinese: boolean): void {
  host.replaceChildren();
  if (preview.length === 0) {
    host.textContent = chinese ? "暂无改动预览" : "No diff preview";
    return;
  }
  const ownerDocument = host.ownerDocument;
  for (const line of preview.split("\n")) {
    const row = ownerDocument.createElement("div");
    if (line.startsWith("+") && !line.startsWith("+++")) {
      row.className = "codexhost-workspace-preview-add";
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      row.className = "codexhost-workspace-preview-del";
    } else {
      row.className = "codexhost-workspace-preview-meta";
    }
    row.textContent = line.length > 0 ? line : " ";
    host.append(row);
  }
}

function placePreview(host: HTMLElement, anchor: DOMRect): void {
  const width = Math.min(
    420,
    Math.max(240, host.ownerDocument.defaultView?.innerWidth ?? 420) - 24,
  );
  const maxLeft = (host.ownerDocument.defaultView?.innerWidth ?? width) - width - 8;
  const left = Math.max(8, Math.min(Math.round(anchor.right + 8), maxLeft));
  const top = Math.max(8, Math.round(anchor.top));
  host.style.width = `${width}px`;
  host.style.left = `${left}px`;
  host.style.top = `${top}px`;
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
  const filesByTurn = new Map<string, Map<string, ThreadConversationFile[]>>();
  const selectedTurnKey = new Map<string, string | null>();
  const lastSnapshot = new Map<Element, ThreadWorkspaceSnapshot | null>();
  const filesExpanded = new Map<Element, boolean>();
  const preview = documentNode.createElement("div");
  preview.setAttribute(WORKSPACE_PREVIEW_ATTRIBUTE, "true");
  preview.hidden = true;
  (documentNode.body ?? documentNode.documentElement).append(preview);
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
    filesExpanded.delete(composer);
  };

  const hidePreview = (): void => {
    preview.hidden = true;
    preview.replaceChildren();
  };

  const showPreview = (file: ThreadConversationFile, anchor: DOMRect, chinese: boolean): void => {
    fillDiffPreview(preview, file.preview, chinese);
    preview.hidden = false;
    placePreview(preview, anchor);
  };

  const highlightTurns = (selection: string | null): void => {
    for (const turn of documentNode.querySelectorAll(`[${TURN_FILES_ATTRIBUTE}]`)) {
      turn.removeAttribute(TURN_FILES_ATTRIBUTE);
    }
    if (!selection) return;
    for (const turn of documentNode.querySelectorAll(
      "[data-turn-key], [data-content-search-turn-key]",
    )) {
      const key =
        turn.getAttribute("data-content-search-turn-key") ??
        turn.getAttribute("data-turn-key") ??
        "";
      if (turnKeyMatches(key, selection) || turnKeyMatches(selection, key)) {
        turn.setAttribute(TURN_FILES_ATTRIBUTE, "true");
      }
    }
  };

  const openConversationFile = (file: ThreadConversationFile): void => {
    openNativeWorkspaceDiff(documentNode);
    const reveal = (): void => {
      const control = nativeReviewFileControl(documentNode, file.path);
      control?.scrollIntoView({ block: "center", inline: "nearest" });
      control?.click();
    };
    documentNode.defaultView?.setTimeout(reveal, 50);
  };

  const paint = (composer: Element, snapshot: ThreadWorkspaceSnapshot | null): void => {
    lastSnapshot.set(composer, snapshot);
    const threadId = snapshot?.threadId ?? threadIdForComposer(composer);
    const selected = threadId ? (selectedTurnKey.get(threadId) ?? null) : null;
    const turnFiles =
      threadId && selected
        ? filesForTurnSelection(filesByTurn.get(threadId) ?? new Map(), selected)
        : null;
    const files = turnFiles ?? (threadId ? (conversationFiles.get(threadId) ?? []) : []);
    const signature = snapshotSignature(snapshot, files, selected);
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
    if (repositories.length === 0 && files.length === 0 && turnFiles === null) {
      bar.setAttribute(WORKSPACE_BAR_ATTRIBUTE, "empty");
      bar.remove();
      return;
    }
    const chinese = chineseLocale(documentNode);
    for (const repository of repositories) bar.append(renderRow(documentNode, repository, chinese));
    if (files.length > 0 || turnFiles !== null) {
      const expanded = filesExpanded.get(composer) ?? false;
      const list = documentNode.createElement("div");
      list.setAttribute(WORKSPACE_FILES_ATTRIBUTE, expanded ? "open" : "collapsed");
      const heading = documentNode.createElement("button");
      heading.type = "button";
      heading.className = "codexhost-workspace-files-toggle";
      heading.setAttribute("aria-expanded", expanded ? "true" : "false");
      const filtered = turnFiles !== null;
      heading.textContent = chinese
        ? `${expanded ? "▾" : "▸"} ${filtered ? "本段" : "本轮"} ${files.length} 个文件`
        : `${expanded ? "▾" : "▸"} ${files.length} files ${filtered ? "this turn" : "this conversation"}`;
      heading.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (filtered && threadId) {
          selectedTurnKey.set(threadId, null);
          highlightTurns(null);
          documentNode.defaultView?.dispatchEvent(
            new CustomEvent("codexhost:turn-files-selected", {
              detail: { threadId, turnKey: null },
            }),
          );
        } else {
          filesExpanded.set(composer, !(filesExpanded.get(composer) ?? false));
        }
        signatures.delete(composer);
        paint(composer, lastSnapshot.get(composer) ?? snapshot);
      });
      const rows = documentNode.createElement("div");
      rows.className = "codexhost-workspace-files-list";
      for (const file of files) {
        const row = documentNode.createElement("button");
        row.type = "button";
        row.setAttribute(WORKSPACE_FILE_ATTRIBUTE, file.path);
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
        row.addEventListener("mouseenter", () => {
          showPreview(file, row.getBoundingClientRect(), chinese);
        });
        row.addEventListener("mouseleave", hidePreview);
        row.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          hidePreview();
          openConversationFile(file);
        });
        rows.append(row);
      }
      list.append(heading, rows);
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
            if (update.turnId) {
              const turns = filesByTurn.get(update.threadId) ?? new Map();
              turns.set(
                update.turnId,
                mergeConversationFiles(turns.get(update.turnId) ?? [], update.files),
              );
              filesByTurn.set(update.threadId, turns);
            }
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

  const onTurnClick = (event: MouseEvent): void => {
    if (disposed) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest("button, a, input, textarea, [contenteditable='true']")) return;
    const turn = target.closest("[data-turn-key], [data-content-search-turn-key]");
    if (!turn) return;
    const key =
      turn.getAttribute("data-content-search-turn-key") ?? turn.getAttribute("data-turn-key");
    if (!key) return;
    for (const composer of root.querySelectorAll(CODEX_COMPOSER_SELECTOR)) {
      if (!composerVisible(composer)) continue;
      const threadId = threadIdForComposer(composer);
      if (!threadId) continue;
      const current = selectedTurnKey.get(threadId) ?? null;
      const next =
        current && (turnKeyMatches(current, key) || turnKeyMatches(key, current)) ? null : key;
      selectedTurnKey.set(threadId, next);
      highlightTurns(next);
      if (next) filesExpanded.set(composer, true);
      signatures.delete(composer);
      paint(composer, lastSnapshot.get(composer) ?? null);
      bars.get(composer)?.scrollIntoView({ block: "nearest" });
      documentNode.defaultView?.dispatchEvent(
        new CustomEvent("codexhost:turn-files-selected", {
          detail: { threadId, turnKey: next },
        }),
      );
    }
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
  documentNode.addEventListener("click", onTurnClick, true);
  scan();

  return {
    refresh() {
      signatures.clear();
      loadedThreadIds.clear();
      conversationFiles.clear();
      filesByTurn.clear();
      selectedTurnKey.clear();
      lastSnapshot.clear();
      filesExpanded.clear();
      highlightTurns(null);
      hidePreview();
      subscribedClient = null;
      unsubscribe?.();
      unsubscribe = null;
      scan();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      documentNode.removeEventListener("click", onTurnClick, true);
      if (scanTimer !== null) clearTimeout(scanTimer);
      highlightTurns(null);
      unsubscribe?.();
      unsubscribe = null;
      hidePreview();
      preview.remove();
      for (const composer of [...bars.keys()]) removeBar(composer);
    },
  };
}
