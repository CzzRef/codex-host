import { EDITOR_SELECTOR } from "./renderer-composer-dom.js";
import { isComposerTurnBusy } from "./renderer-composer-prompt-reuse.js";
import { turnKeyMatches } from "./renderer-conversation-files.js";
import type { RendererModelClient } from "./renderer-model-client.js";
import {
  OVERLAY_ROOT_ATTRIBUTE,
  OVERLAY_ROOT_SELECTOR,
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
  turnHeaderBox,
} from "./renderer-overlay-layout.js";
import { threadIdForComposer, visibleComposers } from "./renderer-thread-composer.js";
import {
  createTurnActionController,
  type TurnActionController,
} from "./renderer-turn-action-controller.js";
import {
  TURN_ACTIONS_ATTRIBUTE,
  nativeTurnButton,
  renderTurnActionCluster,
  turnInNativeEdit,
  turnPromptElement,
  turnPromptText,
  type TurnActionBlock,
} from "./renderer-turn-actions.js";
import headerCss from "./turn-header.css";

/** Value: the Thread id the header describes. */
export const TURN_HEADER_ATTRIBUTE = "data-codexhost-turn-header";
export const TURN_HEADER_INDEX_ATTRIBUTE = "data-codexhost-turn-header-index";
export const TURN_HEADER_PROMPT_ATTRIBUTE = "data-codexhost-turn-header-prompt";
export const TURN_HEADER_EXPAND_ATTRIBUTE = "data-codexhost-turn-header-expand";
export const TURN_HEADER_PANEL_ATTRIBUTE = "data-codexhost-turn-header-panel";

const STYLE_ATTRIBUTE = "data-codexhost-turn-header-style";
const HEADER_CLASS = "codexhost-turn-header";
/** Desktop's title chrome floats over the top of the transcript scroller. */
const APP_SHELL_HEADER_SELECTOR = 'header[data-pip-obstacle="app-shell-header"]';
const TURN_SELECTOR = "[data-turn-key]";
const SEARCH_TURN_SELECTOR = "[data-content-search-turn-key]";
/** Overlays that are not transcript content and must not trigger rescans. */
const FOREIGN_OVERLAY_SELECTOR = `${OVERLAY_ROOT_SELECTOR}, [data-codexhost-prompt-ghost], [data-codexhost-draft-worktree-picker], [data-codexhost-draft-worktree-menu]`;
const PROMPT_LINE_MAX_CHARS = 200;
const NOTICE_MS = 4_000;
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
  root: HTMLElement;
  index: HTMLElement;
  prompt: HTMLButtonElement;
  spacer: HTMLElement;
  expand: HTMLButtonElement;
  panel: HTMLElement;
  cluster: HTMLElement;
  notice: HTMLElement;
  controller: TurnActionController;
  scroller: HTMLElement | null;
  column: HTMLElement | null;
  turns: Element[];
  keys: string[];
  currentIndex: number | null;
  currentKey: string | null;
  pinned: boolean;
  promptExpanded: boolean;
  blocked: TurnActionBlock | null;
  lastBox: string;
  lastPaint: string;
  reloadUntil: number;
  noticeTimer: ReturnType<typeof setTimeout> | null;
  columnObserver: ResizeObserver | null;
}

function ensureStyle(ownerDocument: Document): void {
  ensureOverlayChromeStyle(ownerDocument);
  if (ownerDocument.querySelector(`style[${STYLE_ATTRIBUTE}]`)) return;
  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "true");
  style.textContent = headerCss;
  (ownerDocument.head ?? ownerDocument.documentElement).append(style);
}

function turnKeyOf(turn: Element): string {
  return (
    turn.getAttribute("data-turn-key") ?? turn.getAttribute("data-content-search-turn-key") ?? ""
  );
}

