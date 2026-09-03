import { hostThreadIdSchema, type ThreadWorkspaceSnapshot } from "@codexhost/shared-contracts";

import {
  aggregateConversationFileStats,
  conversationFilesFromItems,
  filesForTurnSelection,
  groupConversationFilesByRepository,
  mergeConversationFiles,
  repositoryDisplayName,
  snapshotSignature,
  turnKeyMatches,
  workspaceLocationLabel,
  type ConversationFileGroup,
  type ThreadConversationFile,
} from "./renderer-conversation-files.js";
import { CODEX_COMPOSER_SELECTOR } from "./renderer-composer-dom.js";
import {
  ensureNativeDiffControlStyle,
  openConversationFile,
  setNativeWorkspaceDiffControlsHidden,
} from "./renderer-native-diff-controls.js";
import {
  CONVERSATION_GUTTER_ATTRIBUTE,
  OVERLAY_ROOT_ATTRIBUTE,
  chineseLocale,
  clampFixedBox,
  ensureOverlayChromeStyle,
  overflowScroller,
  overlayTopAboveComposer,
} from "./renderer-overlay-layout.js";
import type { RendererModelClient } from "./renderer-model-client.js";
import { composerVisible, threadIdForComposer } from "./renderer-thread-composer.js";

export const WORKSPACE_BAR_ATTRIBUTE = "data-codexhost-workspace-bar";
export const WORKSPACE_BAR_SELECTOR = `[${WORKSPACE_BAR_ATTRIBUTE}]`;
export const WORKSPACE_ROW_ATTRIBUTE = "data-codexhost-workspace-row";
export const WORKSPACE_CORE_ATTRIBUTE = "data-codexhost-workspace-core";
export const WORKSPACE_MORE_ATTRIBUTE = "data-codexhost-workspace-more";
export const WORKSPACE_FILES_ATTRIBUTE = "data-codexhost-workspace-files";
export const WORKSPACE_FILE_ATTRIBUTE = "data-codexhost-workspace-file";
export const WORKSPACE_PREVIEW_ATTRIBUTE = "data-codexhost-workspace-preview";
export const TURN_FILES_ATTRIBUTE = "data-codexhost-turn-files";

