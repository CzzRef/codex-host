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
import {
  CONVERSATION_GUTTER_ATTRIBUTE,
  clampFixedBox,
  ensureOverlayChromeStyle,
  overlayTopAboveComposer,
} from "./renderer-overlay-layout.js";
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
export const NATIVE_WORKSPACE_DIFF_HIDDEN_ATTRIBUTE = "data-codexhost-native-workspace-diff-hidden";

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
  ensureOverlayChromeStyle(ownerDocument);
  ownerDocument.querySelector(`style[${STYLE_ATTRIBUTE}]`)?.remove();
  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "true");
  style.textContent = `
    .${BAR_CLASS} {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      min-width: 0;
      min-height: 32px;
      box-sizing: border-box;
      pointer-events: auto;
      position: fixed;
      z-index: 32;
      margin: 0;
      padding: 4px 6px;
      border: 1px solid rgb(255 255 255 / 10%);
      border-radius: 10px;
      background: rgb(17 17 17 / 90%);
      box-shadow: 0 8px 24px rgb(0 0 0 / 24%);
      backdrop-filter: blur(16px);
      overflow: visible;
    }
    .${BAR_CLASS}[${WORKSPACE_BAR_ATTRIBUTE}="empty"] {
      display: none;
    }
    .${BAR_CLASS} .codexhost-workspace-chips {
      display: flex;
      flex: 1 1 auto;
      flex-wrap: nowrap;
      gap: 4px;
      min-width: 0;
      overflow: hidden;
    }
    .${BAR_CLASS} [${WORKSPACE_ROW_ATTRIBUTE}] {
      display: inline-flex;
      flex: 0 1 auto;
      align-items: center;
      gap: 6px;
      min-width: 0;
      max-width: 100%;
      min-height: 24px;
      padding: 0 6px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font-size: 11px;
      line-height: 15px;
    }
    .${BAR_CLASS} [${WORKSPACE_ROW_ATTRIBUTE}] span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .${BAR_CLASS} .codexhost-workspace-tree {
      font-weight: 650;
    }
    .${BAR_CLASS} .codexhost-workspace-branch {
      color: rgb(255 255 255 / 62%);
    }
    .${BAR_CLASS} .codexhost-workspace-stats {
      position: relative;
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
    .${BAR_CLASS} .codexhost-workspace-stats:focus-visible {
      outline: 2px solid #339cff;
      outline-offset: 2px;
    }
    .${BAR_CLASS} .codexhost-workspace-added {
      color: var(--color-codex-git-added, #3fb950);
    }
    .${BAR_CLASS} .codexhost-workspace-deleted {
      color: var(--color-codex-git-deleted, #f85149);
    }
    .${BAR_CLASS} [${WORKSPACE_FILES_ATTRIBUTE}] {
      position: relative;
      display: flex;
      flex: 0 0 auto;
      min-width: 0;
      margin-left: auto;
      font-size: 11px;
      line-height: 16px;
    }
    .${BAR_CLASS} .codexhost-workspace-files-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      min-height: 24px;
      appearance: none;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: rgb(255 255 255 / 68%);
      cursor: pointer;
      padding: 3px 6px;
      font: inherit;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .${BAR_CLASS} .codexhost-workspace-files-count {
      color: rgb(255 255 255 / 76%);
    }
    .${BAR_CLASS} .codexhost-workspace-summary-stats {
      display: inline-flex;
      gap: 5px;
    }
    .${BAR_CLASS} .codexhost-workspace-files-chevron {
      color: rgb(255 255 255 / 48%);
      font-size: 10px;
    }
    .${BAR_CLASS} .codexhost-workspace-files-toggle:hover {
      background: rgb(255 255 255 / 7%);
      color: inherit;
    }
    .${BAR_CLASS} .codexhost-workspace-files-list {
      position: absolute;
      right: 0;
      bottom: calc(100% + 8px);
      left: auto;
      z-index: 2;
      display: flex;
      flex-direction: column;
      gap: 1px;
      width: min(420px, calc(100vw - 24px));
      max-height: min(300px, 42vh);
      box-sizing: border-box;
      overflow: auto;
      padding: 6px;
      border: 1px solid rgb(255 255 255 / 12%);
      border-radius: 10px;
      background: rgb(17 17 17 / 96%);
      box-shadow: 0 12px 32px rgb(0 0 0 / 38%);
      backdrop-filter: blur(18px);
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
      background: rgb(255 255 255 / 7%);
    }
    .${BAR_CLASS} [${WORKSPACE_FILE_ATTRIBUTE}]:active {
      background: rgb(255 255 255 / 12%);
    }
    .${BAR_CLASS} [${WORKSPACE_FILE_ATTRIBUTE}] code {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    [${CONVERSATION_GUTTER_ATTRIBUTE}] {
      pointer-events: none;
      flex-shrink: 0;
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
    [${NATIVE_WORKSPACE_DIFF_HIDDEN_ATTRIBUTE}] {
      display: none !important;
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

export function repositoriesForConversationFiles(
  snapshot: ThreadWorkspaceSnapshot | null,
  files: readonly ThreadConversationFile[],
): ThreadWorkspaceRepository[] {
  if (!snapshot || files.length === 0) return [];
  const primary = snapshot.repositories.find((repository) => repository.kind === "primary");
  if (!primary) return [];
  const involvedRoots = new Set<string>();
  for (const file of files) {
    const filePath = absoluteWorkspacePath(file.path)
      ? normalizeWorkspacePath(file.path)
      : normalizeWorkspacePath(`${primary.root}/${file.path}`);
    const owner = snapshot.repositories
      .filter((repository) => workspacePathContains(repository.root, filePath))
      .sort((left, right) => right.root.length - left.root.length)[0];
    if (owner) involvedRoots.add(owner.root);
  }
  return snapshot.repositories.filter((repository) => involvedRoots.has(repository.root));
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

function nativeWorkspaceDiffCandidates(root: ParentNode): Element[] {
  return [...root.querySelectorAll("button, [role='button'], [data-tab-id='diff']")].filter(
    (element) => !element.closest(WORKSPACE_BAR_SELECTOR) && isNativeWorkspaceDiffControl(element),
  );
}

export function setNativeWorkspaceDiffControlsHidden(root: ParentNode, hidden: boolean): void {
  const ownerDocument =
    root instanceof Document ? root : ((root as Element).ownerDocument ?? document);
  if (!hidden) {
    for (const element of ownerDocument.querySelectorAll(
      `[${NATIVE_WORKSPACE_DIFF_HIDDEN_ATTRIBUTE}]`,
    )) {
      element.removeAttribute(NATIVE_WORKSPACE_DIFF_HIDDEN_ATTRIBUTE);
    }
    return;
  }
  for (const element of nativeWorkspaceDiffCandidates(root)) {
    element.setAttribute(NATIVE_WORKSPACE_DIFF_HIDDEN_ATTRIBUTE, "true");
  }
}

export function nativeWorkspaceDiffControl(root: ParentNode): HTMLElement | null {
  const candidates = nativeWorkspaceDiffCandidates(root).filter(
    (element) =>
      controlVisible(element) || element.hasAttribute(NATIVE_WORKSPACE_DIFF_HIDDEN_ATTRIBUTE),
  );
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

function renderRow(ownerDocument: Document, repository: ThreadWorkspaceRepository): HTMLDivElement {
  const row = ownerDocument.createElement("div");
  row.setAttribute(WORKSPACE_ROW_ATTRIBUTE, repository.kind);
  const location = ownerDocument.createElement("span");
  location.className = "codexhost-workspace-tree";
  location.textContent = workspaceLocationLabel(repository);
  const branch = ownerDocument.createElement("span");
  branch.className = "codexhost-workspace-branch";
  branch.textContent = `· ${repository.branch ?? repository.headSha}`;
  row.title = `${location.textContent} ${branch.textContent}`;
  row.append(location, branch);
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

function placePreview(host: HTMLElement, anchor: DOMRect, composer: Element | null): void {
  const view = host.ownerDocument.defaultView;
  const width = Math.min(420, Math.max(240, view?.innerWidth ?? 420) - 24);
  const height = host.offsetHeight || 160;
  const composerTop = composer?.getBoundingClientRect().top ?? view?.innerHeight ?? 800;
  const viewportWidth = view?.innerWidth ?? width;
  const rightCandidate = anchor.right + 8;
  const preferredLeft =
    rightCandidate + width <= viewportWidth - 12 ? rightCandidate : anchor.left - width - 8;
  const origin = clampFixedBox({
    left: preferredLeft,
    top: anchor.top,
    width,
    height,
    viewportWidth,
    maxBottom: composerTop,
  });
  host.style.width = `${width}px`;
  host.style.left = `${origin.left}px`;
  host.style.top = `${origin.top}px`;
}

function placeBar(bar: HTMLElement, composer: Element): void {
  const parent = composer.parentElement;
  if (parent) {
    if (bar.parentElement !== parent || bar.nextElementSibling !== composer) {
      parent.insertBefore(bar, composer);
    }
  } else {
    const ownerDocument = bar.ownerDocument;
    (ownerDocument.body ?? ownerDocument.documentElement).append(bar);
  }
  const rect = composer.getBoundingClientRect();
  const height = bar.offsetHeight || 32;
  const top = overlayTopAboveComposer(rect.top, height, 8);
  bar.style.position = "fixed";
  bar.style.zIndex = "32";
  bar.style.left = `${Math.round(rect.left)}px`;
  bar.style.width = `${Math.round(rect.width)}px`;
  bar.style.top = `${top}px`;
  bar.style.maxHeight = "";
  bar.style.overflow = "visible";
  const fileList = bar.querySelector<HTMLElement>("[data-codexhost-workspace-file-list]");
  if (fileList) {
    fileList.style.maxHeight = `min(300px, 42vh, ${Math.max(0, top - 20)}px)`;
    fileList.style.left = "auto";
    fileList.style.right = "0";
  }
}

function clearConversationGutter(root: ParentNode): void {
  const ownerDocument =
    root instanceof Document ? root : ((root as Element).ownerDocument ?? document);
  ownerDocument.querySelector(`[${CONVERSATION_GUTTER_ATTRIBUTE}]`)?.remove();
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

  const syncNativeWorkspaceDiffVisibility = (): void => {
    const replacementAvailable = [...bars.values()].some(
      (bar) => bar.isConnected && Boolean(bar.querySelector(`[${WORKSPACE_FILES_ATTRIBUTE}]`)),
    );
    setNativeWorkspaceDiffControlsHidden(root, replacementAvailable);
  };

  const removeBar = (composer: Element): void => {
    bars.get(composer)?.remove();
    bars.delete(composer);
    signatures.delete(composer);
    generations.delete(composer);
    loadedThreadIds.delete(composer);
    lastSnapshot.delete(composer);
    filesExpanded.delete(composer);
    clearConversationGutter(root);
    syncNativeWorkspaceDiffVisibility();
  };

  const hidePreview = (): void => {
    preview.hidden = true;
    preview.replaceChildren();
  };

  const visibleComposer = (): Element | null =>
    [...root.querySelectorAll(CODEX_COMPOSER_SELECTOR)].find((composer) =>
      composerVisible(composer),
    ) ?? null;

  const showPreview = (file: ThreadConversationFile, anchor: DOMRect, chinese: boolean): void => {
    fillDiffPreview(preview, file.preview, chinese);
    preview.hidden = false;
    placePreview(preview, anchor, visibleComposer());
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
    const repositories = repositoriesForConversationFiles(snapshot, files);
    const fileDisclosureAvailable = files.length > 0 || turnFiles !== null;
    if (!fileDisclosureAvailable) {
      bar.setAttribute(WORKSPACE_BAR_ATTRIBUTE, "empty");
      bar.remove();
      clearConversationGutter(root);
      syncNativeWorkspaceDiffVisibility();
      return;
    }
    const chinese = chineseLocale(documentNode);
    const expanded = filesExpanded.get(composer) ?? false;
    const list = documentNode.createElement("div");
    list.setAttribute(WORKSPACE_FILES_ATTRIBUTE, expanded ? "open" : "collapsed");
    const heading = documentNode.createElement("button");
    heading.type = "button";
    heading.className = "codexhost-workspace-files-toggle";
    heading.setAttribute("aria-expanded", expanded ? "true" : "false");
    const filtered = turnFiles !== null;
    const changeLabel = chinese
      ? `${filtered ? "本轮" : "变更"} ${files.length} 个文件`
      : `${files.length} ${files.length === 1 ? "file" : "files"}${filtered ? " this turn" : " changed"}`;
    heading.setAttribute(
      "aria-label",
      chinese
        ? `${expanded ? "折叠" : "展开"}${changeLabel}`
        : `${expanded ? "Collapse" : "Expand"} ${changeLabel}`,
    );
    const count = documentNode.createElement("span");
    count.className = "codexhost-workspace-files-count";
    count.textContent = changeLabel;
    const aggregate = aggregateConversationFileStats(files);
    const aggregateStats = documentNode.createElement("span");
    aggregateStats.className = "codexhost-workspace-summary-stats";
    const aggregateAdded = documentNode.createElement("span");
    aggregateAdded.className = "codexhost-workspace-added";
    aggregateAdded.textContent = `+${aggregate.addedLines.toLocaleString()}`;
    const aggregateDeleted = documentNode.createElement("span");
    aggregateDeleted.className = "codexhost-workspace-deleted";
    aggregateDeleted.textContent = `-${aggregate.deletedLines.toLocaleString()}`;
    aggregateStats.append(aggregateAdded, aggregateDeleted);
    const chevron = documentNode.createElement("span");
    chevron.className = "codexhost-workspace-files-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = expanded ? "▾" : "▸";
    heading.append(count, aggregateStats, chevron);
    heading.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      filesExpanded.set(composer, !(filesExpanded.get(composer) ?? false));
      signatures.delete(composer);
      paint(composer, lastSnapshot.get(composer) ?? snapshot);
    });
    const rows = documentNode.createElement("div");
    rows.className = "codexhost-workspace-files-list";
    rows.setAttribute("data-codexhost-workspace-file-list", "upward-right");
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
      const previewFile = (): void => {
        showPreview(file, row.getBoundingClientRect(), chinese);
      };
      row.addEventListener("mouseenter", previewFile);
      row.addEventListener("mouseleave", hidePreview);
      row.addEventListener("focus", previewFile);
      row.addEventListener("blur", hidePreview);
      row.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        hidePreview();
        openConversationFile(file);
      });
      rows.append(row);
    }
    list.append(heading, rows);
    if (repositories.length > 0) {
      const chips = documentNode.createElement("div");
      chips.className = "codexhost-workspace-chips";
      for (const repository of repositories) {
        chips.append(renderRow(documentNode, repository));
      }
      bar.append(chips);
    }
    bar.append(list);
    bar.setAttribute(WORKSPACE_BAR_ATTRIBUTE, snapshot?.threadId ?? "ready");
    placeBar(bar, composer);
    clearConversationGutter(root);
    syncNativeWorkspaceDiffVisibility();
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
    syncNativeWorkspaceDiffVisibility();
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
    }, 200);
  };

  const reposition = (): void => {
    for (const [composer, bar] of bars) {
      if (composer.isConnected) placeBar(bar, composer);
    }
    clearConversationGutter(root);
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
      documentNode.defaultView?.dispatchEvent(
        new CustomEvent("codexhost:turn-files-selected", {
          detail: { threadId, turnKey: next },
        }),
      );
    }
  };

  const observer = new MutationObserver((mutations) => {
    const ours = (node: Node): boolean =>
      node instanceof Element &&
      Boolean(
        node.closest(
          "[data-codexhost-workspace-bar], [data-codexhost-turn-actions], [data-codexhost-turn-rail], [data-codexhost-workspace-preview], [data-codexhost-prompt-ghost]",
        ),
      );
    if (mutations.every((mutation) => ours(mutation.target))) return;
    scheduleScan();
  });
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
  documentNode.defaultView?.addEventListener("scroll", reposition, true);
  documentNode.defaultView?.addEventListener("resize", reposition);
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
      documentNode.defaultView?.removeEventListener("scroll", reposition, true);
      documentNode.defaultView?.removeEventListener("resize", reposition);
      if (scanTimer !== null) clearTimeout(scanTimer);
      highlightTurns(null);
      unsubscribe?.();
      unsubscribe = null;
      hidePreview();
      preview.remove();
      documentNode.querySelector(`[${CONVERSATION_GUTTER_ATTRIBUTE}]`)?.remove();
      for (const composer of [...bars.keys()]) removeBar(composer);
    },
  };
}