/** Transcript Turns in document order: outermost nodes only, one per key. */
function transcriptTurns(scope: ParentNode): Element[] {
  let selector = TURN_SELECTOR;
  let found = [...scope.querySelectorAll(selector)];
  if (found.length === 0) {
    selector = SEARCH_TURN_SELECTOR;
    found = [...scope.querySelectorAll(selector)];
  }
  const turns: Element[] = [];
  const keys: string[] = [];
  for (const turn of found) {
    if (turn.parentElement?.closest(selector)) continue;
    if (turn.closest(OVERLAY_ROOT_SELECTOR)) continue;
    const key = turnKeyOf(turn);
    if (key.length === 0) continue;
    if (keys.some((seen) => turnKeyMatches(seen, key) || turnKeyMatches(key, seen))) continue;
    turns.push(turn);
    keys.push(key);
  }
  return turns;
}

function appShellChromeBottom(
  ownerDocument: Document,
  anchor: { left: number; right: number },
): number | null {
  let bottom: number | null = null;
  for (const chrome of ownerDocument.querySelectorAll<HTMLElement>(APP_SHELL_HEADER_SELECTOR)) {
    if (chrome.hidden) continue;
    const rect = chrome.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.right <= anchor.left || rect.left >= anchor.right) continue;
    bottom = bottom === null ? rect.bottom : Math.max(bottom, rect.bottom);
  }
  return bottom;
}

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

  const notify = (state: HeaderState, text: string): void => {
    state.notice.textContent = text;
    state.notice.hidden = false;
    if (state.noticeTimer !== null) clearTimeout(state.noticeTimer);
    state.noticeTimer = setTimeout(() => {
      state.notice.hidden = true;
      state.noticeTimer = null;
    }, NOTICE_MS);
  };

  const collapsePanel = (state: HeaderState): void => {
    if (!state.promptExpanded) return;
    state.promptExpanded = false;
    state.panel.hidden = true;
    state.expand.setAttribute("aria-expanded", "false");
  };

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
      state.cluster,
      state.controller.view({ chinese: chinese(), blocked: state.blocked }),
      {
        onActivate: (id) => state.controller.activate(id),
        onConfirm: () => state.controller.confirm(),
        onCancel: () => state.controller.cancel(),
      },
    );
  };

  const paintRow = (
    state: HeaderState,
    derived: {
      count: number;
      index: number | null;
      pinned: boolean;
      nativeEdit: boolean;
      busy: boolean;
    },
  ): void => {
    const zh = chinese();
    const turn = currentTurn(state);
    const reloading = derived.count === 0 && Date.now() < state.reloadUntil;
    if (!reloading) {
      state.index.textContent =
        derived.index === null
          ? zh
            ? "还没有轮次"
            : "No turns yet"
          : zh
            ? `第 ${derived.index + 1}/${derived.count} 轮`
            : `Turn ${derived.index + 1}/${derived.count}`;
    }
    state.root.setAttribute("data-state", reloading ? "reloading" : "ready");
    state.root.setAttribute("data-native-edit", derived.nativeEdit ? "true" : "false");
    state.root.setAttribute("data-streaming", derived.busy ? "true" : "false");
    if (derived.nativeEdit) {
      state.prompt.hidden = false;
      state.prompt.textContent = zh ? "正在编辑本轮" : "Editing this turn";
      state.prompt.title = "";
      state.expand.hidden = true;
      state.spacer.hidden = true;
      collapsePanel(state);
    } else if (derived.pinned && turn) {
      const text = promptTextFor(turn);
      state.prompt.hidden = false;
      state.prompt.textContent = text.slice(0, PROMPT_LINE_MAX_CHARS);
      state.prompt.title = zh ? "回到本轮开始" : "Scroll to this turn";
      state.panel.textContent = text;
      state.expand.hidden = false;
      state.spacer.hidden = true;
    } else {
      state.prompt.hidden = true;
      state.prompt.textContent = "";
      state.expand.hidden = true;
      state.spacer.hidden = false;
      collapsePanel(state);
    }
    paintCluster(state);
  };

  const hideHeader = (state: HeaderState, reason: "hidden" | "ambiguous"): void => {
    state.root.setAttribute("data-state", reason);
    state.lastBox = "";
    if (state.column) releaseTranscriptColumn(state.column);
    collapsePanel(state);
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
    const height = state.root.offsetHeight || 40;
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
    const boxKey = `${box.left}:${box.top}:${box.width}`;
    if (state.lastBox !== boxKey) {
      state.lastBox = boxKey;
      state.root.style.left = `${box.left}px`;
      state.root.style.top = `${box.top}px`;
      state.root.style.width = `${box.width}px`;
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
      collapsePanel(state);
      state.controller.setCurrent(
        turn && key ? { threadId: state.threadId, turnKey: key, turn } : null,
      );
    }
    const signature = [
      state.threadId,
      index,
      count,
      key,
      pinned,
      nativeEdit,
      busy,
      chinese(),
      pinned && turn ? promptTextFor(turn).length : 0,
    ].join("|");
    if (signature === state.lastPaint && state.root.getAttribute("data-state") === "ready") return;
    state.lastPaint = signature;
    paintRow(state, { count, index, pinned, nativeEdit, busy });
  };

  const observeColumn = (state: HeaderState): void => {
    if (typeof ResizeObserver === "undefined") return;
    state.columnObserver?.disconnect();
    state.columnObserver = null;
    if (!state.column) return;
    state.columnObserver = new ResizeObserver(() => scheduleFrame());
    state.columnObserver.observe(state.column);
    state.columnObserver.observe(state.root);
  };

  const refreshTurns = (state: HeaderState): void => {
    const scope: ParentNode = state.scroller ?? root;
    const turns = transcriptTurns(scope);
    const first = turns[0] ?? null;
    // Short Threads have no overflow yet, so the walk accepts any vertical scroller.
    const scroller =
      (first ? scrollContainerFor(first) : null) ??
      state.scroller ??
      overflowScroller(state.composer) ??
      scrollContainerFor(state.composer);
    if (scroller !== state.scroller && state.column) releaseTranscriptColumn(state.column);
    state.scroller = scroller;
    state.turns = scroller && scope !== scroller ? transcriptTurns(scroller) : turns;
    if (state.turns.length === 0 && scroller && scope !== scroller) state.turns = turns;
    state.keys = state.turns.map(turnKeyOf);
    const column = scroller ? transcriptColumn(scroller, state.turns[0] ?? null) : null;
    const usableColumn = column && !column.contains(state.composer) ? column : null;
    if (usableColumn !== state.column) {
      if (state.column) releaseTranscriptColumn(state.column);
      state.column = usableColumn;
      observeColumn(state);
    }
    if (state.currentKey !== null) {
      const stillAt = state.keys.findIndex(
        (key) =>
          state.currentKey !== null &&
          (turnKeyMatches(key, state.currentKey) || turnKeyMatches(state.currentKey, key)),
      );
      state.currentIndex = stillAt >= 0 ? stillAt : null;
      if (stillAt < 0) state.currentKey = null;
    }
  };

  const mount = (composer: Element, threadId: string): HeaderState => {
    const rootNode = documentNode.createElement("div");
    rootNode.className = HEADER_CLASS;
    rootNode.setAttribute(TURN_HEADER_ATTRIBUTE, threadId);
    rootNode.setAttribute(OVERLAY_ROOT_ATTRIBUTE, "true");
    rootNode.setAttribute("data-state", "ready");
    const row = documentNode.createElement("div");
    row.className = "codexhost-turn-header-row";
    const index = documentNode.createElement("span");
    index.className = "codexhost-turn-header-index";
    index.setAttribute(TURN_HEADER_INDEX_ATTRIBUTE, "true");
    index.setAttribute("aria-live", "polite");
    const prompt = documentNode.createElement("button");
    prompt.type = "button";
    prompt.className = "codexhost-turn-header-prompt";
    prompt.setAttribute(TURN_HEADER_PROMPT_ATTRIBUTE, "true");
    prompt.hidden = true;
    const spacer = documentNode.createElement("span");
    spacer.className = "codexhost-turn-header-spacer";
    const expand = documentNode.createElement("button");
    expand.type = "button";
    expand.className = "codexhost-turn-header-expand";
    expand.setAttribute(TURN_HEADER_EXPAND_ATTRIBUTE, "true");
    expand.setAttribute("aria-expanded", "false");
    expand.textContent = "▾";
    expand.hidden = true;
    const panel = documentNode.createElement("div");
    panel.className = "codexhost-turn-header-panel";
    panel.setAttribute(TURN_HEADER_PANEL_ATTRIBUTE, "true");
    panel.setAttribute("role", "region");
    panel.hidden = true;
    const cluster = documentNode.createElement("div");
    cluster.className = "codexhost-turn-actions";
    cluster.setAttribute(TURN_ACTIONS_ATTRIBUTE, "true");
    const notice = documentNode.createElement("div");
    notice.className = "codexhost-turn-notice";
    notice.hidden = true;
    row.append(index, prompt, spacer, expand, cluster);
    rootNode.append(row, panel, notice);
    (documentNode.body ?? documentNode.documentElement).append(rootNode);
    const state: HeaderState = {
      composer,
      threadId,
      root: rootNode,
      index,
      prompt,
      spacer,
      expand,
      panel,
      cluster,
      notice,
      controller: createTurnActionController({
        getClient: options.getClient,
        orderedTurnKeys: () => state.keys,
        composerEditor: () => {
          const editor = state.composer.querySelector(EDITOR_SELECTOR);
          return editor instanceof HTMLElement ? editor : null;
        },
        nativeRedoButton: () => nativeTurnButton(documentNode.documentElement, /^redo$|^重做$/i),
        chinese,
        notify: (text) => notify(state, text),
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
      promptExpanded: false,
      blocked: null,
      lastBox: "",
      lastPaint: "",
      reloadUntil: 0,
      noticeTimer: null,
      columnObserver: null,
    };
    prompt.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const turn = currentTurn(state);
      if (!turn || state.blocked === "nativeEdit") return;
      const headerBottom = state.root.getBoundingClientRect().bottom;
      const delta = scrollDeltaToTurn({ turnTop: turn.getBoundingClientRect().top, headerBottom });
      if (state.scroller) state.scroller.scrollBy({ top: delta, behavior: "smooth" });
      else turn.scrollIntoView({ block: "start" });
    });
    expand.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.promptExpanded = !state.promptExpanded;
      state.panel.hidden = !state.promptExpanded;
      expand.setAttribute("aria-expanded", state.promptExpanded ? "true" : "false");
    });
    headers.set(composer, state);
    return state;
  };

  const unmount = (composer: Element): void => {
    const state = headers.get(composer);
    if (!state) return;
    headers.delete(composer);
    state.controller.dispose();
    state.columnObserver?.disconnect();
    if (state.noticeTimer !== null) clearTimeout(state.noticeTimer);
    if (state.column) releaseTranscriptColumn(state.column);
    state.root.remove();
  };

  const switchThread = (state: HeaderState, threadId: string): void => {
    state.threadId = threadId;
    state.root.setAttribute(TURN_HEADER_ATTRIBUTE, threadId);
    state.currentIndex = null;
    state.currentKey = null;
    state.pinned = false;
    state.lastPaint = "";
    collapsePanel(state);
    state.controller.setCurrent(null);
  };

  const scan = (): void => {
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
      if (state.root.getAttribute("data-state") === "ambiguous") continue;
      measure(state);
    }
  };

  const insideHeader = (target: EventTarget | null): boolean =>
    target instanceof Element && target.closest(`[${TURN_HEADER_ATTRIBUTE}]`) !== null;

  const onScroll = (event: Event): void => {
    if (!insideHeader(event.target)) {
      for (const state of headers.values()) collapsePanel(state);
    }
    scheduleFrame();
  };
  const onResize = (): void => {
    for (const state of headers.values()) state.lastBox = "";
    scheduleFrame();
  };
  const onDocumentPointerDown = (event: Event): void => {
    if (insideHeader(event.target)) return;
    for (const state of headers.values()) {
      collapsePanel(state);
      state.controller.cancel();
    }
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    for (const state of headers.values()) {
      collapsePanel(state);
      state.controller.cancel();
    }
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
      for (const state of headers.values()) {
        state.lastPaint = "";
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
      releaseTranscriptReservation(documentNode);
    },
  };
}