const STYLE_ATTRIBUTE = "data-codexhost-workspace-bar-style";
const BAR_CLASS = "codexhost-workspace-bar";
const PREVIEW_HIDE_GRACE_MS = 120;
/** Anonymous (Item-less) file updates merge under this key and never retire. */
const LEGACY_ITEM_KEY = "\u0000legacy";

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
  ensureNativeDiffControlStyle(ownerDocument);
  ownerDocument.querySelector(`style[${STYLE_ATTRIBUTE}]`)?.remove();
  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "true");
  style.textContent = `
    .${BAR_CLASS} {
      display: flex;
      align-items: center;
      gap: 6px;
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
      align-items: center;
      gap: 4px;
      min-width: 0;
      overflow: hidden;
    }
    .${BAR_CLASS} [${WORKSPACE_ROW_ATTRIBUTE}] {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 6px;
      min-width: 0;
      max-width: 100%;
      min-height: 24px;
      padding: 0 6px;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font-size: 11px;
      line-height: 15px;
    }
    .${BAR_CLASS} [${WORKSPACE_ROW_ATTRIBUTE}][hidden] {
      display: none;
    }
    .${BAR_CLASS} [${WORKSPACE_ROW_ATTRIBUTE}] span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .${BAR_CLASS} [${WORKSPACE_CORE_ATTRIBUTE}="true"] {
      border-color: rgb(255 255 255 / 12%);
      background: rgb(255 255 255 / 6%);
    }
    .${BAR_CLASS} [${WORKSPACE_CORE_ATTRIBUTE}="true"]::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--color-codex-git-added, #3fb950);
      flex: 0 0 auto;
    }
    .${BAR_CLASS} .codexhost-workspace-tree {
      font-weight: 650;
    }
    .${BAR_CLASS} .codexhost-workspace-worktree,
    .${BAR_CLASS} .codexhost-workspace-branch {
      color: rgb(255 255 255 / 62%);
    }
    .${BAR_CLASS} .codexhost-workspace-row-stats {
      display: inline-flex;
      gap: 4px;
      font-variant-numeric: tabular-nums;
    }
    .${BAR_CLASS} [${WORKSPACE_MORE_ATTRIBUTE}] {
      position: relative;
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      min-height: 24px;
      padding: 0 8px;
      appearance: none;
      border: 1px solid rgb(255 255 255 / 12%);
      border-radius: 999px;
      background: rgb(255 255 255 / 5%);
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
    .${BAR_CLASS} [${WORKSPACE_MORE_ATTRIBUTE}][hidden] {
      display: none;
    }
    .${BAR_CLASS} .codexhost-workspace-more-list {
      position: absolute;
      left: 0;
      bottom: calc(100% + 8px);
      z-index: 3;
      display: none;
      flex-direction: column;
      gap: 2px;
      min-width: 220px;
      max-width: min(480px, calc(100vw - 24px));
      padding: 6px;
      border: 1px solid rgb(255 255 255 / 12%);
      border-radius: 10px;
      background: rgb(17 17 17 / 96%);
      box-shadow: 0 12px 32px rgb(0 0 0 / 38%);
      backdrop-filter: blur(18px);
    }
    .${BAR_CLASS} [${WORKSPACE_MORE_ATTRIBUTE}]:hover .codexhost-workspace-more-list,
    .${BAR_CLASS} [${WORKSPACE_MORE_ATTRIBUTE}]:focus-within .codexhost-workspace-more-list,
    .${BAR_CLASS} [${WORKSPACE_MORE_ATTRIBUTE}][aria-expanded="true"] .codexhost-workspace-more-list {
      display: flex;
    }
    .${BAR_CLASS} [data-codexhost-workspace-more-row] {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 24px;
      padding: 0 6px;
      font-size: 11px;
      line-height: 15px;
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
    .${BAR_CLASS} .codexhost-workspace-added,
    [${WORKSPACE_PREVIEW_ATTRIBUTE}] .codexhost-workspace-added {
      color: var(--color-codex-git-added, #3fb950);
    }
    .${BAR_CLASS} .codexhost-workspace-deleted,
    [${WORKSPACE_PREVIEW_ATTRIBUTE}] .codexhost-workspace-deleted {
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
    .${BAR_CLASS} .codexhost-workspace-files-group {
      padding: 4px 4px 2px;
      color: rgb(255 255 255 / 55%);
      font-size: 10px;
      letter-spacing: 0.02em;
      text-transform: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
    .${BAR_CLASS} [${WORKSPACE_FILE_ATTRIBUTE}]:hover,
    .${BAR_CLASS} [${WORKSPACE_FILE_ATTRIBUTE}][data-previewing="true"] {
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
      display: flex;
      flex-direction: column;
      width: min(560px, 60vw);
      max-height: min(420px, 50vh);
      box-sizing: border-box;
      overflow: hidden;
      border: 1px solid rgba(127, 127, 127, 0.28);
      border-radius: 10px;
      background: rgba(20, 20, 20, 0.97);
      color: inherit;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.42);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      line-height: 16px;
      pointer-events: auto;
    }
    [${WORKSPACE_PREVIEW_ATTRIBUTE}][hidden] {
      display: none;
    }
    [${WORKSPACE_PREVIEW_ATTRIBUTE}] .codexhost-workspace-preview-head {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
      padding: 6px 10px;
      border-bottom: 1px solid rgb(255 255 255 / 8%);
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 11px;
    }
    [${WORKSPACE_PREVIEW_ATTRIBUTE}] .codexhost-workspace-preview-head code {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      direction: rtl;
      text-align: left;
    }
    [${WORKSPACE_PREVIEW_ATTRIBUTE}] .codexhost-workspace-preview-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
      padding: 8px 10px;
      white-space: pre;
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

function formatStats(
  ownerDocument: Document,
  addedLines: number,
  deletedLines: number,
  className: string,
): HTMLSpanElement {
  const stats = ownerDocument.createElement("span");
  stats.className = className;
  const added = ownerDocument.createElement("span");
  added.className = "codexhost-workspace-added";
  added.textContent = `+${addedLines.toLocaleString()}`;
  const deleted = ownerDocument.createElement("span");
  deleted.className = "codexhost-workspace-deleted";
  deleted.textContent = `-${deletedLines.toLocaleString()}`;
  stats.append(added, deleted);
  return stats;
}

function renderRow(
  ownerDocument: Document,
  group: ConversationFileGroup,
  chinese: boolean,
): HTMLDivElement {
  const { repository } = group;
  const row = ownerDocument.createElement("div");
  row.setAttribute(WORKSPACE_ROW_ATTRIBUTE, repository.kind);
  if (group.core) row.setAttribute(WORKSPACE_CORE_ATTRIBUTE, "true");
  // Bold: where the files live (worktree directory or checkout folder).
  // Muted: the checkout a worktree belongs to, then the branch.
  const display = workspaceLocationLabel(repository);
  const owner = repositoryDisplayName(repository);
  const branchText = repository.branch ?? repository.headSha;
  const location = ownerDocument.createElement("span");
  location.className = "codexhost-workspace-tree";
  location.textContent = display;
  row.append(location);
  if (repository.isWorktree && owner !== display) {
    const tree = ownerDocument.createElement("span");
    tree.className = "codexhost-workspace-worktree";
    tree.textContent = chinese ? `${owner} 的工作树` : `${owner} worktree`;
    row.append(tree);
  }
  // A worktree named after its branch reads once, not `foo · foo`.
  if (branchText !== display) {
    const branch = ownerDocument.createElement("span");
    branch.className = "codexhost-workspace-branch";
    branch.textContent = `· ${branchText}`;
    row.append(branch);
  }
  if (group.addedLines + group.deletedLines > 0) {
    row.append(
      formatStats(
        ownerDocument,
        group.addedLines,
        group.deletedLines,
        "codexhost-workspace-row-stats",
      ),
    );
  }
  const roleLabel = group.core
    ? chinese
      ? "核心工作区"
      : "Core workspace"
    : repository.kind === "external"
      ? chinese
        ? "涉及的外部仓库"
        : "External repository touched"
      : chinese
        ? "涉及的仓库"
        : "Repository touched";
  row.title = `${roleLabel}\n${repository.root}\n${branchText}`;
  return row;
}

/**
 * Keeps the compact line single-row: trailing repository chips that do not
 * fit are hidden behind a `+N` chip whose hover list shows them in full.
 */
export function fitWorkspaceChips(chips: HTMLElement): number {
  const rows = [...chips.querySelectorAll<HTMLElement>(`:scope > [${WORKSPACE_ROW_ATTRIBUTE}]`)];
  const more = chips.querySelector<HTMLElement>(`:scope > [${WORKSPACE_MORE_ATTRIBUTE}]`);
  for (const row of rows) row.hidden = false;
  if (!more) return 0;
  more.hidden = true;
  const list = more.querySelector<HTMLElement>(".codexhost-workspace-more-list");
  list?.replaceChildren();
  let hidden = 0;
  const overflows = (): boolean => chips.scrollWidth > chips.clientWidth + 1;
  while (overflows() && rows.length - hidden > 1) {
    const row = rows[rows.length - 1 - hidden];
    if (!row) break;
    row.hidden = true;
    hidden += 1;
    more.hidden = false;
    more.replaceChildren();
    more.textContent = `+${hidden}`;
    if (list) more.append(list);
  }
  if (hidden > 0 && list) {
    for (const row of rows.slice(rows.length - hidden)) {
      const clone = row.cloneNode(true) as HTMLElement;
      clone.hidden = false;
      // Clones are presentation only; they must not read as extra rows.
      clone.removeAttribute(WORKSPACE_ROW_ATTRIBUTE);
      clone.setAttribute(
        "data-codexhost-workspace-more-row",
        row.getAttribute(WORKSPACE_ROW_ATTRIBUTE) ?? "",
      );
      list.append(clone);
    }
  }
  return hidden;
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

/**
 * Where the hover preview goes: beside the file list, never over it.
 * The list hugs the right edge of the bar, so the left side is preferred and
 * the right side is the fallback; vertically it aligns with the hovered row
 * and stays above the Composer.
 */
export function previewOrigin(input: {
  anchor: { top: number };
  list: { left: number; right: number };
  size: { width: number; height: number };
  viewportWidth: number;
  composerTop: number;
}): { left: number; top: number } {
  const leftCandidate = input.list.left - input.size.width - 8;
  const rightCandidate = input.list.right + 8;
  const left =
    leftCandidate >= 8
      ? leftCandidate
      : rightCandidate + input.size.width <= input.viewportWidth - 8
        ? rightCandidate
        : Math.max(8, leftCandidate);
  return clampFixedBox({
    left,
    top: input.anchor.top,
    width: input.size.width,
    height: input.size.height,
    viewportWidth: input.viewportWidth,
    maxBottom: input.composerTop,
  });
}

function placePreview(
  host: HTMLElement,
  anchor: DOMRect,
  list: DOMRect | null,
  composer: Element | null,
): void {
  const view = host.ownerDocument.defaultView;
  const viewportWidth = view?.innerWidth ?? 800;
  const width = Math.min(560, Math.max(280, Math.floor(viewportWidth * 0.6)), viewportWidth - 24);
  host.style.width = `${width}px`;
  const height = host.offsetHeight || 200;
  const composerTop = composer?.getBoundingClientRect().top ?? view?.innerHeight ?? 800;
  const origin = previewOrigin({
    anchor: { top: anchor.top },
    list: list
      ? { left: list.left, right: list.right }
      : { left: anchor.left, right: anchor.right },
    size: { width, height },
    viewportWidth,
    composerTop,
  });
  host.style.left = `${origin.left}px`;
  host.style.top = `${origin.top}px`;
}

/**
 * The bar is a `document.body` child so `position: fixed` measures against
 * the viewport; parked inside the Composer's parent it inherited any
 * transformed or filtered ancestor as its containing block and drifted.
 */
const RESERVE_ATTRIBUTE = "data-codexhost-workspace-reserve";

/**
 * Desktop pads the transcript for its own floating Composer only; the bar
 * floats above it, so the last transcript lines would end up underneath.
 * Pad the scrolled column by the bar's height so scroll-to-bottom shows them.
 */
function reserveTranscriptSpace(composer: Element, extra: number): void {
  const scroller = overflowScroller(composer);
  const column = scroller?.firstElementChild;
  const ownerDocument = composer.ownerDocument;
  const previous = ownerDocument.querySelector<HTMLElement>(`[${RESERVE_ATTRIBUTE}]`);
  if (previous && previous !== column) {
    previous.style.paddingBottom = "";
    previous.removeAttribute(RESERVE_ATTRIBUTE);
  }
  if (!(column instanceof HTMLElement) || column.contains(composer)) return;
  const value = extra > 0 ? `${extra}px` : "";
  if (column.style.paddingBottom !== value) column.style.paddingBottom = value;
  if (value) column.setAttribute(RESERVE_ATTRIBUTE, "true");
  else column.removeAttribute(RESERVE_ATTRIBUTE);
}

function releaseTranscriptSpace(ownerDocument: Document): void {
  const previous = ownerDocument.querySelector<HTMLElement>(`[${RESERVE_ATTRIBUTE}]`);
  if (!previous) return;
  previous.style.paddingBottom = "";
  previous.removeAttribute(RESERVE_ATTRIBUTE);
}

function placeBar(bar: HTMLElement, composer: Element): void {
  const ownerDocument = bar.ownerDocument;
  const host = ownerDocument.body ?? ownerDocument.documentElement;
  if (bar.parentElement !== host) host.append(bar);
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
  reserveTranscriptSpace(composer, Math.max(0, Math.round(rect.top - top)));
  const fileList = bar.querySelector<HTMLElement>("[data-codexhost-workspace-file-list]");
  if (fileList) {
    fileList.style.maxHeight = `min(300px, 42vh, ${Math.max(0, top - 20)}px)`;
    fileList.style.left = "auto";
    fileList.style.right = "0";
  }
  const chips = bar.querySelector<HTMLElement>(".codexhost-workspace-chips");
  // Fitting forces layout; redo it only when the bar width changed.
  if (chips && chips.dataset.fitWidth !== bar.style.width) {
    chips.dataset.fitWidth = bar.style.width;
    fitWorkspaceChips(chips);
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
  // Per Thread: File Change Item id -> that Item's current change set.
  const filesByItem = new Map<string, Map<string, ThreadConversationFile[]>>();
  const turnByItem = new Map<string, Map<string, string>>();
  const selectedTurnKey = new Map<string, string | null>();
  const lastSnapshot = new Map<Element, ThreadWorkspaceSnapshot | null>();
  const filesExpanded = new Map<Element, boolean>();
  // Absolute changed paths outside every inspected root, per Thread. They ride
  // along on every inspect so `external` rows survive re-inspection.
  const extraPathsByThread = new Map<string, string[]>();
  const requestedExtraPaths = new Map<string, string>();
  const preview = documentNode.createElement("div");
  preview.setAttribute(WORKSPACE_PREVIEW_ATTRIBUTE, "true");
  preview.setAttribute(OVERLAY_ROOT_ATTRIBUTE, "true");
  preview.hidden = true;
  const previewHead = documentNode.createElement("div");
  previewHead.className = "codexhost-workspace-preview-head";
  const previewBody = documentNode.createElement("div");
  previewBody.className = "codexhost-workspace-preview-body";
  preview.append(previewHead, previewBody);
  (documentNode.body ?? documentNode.documentElement).append(preview);
  let previewHideTimer: ReturnType<typeof setTimeout> | null = null;
  let previewingRow: HTMLElement | null = null;
  let disposed = false;
  let unsubscribe: (() => void) | null = null;
  let subscribedClient: RendererModelClient | null = null;

  const conversationFiles = (threadId: string): ThreadConversationFile[] =>
    conversationFilesFromItems(filesByItem.get(threadId) ?? new Map());

  const filesByTurn = (threadId: string): Map<string, ThreadConversationFile[]> => {
    const items = filesByItem.get(threadId) ?? new Map<string, ThreadConversationFile[]>();
    const turns = turnByItem.get(threadId) ?? new Map<string, string>();
    const grouped = new Map<string, Map<string, ThreadConversationFile[]>>();
    for (const [itemId, files] of items) {
      const turnId = turns.get(itemId);
      if (!turnId) continue;
      const bucket = grouped.get(turnId) ?? new Map<string, ThreadConversationFile[]>();
      bucket.set(itemId, files);
      grouped.set(turnId, bucket);
    }
    return new Map(
      [...grouped].map(([turnId, bucket]) => [turnId, conversationFilesFromItems(bucket)]),
    );
  };

  const syncNativeWorkspaceDiffVisibility = (): void => {
    const replacementAvailable = [...bars.values()].some(
      (bar) => bar.isConnected && Boolean(bar.querySelector(`[${WORKSPACE_FILES_ATTRIBUTE}]`)),
    );
    setNativeWorkspaceDiffControlsHidden(root, replacementAvailable);
  };

  const clearPreviewTimer = (): void => {
    if (previewHideTimer === null) return;
    clearTimeout(previewHideTimer);
    previewHideTimer = null;
  };

  const hidePreview = (): void => {
    clearPreviewTimer();
    preview.hidden = true;
    previewBody.replaceChildren();
    previewHead.replaceChildren();
    previewingRow?.removeAttribute("data-previewing");
    previewingRow = null;
  };

  const scheduleHidePreview = (): void => {
    clearPreviewTimer();
    previewHideTimer = setTimeout(() => {
      previewHideTimer = null;
      hidePreview();
    }, PREVIEW_HIDE_GRACE_MS);
  };

  preview.addEventListener("mouseenter", clearPreviewTimer);
  preview.addEventListener("mouseleave", scheduleHidePreview);

  const removeBar = (composer: Element): void => {
    bars.get(composer)?.remove();
    releaseTranscriptSpace(documentNode);
    bars.delete(composer);
    signatures.delete(composer);
    generations.delete(composer);
    loadedThreadIds.delete(composer);
    lastSnapshot.delete(composer);
    filesExpanded.delete(composer);
    clearConversationGutter(root);
    hidePreview();
    syncNativeWorkspaceDiffVisibility();
  };

  const visibleComposer = (): Element | null =>
    [...root.querySelectorAll(CODEX_COMPOSER_SELECTOR)].find((composer) =>
      composerVisible(composer),
    ) ?? null;

  const showPreview = (
    file: ThreadConversationFile,
    row: HTMLElement,
    list: HTMLElement | null,
    chinese: boolean,
  ): void => {
    clearPreviewTimer();
    previewingRow?.removeAttribute("data-previewing");
    previewingRow = row;
    row.setAttribute("data-previewing", "true");
    previewHead.replaceChildren();
    const path = documentNode.createElement("code");
    path.textContent = file.path;
    path.title = file.path;
    previewHead.append(
      path,
      formatStats(documentNode, file.addedLines, file.deletedLines, "codexhost-workspace-stats"),
    );
    fillDiffPreview(previewBody, file.preview, chinese);
    preview.hidden = false;
    placePreview(
      preview,
      row.getBoundingClientRect(),
      list?.getBoundingClientRect() ?? null,
      visibleComposer(),
    );
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

  const paint = (composer: Element, snapshot: ThreadWorkspaceSnapshot | null): void => {
    lastSnapshot.set(composer, snapshot);
    const threadId = snapshot?.threadId ?? threadIdForComposer(composer);
    const selected = threadId ? (selectedTurnKey.get(threadId) ?? null) : null;
    const turnFiles =
      threadId && selected ? filesForTurnSelection(filesByTurn(threadId), selected) : null;
    const files = turnFiles ?? (threadId ? conversationFiles(threadId) : []);
    const signature = snapshotSignature(snapshot, files, selected);
    if (signatures.get(composer) === signature && bars.get(composer)?.isConnected) {
      const existing = bars.get(composer);
      if (existing) placeBar(existing, composer);
      return;
    }
    signatures.set(composer, signature);
    hidePreview();
    let bar = bars.get(composer);
    if (!bar) {
      bar = documentNode.createElement("div");
      bar.className = BAR_CLASS;
      bar.setAttribute(WORKSPACE_BAR_ATTRIBUTE, "empty");
      bar.setAttribute(OVERLAY_ROOT_ATTRIBUTE, "true");
      bars.set(composer, bar);
    }
    bar.replaceChildren();
    const grouped = groupConversationFilesByRepository(snapshot, files);
    const fileDisclosureAvailable = files.length > 0 || turnFiles !== null;
    if (!fileDisclosureAvailable && grouped.groups.length === 0) {
      bar.setAttribute(WORKSPACE_BAR_ATTRIBUTE, "empty");
      bar.remove();
      releaseTranscriptSpace(documentNode);
      clearConversationGutter(root);
      syncNativeWorkspaceDiffVisibility();
      return;
    }
    if (threadId && grouped.unresolved.length > 0) requestExtraPaths(composer, threadId, grouped);
    const chinese = chineseLocale(documentNode);
    const chips = documentNode.createElement("div");
    chips.className = "codexhost-workspace-chips";
    for (const group of grouped.groups) chips.append(renderRow(documentNode, group, chinese));
    if (grouped.groups.length > 1) {
      const more = documentNode.createElement("button");
      more.type = "button";
      more.setAttribute(WORKSPACE_MORE_ATTRIBUTE, "true");
      more.setAttribute("aria-expanded", "false");
      more.title = chinese ? "更多涉及的仓库" : "More repositories touched";
      more.hidden = true;
      more.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        more.setAttribute(
          "aria-expanded",
          more.getAttribute("aria-expanded") === "true" ? "false" : "true",
        );
      });
      const list = documentNode.createElement("div");
      list.className = "codexhost-workspace-more-list";
      more.append(list);
      chips.append(more);
    }
    bar.append(chips);
    if (fileDisclosureAvailable) {
      bar.append(renderFileDisclosure(composer, snapshot, files, turnFiles !== null, chinese));
    }
    bar.setAttribute(WORKSPACE_BAR_ATTRIBUTE, snapshot?.threadId ?? threadId ?? "ready");
    placeBar(bar, composer);
    clearConversationGutter(root);
    syncNativeWorkspaceDiffVisibility();
  };

  const renderFileDisclosure = (
    composer: Element,
    snapshot: ThreadWorkspaceSnapshot | null,
    files: readonly ThreadConversationFile[],
    filtered: boolean,
    chinese: boolean,
  ): HTMLDivElement => {
    const expanded = filesExpanded.get(composer) ?? false;
    const list = documentNode.createElement("div");
    list.setAttribute(WORKSPACE_FILES_ATTRIBUTE, expanded ? "open" : "collapsed");
    const heading = documentNode.createElement("button");
    heading.type = "button";
    heading.className = "codexhost-workspace-files-toggle";
    heading.setAttribute("aria-expanded", expanded ? "true" : "false");
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
    const chevron = documentNode.createElement("span");
    chevron.className = "codexhost-workspace-files-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = expanded ? "▾" : "▸";
    heading.append(count);
    // "+0 -0" beside "0 files" is noise; counters appear once there is a diff.
    if (aggregate.addedLines > 0 || aggregate.deletedLines > 0) {
      heading.append(
        formatStats(
          documentNode,
          aggregate.addedLines,
          aggregate.deletedLines,
          "codexhost-workspace-summary-stats",
        ),
      );
    }
    heading.append(chevron);
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
    const grouped = groupConversationFilesByRepository(snapshot, files);
    const ownedPaths = new Set(
      grouped.groups.flatMap((group) => group.files.map((file) => file.path)),
    );
    const sections: Array<{ label: string | null; files: readonly ThreadConversationFile[] }> =
      grouped.groups.length > 1
        ? grouped.groups
            .filter((group) => group.files.length > 0)
            .map((group) => ({
              label: workspaceLocationLabel(group.repository),
              files: group.files,
            }))
        : [{ label: null, files: files.filter((file) => ownedPaths.has(file.path)) }];
    const leftovers = files.filter((file) => !ownedPaths.has(file.path));
    if (leftovers.length > 0) {
      sections.push({
        label: grouped.groups.length > 0 ? (chinese ? "其他路径" : "Other paths") : null,
        files: leftovers,
      });
    }
    if (sections.every((section) => section.files.length === 0)) {
      sections.splice(0, sections.length, { label: null, files });
    }
    for (const section of sections) {
      if (section.files.length === 0) continue;
      if (section.label) {
        const groupLabel = documentNode.createElement("div");
        groupLabel.className = "codexhost-workspace-files-group";
        groupLabel.textContent = section.label;
        rows.append(groupLabel);
      }
      for (const file of section.files) {
        const row = documentNode.createElement("button");
        row.type = "button";
        row.setAttribute(WORKSPACE_FILE_ATTRIBUTE, file.path);
        const path = documentNode.createElement("code");
        path.textContent = file.path;
        row.append(
          path,
          formatStats(
            documentNode,
            file.addedLines,
            file.deletedLines,
            "codexhost-workspace-stats",
          ),
        );
        const previewFile = (): void => {
          showPreview(file, row, rows, chinese);
        };
        row.addEventListener("mouseenter", previewFile);
        row.addEventListener("mouseleave", scheduleHidePreview);
        row.addEventListener("focus", previewFile);
        row.addEventListener("blur", scheduleHidePreview);
        row.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          hidePreview();
          openConversationFile(documentNode, file);
        });
        rows.append(row);
      }
    }
    list.append(heading, rows);
    return list;
  };

  const requestExtraPaths = (
    composer: Element,
    threadId: string,
    grouped: ReturnType<typeof groupConversationFilesByRepository>,
  ): void => {
    const merged = [
      ...new Set([...(extraPathsByThread.get(threadId) ?? []), ...grouped.unresolved]),
    ].slice(0, 64);
    extraPathsByThread.set(threadId, merged);
    const key = merged.join("\n");
    if (requestedExtraPaths.get(threadId) === key) return;
    requestedExtraPaths.set(threadId, key);
    load(composer, threadId);
  };

  const load = (composer: Element, threadId: string): void => {
    const client = options.getClient();
    if (!client) {
      paint(composer, null);
      return;
    }
    const generation = (generations.get(composer) ?? 0) + 1;
    generations.set(composer, generation);
    const extraPaths = extraPathsByThread.get(threadId) ?? [];
    void client
      .inspectThreadWorkspace({
        threadId: hostThreadIdSchema.parse(threadId),
        ...(extraPaths.length > 0 ? { extraPaths } : {}),
      })
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
      if (threadIdForComposer(composer) !== threadId) continue;
      const knownExtraPaths = extraPathsByThread.get(threadId) ?? [];
      // A Host-side re-inspect triggered by a workspace notification does not
      // know this Thread's external paths; reload so `external` rows persist.
      if (
        snapshot &&
        knownExtraPaths.length > 0 &&
        !snapshot.repositories.some((repository) => repository.kind === "external")
      ) {
        load(composer, threadId);
        continue;
      }
      paint(composer, snapshot ?? lastSnapshot.get(composer) ?? null);
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

  const reposition = (event?: Event): void => {
    const target = event?.target instanceof Element ? event.target : null;
    // Scrolling inside the preview or the file list must not tear them down.
    if (target?.closest(`[${WORKSPACE_PREVIEW_ATTRIBUTE}], ${WORKSPACE_BAR_SELECTOR}`)) return;
    for (const [composer, bar] of bars) {
      if (composer.isConnected) placeBar(bar, composer);
    }
    clearConversationGutter(root);
    if (!preview.hidden) hidePreview();
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

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && !preview.hidden) hidePreview();
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
  documentNode.addEventListener("keydown", onKeyDown);
  documentNode.defaultView?.addEventListener("scroll", reposition, true);
  documentNode.defaultView?.addEventListener("resize", reposition);
  scan();

  return {
    refresh() {
      signatures.clear();
      loadedThreadIds.clear();
      filesByItem.clear();
      turnByItem.clear();
      selectedTurnKey.clear();
      lastSnapshot.clear();
      filesExpanded.clear();
      extraPathsByThread.clear();
      requestedExtraPaths.clear();
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
      documentNode.removeEventListener("keydown", onKeyDown);
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

export { threadIdForComposer } from "./renderer-thread-composer.js";
export {
  NATIVE_WORKSPACE_DIFF_HIDDEN_ATTRIBUTE,
  isNativeWorkspaceDiffControl,
  nativeWorkspaceDiffControl,
  openNativeWorkspaceDiff,
  setNativeWorkspaceDiffControlsHidden,
} from "./renderer-native-diff-controls.js";
export {
  aggregateConversationFileStats,
  groupConversationFilesByRepository,
  repositoriesForConversationFiles,
  repositoryDisplayName,
  workspaceLocationLabel,
  worktreeLabel,
  type ConversationFileGroup,
} from "./renderer-conversation-files.js";
