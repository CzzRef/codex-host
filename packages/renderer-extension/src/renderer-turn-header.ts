import { EDITOR_SELECTOR } from "./renderer-composer-dom.js";
import { isComposerTurnBusy } from "./renderer-composer-prompt-reuse.js";
import { turnKeyMatches } from "./renderer-conversation-files.js";
import type { RendererModelClient } from "./renderer-model-client.js";
import {
  ensureNativeDiffControlStyle,
  setNativeWorkspaceDiffControlsHidden,
} from "./renderer-native-diff-controls.js";
import {
  OVERLAY_ROOT_ATTRIBUTE,
  OVERLAY_ROOT_SELECTOR,
  appShellChromeBottom,
  chineseLocale,
  ensureOverlayChromeStyle,
  overflowScroller,
  promptPinned,
  releaseTranscriptColumn,
  releaseTranscriptReservation,
  reserveTranscriptTop,
  reservedBasePadding,
  resolveCurrentTurn,
  scrollContainerFor,
  scrollDeltaToTurn,
  transcriptColumn,
  transcriptTopReserve,
  transcriptTurns,
  turnHeaderBox,
  turnKeyOf,
} from "./renderer-overlay-layout.js";
import { threadIdForComposer, visibleComposers } from "./renderer-thread-composer.js";
import {
  createTurnActionController,
  type TurnActionController,
} from "./renderer-turn-action-controller.js";
import { createTurnHeaderView, type TurnHeaderView } from "./renderer-turn-header-row.js";
import { createWorkspaceRowPainter } from "./renderer-turn-header-workspace.js";
import {
  nativeTurnButton,
  renderTurnActionCluster,
  turnInNativeEdit,
  turnPromptElement,
  turnPromptText,
  type TurnActionBlock,
} from "./renderer-turn-actions.js";
import { createWorkspaceFilesState } from "./renderer-workspace-files-state.js";
import {
  WORKSPACE_FILES_ATTRIBUTE,
  createDiffPreviewOverlay,
  ensureWorkspaceSurfaceStyle,
} from "./renderer-workspace-surface.js";
import headerCss from "./turn-header.css";

/** Value: the Thread id the header describes. */
export const TURN_HEADER_ATTRIBUTE = "data-codexhost-turn-header";
export {
  TURN_HEADER_EXPAND_ATTRIBUTE,
  TURN_HEADER_INDEX_ATTRIBUTE,
  TURN_HEADER_PANEL_ATTRIBUTE,
  TURN_HEADER_PROMPT_ATTRIBUTE,
  TURN_HEADER_WORKSPACE_ATTRIBUTE,
} from "./renderer-turn-header-row.js";

const STYLE_ATTRIBUTE = "data-codexhost-turn-header-style";
const HEADER_CLASS = "codexhost-turn-header";
/** Overlays that are not transcript content and must not trigger rescans. */
const FOREIGN_OVERLAY_SELECTOR = `${OVERLAY_ROOT_SELECTOR}, [data-codexhost-prompt-ghost], [data-codexhost-draft-worktree-picker], [data-codexhost-draft-worktree-menu]`;
const RESERVE_GAP = 8;
/** How far the last Turn's bottom may sit under the visible bottom and still count as "at the end". */
const BOTTOM_TOLERANCE = 24;
/** After a rollback, a briefly empty transcript keeps the previous label. */
const RELOAD_GRACE_MS = 600;

export interface RendererTurnHeader {
  refresh(): void;
  dispose(): void;
}

interface HeaderState {
  composer: Element;
  threadId: string;
  view: TurnHeaderView;
  controller: TurnActionController;
  scroller: HTMLElement | null;
  column: HTMLElement | null;
  turns: Element[];
  keys: string[];
  currentIndex: number | null;
  currentKey: string | null;
  pinned: boolean;
  blocked: TurnActionBlock | null;
  filesExpanded: boolean;
  lastBox: string;
  lastPaint: string;
  lastWorkspace: string;
  reloadUntil: number;
  columnObserver: ResizeObserver | null;
}

function ensureStyle(ownerDocument: Document): void {
  ensureOverlayChromeStyle(ownerDocument);
  ensureNativeDiffControlStyle(ownerDocument);
  ensureWorkspaceSurfaceStyle(ownerDocument);
  if (ownerDocument.querySelector(`style[${STYLE_ATTRIBUTE}]`)) return;
  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "true");
  style.textContent = headerCss;
  (ownerDocument.head ?? ownerDocument.documentElement).append(style);
}

const sameTurn = (left: string, right: string): boolean =>
  turnKeyMatches(left, right) || turnKeyMatches(right, left);

export function installRendererTurnHeader(options: {
  getClient(): RendererModelClient | null;
  root?: ParentNode;
}): RendererTurnHeader {
  const root = options.root ?? document;
  const documentNode =
    root instanceof Document ? root : ((root as Element).ownerDocument ?? document);
  const view = documentNode.defaultView;
  ensureStyle(documentNode);
  const headers = new Map<Element, HeaderState>();
  const promptTextCache = new WeakMap<Element, string>();
  const preview = createDiffPreviewOverlay(documentNode);
  let disposed = false;
  let frame: number | null = null;
  let scanPending = true;

  const chinese = (): boolean => chineseLocale(documentNode);

  const scheduleFrame = (scan = false): void => {
    if (scan) scanPending = true;
    if (disposed || frame !== null) return;
    if (!view?.requestAnimationFrame) {
      runFrame();
      return;
    }
    frame = view.requestAnimationFrame(runFrame);
  };

  const filesState = createWorkspaceFilesState({
    getClient: options.getClient,
    onChange(threadId) {
      for (const state of headers.values()) {
        if (state.threadId === threadId) state.lastWorkspace = "";
      }
      scheduleFrame();
    },
  });

  const currentTurn = (state: HeaderState): Element | null =>
    state.currentIndex === null ? null : (state.turns[state.currentIndex] ?? null);

  const promptTextFor = (turn: Element): string => {
    const cached = promptTextCache.get(turn);
    if (cached !== undefined) return cached;
    const text = turnPromptText(turn);
    promptTextCache.set(turn, text);
    return text;
  };

  const paintCluster = (state: HeaderState): void => {
    renderTurnActionCluster(
      state.view.cluster,
      state.controller.view({ chinese: chinese(), blocked: state.blocked }),
      {
        onActivate: (id) => state.controller.activate(id),
        onConfirm: () => state.controller.confirm(),
        onCancel: () => state.controller.cancel(),
      },
    );
  };

  const syncNativeDiffVisibility = (): void => {
    const replacementAvailable = [...headers.values()].some(
      (state) =>
        state.view.root.isConnected &&
        state.view.root.getAttribute("data-state") === "ready" &&
        state.view.workspace.querySelector(`[${WORKSPACE_FILES_ATTRIBUTE}]`) !== null,
    );
    setNativeWorkspaceDiffControlsHidden(root, replacementAvailable);
  };

  const workspaceRow = createWorkspaceRowPainter({
    ownerDocument: documentNode,
    filesState,
    preview,
    chinese,
    scheduleFrame: () => scheduleFrame(),
    syncNativeDiffVisibility,
  });

  const collapseAll = (state: HeaderState): void => {
    state.view.collapsePanel();
    workspaceRow.collapse(state);
    state.controller.cancel();
  };

  const hideHeader = (state: HeaderState, reason: "hidden" | "ambiguous"): void => {
    state.view.root.setAttribute("data-state", reason);
    state.lastBox = "";
    state.lastPaint = "";
    if (state.column) releaseTranscriptColumn(state.column);
    collapseAll(state);
    preview.hide();
    syncNativeDiffVisibility();
  };

  const measure = (state: HeaderState): void => {
    if (!view) return;
    const composerRect = state.composer.getBoundingClientRect();
    const scrollerRect = state.scroller?.getBoundingClientRect() ?? null;
    const scrollerTop = scrollerRect?.top ?? 0;
    const scrollerBottom = scrollerRect?.bottom ?? view.innerHeight;
    const first = state.turns[0] ?? null;
    const firstRect = first?.getBoundingClientRect() ?? null;
    const anchor = {
      left: Math.min(composerRect.left, firstRect?.left ?? composerRect.left),
      right: Math.max(composerRect.right, firstRect?.right ?? composerRect.right),
    };
    const rootNode = state.view.root;
    const height = rootNode.offsetHeight || 40;
    const box = turnHeaderBox({
      anchor,
      scrollerTop,
      chromeBottom: appShellChromeBottom(documentNode, anchor),
      composerTop: composerRect.top,
      viewportWidth: view.innerWidth,
      height,
    });
    if (!box) {
      hideHeader(state, "hidden");
      return;
    }
    if (rootNode.getAttribute("data-state") === "hidden")
      rootNode.setAttribute("data-state", "ready");
    const boxKey = `${box.left}:${box.top}:${box.width}`;
    let boxChanged = false;
    if (state.lastBox !== boxKey) {
      state.lastBox = boxKey;
      boxChanged = true;
      rootNode.style.left = `${box.left}px`;
      rootNode.style.top = `${box.top}px`;
      rootNode.style.width = `${box.width}px`;
    }
    const headerBottom = box.top + height;

    // Reserve transcript space so the first Turn clears the header at scroll-top.
    if (state.column && state.scroller) {
      const columnRect = state.column.getBoundingClientRect();
      const columnPadding = Number.parseFloat(view.getComputedStyle(state.column).paddingTop) || 0;
      const scrollerPadding =
        Number.parseFloat(view.getComputedStyle(state.scroller).paddingTop) || 0;
      const spacers = firstRect ? Math.max(0, firstRect.top - columnRect.top - columnPadding) : 0;
      const need = headerBottom + RESERVE_GAP - (scrollerTop + scrollerPadding);
      reserveTranscriptTop(
        state.column,
        transcriptTopReserve({
          need,
          spacers,
          basePaddingTop: reservedBasePadding(state.column),
        }),
      );
    }

    // Which Turn the header describes.
    const count = state.turns.length;
    const rects = new Map<number, DOMRect>();
    const rectAt = (index: number): DOMRect => {
      let rect = rects.get(index);
      if (!rect) {
        rect = state.turns[index]?.getBoundingClientRect() ?? new DOMRect();
        rects.set(index, rect);
      }
      return rect;
    };
    const visibleBottom = Math.min(composerRect.top, scrollerBottom);
    const atBottom = count > 0 && rectAt(count - 1).bottom <= visibleBottom + BOTTOM_TOLERANCE;
    const index = resolveCurrentTurn({
      count,
      topAt: (position) => rectAt(position).top,
      atBottom,
      headerBottom,
      previous: state.currentIndex,
    });
    const key = index === null ? null : (state.keys[index] ?? null);
    const turn = index === null ? null : (state.turns[index] ?? null);
    const keyChanged = key !== state.currentKey;
    state.currentIndex = index;
    state.currentKey = key;

    let pinned = false;
    if (turn && index !== null) {
      const promptNode = turnPromptElement(turn);
      pinned = promptNode
        ? promptPinned({
            promptBottom: promptNode.getBoundingClientRect().bottom,
            headerBottom,
            previous: state.pinned && !keyChanged,
          })
        : rectAt(index).top <= headerBottom - 40;
    }
    state.pinned = pinned;
    const nativeEdit = turn ? turnInNativeEdit(turn) : false;
    const busy = isComposerTurnBusy(state.composer);
    state.blocked = nativeEdit ? "nativeEdit" : busy ? "busy" : count === 0 ? "noTurns" : null;

    if (keyChanged) {
      state.view.collapsePanel();
      state.controller.setCurrent(
        turn && key ? { threadId: state.threadId, turnKey: key, turn } : null,
      );
    }
    const zh = chinese();
    const reloading = count === 0 && Date.now() < state.reloadUntil;
    const signature = [
      state.threadId,
      index,
      count,
      key,
      pinned,
      nativeEdit,
      busy,
      reloading,
      zh,
      pinned && turn ? promptTextFor(turn).length : 0,
    ].join("|");
    if (signature !== state.lastPaint) {
      state.lastPaint = signature;
      state.view.paintRow({
        count,
        index,
        pinned,
        nativeEdit,
        busy,
        reloading,
        chinese: zh,
        promptText: pinned && turn ? promptTextFor(turn) : "",
      });
      paintCluster(state);
    }
    if (boxChanged) state.lastWorkspace = "";
    workspaceRow.paint(state, { headerBottom });
  };

  const observeColumn = (state: HeaderState): void => {
    if (typeof ResizeObserver === "undefined") return;
    state.columnObserver?.disconnect();
    state.columnObserver = null;
    // The Composer column narrows with the sidebar and the content column
    // grows while streaming; neither raises a window event.
    state.columnObserver = new ResizeObserver(() => scheduleFrame());
    state.columnObserver.observe(state.view.root);
    state.columnObserver.observe(state.composer);
    if (state.column) state.columnObserver.observe(state.column);
  };

  const refreshTurns = (state: HeaderState): void => {
    const scope: ParentNode = state.scroller ?? root;
    let turns = transcriptTurns(scope, sameTurn);
    const first = turns[0] ?? null;
    // Short Threads have no overflow yet, so the walk accepts any vertical scroller.
    const scroller =
      (first ? scrollContainerFor(first) : null) ??
      state.scroller ??
      overflowScroller(state.composer) ??
      scrollContainerFor(state.composer);
    if (scroller !== state.scroller && state.column) releaseTranscriptColumn(state.column);
    state.scroller = scroller;
    if (scroller && scope !== scroller) {
      const scoped = transcriptTurns(scroller, sameTurn);
      if (scoped.length > 0) turns = scoped;
    }
    state.turns = turns;
    state.keys = turns.map(turnKeyOf);
    const column = scroller ? transcriptColumn(scroller, turns[0] ?? null) : null;
    const usableColumn = column && !column.contains(state.composer) ? column : null;
    if (usableColumn !== state.column) {
      if (state.column) releaseTranscriptColumn(state.column);
      state.column = usableColumn;
      observeColumn(state);
    }
    if (state.currentKey !== null) {
      const stillAt = state.keys.findIndex(
        (key) => state.currentKey !== null && sameTurn(key, state.currentKey),
      );
      state.currentIndex = stillAt >= 0 ? stillAt : null;
      if (stillAt < 0) state.currentKey = null;
    }
  };

  const mount = (composer: Element, threadId: string): HeaderState => {
    const headerView = createTurnHeaderView(documentNode, {
      threadId,
      rootAttribute: TURN_HEADER_ATTRIBUTE,
      overlayAttribute: OVERLAY_ROOT_ATTRIBUTE,
      className: HEADER_CLASS,
      onPromptClick: () => {
        const turn = currentTurn(state);
        if (!turn || state.blocked === "nativeEdit") return;
        const headerBottom = state.view.root.getBoundingClientRect().bottom;
        const delta = scrollDeltaToTurn({
          turnTop: turn.getBoundingClientRect().top,
          headerBottom,
        });
        if (state.scroller) state.scroller.scrollBy({ top: delta, behavior: "smooth" });
        else turn.scrollIntoView({ block: "start" });
      },
    });
    (documentNode.body ?? documentNode.documentElement).append(headerView.root);
    const state: HeaderState = {
      composer,
      threadId,
      view: headerView,
      controller: createTurnActionController({
        getClient: options.getClient,
        orderedTurnKeys: () => state.keys,
        composerEditor: () => {
          const editor = state.composer.querySelector(EDITOR_SELECTOR);
          return editor instanceof HTMLElement ? editor : null;
        },
        nativeRedoButton: () => nativeTurnButton(documentNode.documentElement, /^redo$|^重做$/i),
        chinese,
        notify: (text) => state.view.notify(text),
        onChange: () => {
          if (disposed || !headers.has(state.composer)) return;
          state.reloadUntil = Date.now() + RELOAD_GRACE_MS;
          paintCluster(state);
          scheduleFrame(true);
        },
      }),
      scroller: null,
      column: null,
      turns: [],
      keys: [],
      currentIndex: null,
      currentKey: null,
      pinned: false,
      blocked: null,
      filesExpanded: false,
      lastBox: "",
      lastPaint: "",
      lastWorkspace: "",
      reloadUntil: 0,
      columnObserver: null,
    };
    headers.set(composer, state);
    observeColumn(state);
    filesState.ensureLoaded(threadId);
    return state;
  };

  const unmount = (composer: Element): void => {
    const state = headers.get(composer);
    if (!state) return;
    headers.delete(composer);
    state.controller.dispose();
    state.columnObserver?.disconnect();
    if (state.column) releaseTranscriptColumn(state.column);
    state.view.dispose();
    preview.hide();
    syncNativeDiffVisibility();
  };

  const switchThread = (state: HeaderState, threadId: string): void => {
    state.threadId = threadId;
    state.view.setThreadId(threadId);
    state.currentIndex = null;
    state.currentKey = null;
    state.pinned = false;
    state.filesExpanded = false;
    state.lastPaint = "";
    state.lastWorkspace = "";
    collapseAll(state);
    state.controller.setCurrent(null);
    filesState.ensureLoaded(threadId);
  };

  const scan = (): void => {
    filesState.connect();
    const live = new Set<Element>();
    for (const composer of visibleComposers(root)) {
      const threadId = threadIdForComposer(composer);
      if (!threadId) {
        unmount(composer);
        continue;
      }
      live.add(composer);
      let state = headers.get(composer);
      if (!state) state = mount(composer, threadId);
      else if (state.threadId !== threadId) switchThread(state, threadId);
      refreshTurns(state);
    }
    for (const composer of [...headers.keys()]) {
      if (!live.has(composer) || !composer.isConnected) unmount(composer);
    }
    // Two Composers over one transcript is ambiguous ownership: mount nothing there.
    const byScroller = new Map<HTMLElement, HeaderState[]>();
    for (const state of headers.values()) {
      if (!state.scroller) continue;
      byScroller.set(state.scroller, [...(byScroller.get(state.scroller) ?? []), state]);
    }
    for (const group of byScroller.values()) {
      if (group.length < 2) continue;
      for (const state of group) hideHeader(state, "ambiguous");
    }
  };

  const runFrame = (): void => {
    frame = null;
    if (disposed) return;
    if (scanPending) {
      scanPending = false;
      scan();
    }
    for (const state of headers.values()) {
      if (state.view.root.getAttribute("data-state") === "ambiguous") continue;
      measure(state);
    }
  };

  const insideOverlay = (target: EventTarget | null): boolean =>
    target instanceof Element &&
    target.closest(`[${TURN_HEADER_ATTRIBUTE}], [data-codexhost-workspace-preview]`) !== null;

  const onScroll = (event: Event): void => {
    if (!insideOverlay(event.target)) {
      for (const state of headers.values()) {
        state.view.collapsePanel();
        workspaceRow.collapse(state);
      }
      preview.hide();
    }
    scheduleFrame();
  };
  const onResize = (): void => {
    for (const state of headers.values()) state.lastBox = "";
    scheduleFrame();
  };
  const onDocumentPointerDown = (event: Event): void => {
    if (insideOverlay(event.target)) return;
    for (const state of headers.values()) collapseAll(state);
    preview.hide();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    for (const state of headers.values()) collapseAll(state);
    preview.hide();
  };

  view?.addEventListener("scroll", onScroll, true);
  view?.addEventListener("resize", onResize);
  documentNode.addEventListener("pointerdown", onDocumentPointerDown, true);
  documentNode.addEventListener("keydown", onKeyDown);
  const observer = new MutationObserver((mutations) => {
    if (disposed) return;
    let foreign = false;
    for (const mutation of mutations) {
      const target =
        mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      if (!target || target.closest(FOREIGN_OVERLAY_SELECTOR)) continue;
      foreign = true;
      for (const state of headers.values()) {
        const turn = currentTurn(state);
        if (turn && turn.contains(target)) promptTextCache.delete(turn);
      }
    }
    if (foreign) scheduleFrame(true);
  });
  observer.observe(documentNode.documentElement ?? documentNode, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "data-turn-key",
      "data-content-search-turn-key",
      "hidden",
      "aria-hidden",
      "data-codex-composer-root",
      "data-above-composer-conversation-id",
    ],
  });
  scheduleFrame(true);

  return {
    refresh() {
      if (disposed) return;
      filesState.reset();
      for (const state of headers.values()) {
        state.lastPaint = "";
        state.lastWorkspace = "";
        filesState.ensureLoaded(state.threadId);
        void state.controller.refresh();
      }
      scheduleFrame(true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      if (frame !== null) view?.cancelAnimationFrame?.(frame);
      view?.removeEventListener("scroll", onScroll, true);
      view?.removeEventListener("resize", onResize);
      documentNode.removeEventListener("pointerdown", onDocumentPointerDown, true);
      documentNode.removeEventListener("keydown", onKeyDown);
      for (const composer of [...headers.keys()]) unmount(composer);
      filesState.dispose();
      preview.dispose();
      releaseTranscriptReservation(documentNode);
      setNativeWorkspaceDiffControlsHidden(root, false);
    },
  };
}
