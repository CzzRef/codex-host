export const CONVERSATION_GUTTER_ATTRIBUTE = "data-codexhost-conversation-gutter";

/**
 * Every codexhost overlay root carries this marker so lookups for Desktop's
 * own controls (native Redo, Changes, Review) never match codexhost's chips.
 */
export const OVERLAY_ROOT_ATTRIBUTE = "data-codexhost-overlay";
export const OVERLAY_ROOT_SELECTOR = `[${OVERLAY_ROOT_ATTRIBUTE}]`;

/** Marks the transcript content column whose `padding-top` codexhost reserves. */
export const TRANSCRIPT_RESERVE_ATTRIBUTE = "data-codexhost-transcript-reserve";
const RESERVE_BASE_ATTRIBUTE = "data-codexhost-transcript-reserve-base";

const CHROME_STYLE_ATTRIBUTE = "data-codexhost-overlay-chrome-style";

export function chineseLocale(ownerDocument: Document): boolean {
  return (ownerDocument.documentElement.lang || "").toLowerCase().startsWith("zh");
}

export type OverlayBox = {
  left: number;
  top: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
};

export function overlayTopAboveComposer(
  composerTop: number,
  overlayHeight: number,
  gap = 8,
): number {
  return Math.max(8, Math.round(composerTop - overlayHeight - gap));
}

export function clampFixedBox(input: {
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
  maxBottom: number;
}): { left: number; top: number } {
  const width = Math.max(0, input.width);
  const height = Math.max(0, input.height);
  const maxLeft = Math.max(8, input.viewportWidth - width - 8);
  const maxTop = Math.max(8, input.maxBottom - height - 8);
  return {
    left: Math.max(8, Math.min(Math.round(input.left), maxLeft)),
    top: Math.max(8, Math.min(Math.round(input.top), maxTop)),
  };
}

export function boxRect(box: OverlayBox): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const left = box.left;
  const top = box.top;
  const right = box.right ?? left + (box.width ?? 0);
  const bottom = box.bottom ?? top + (box.height ?? 0);
  return { left, top, right, bottom };
}

export function rectsOverlap(left: OverlayBox, right: OverlayBox, gap = 0): boolean {
  const a = boxRect(left);
  const b = boxRect(right);
  return (
    a.left < b.right + gap &&
    a.right + gap > b.left &&
    a.top < b.bottom + gap &&
    a.bottom + gap > b.top
  );
}

export function turnActionOrigin(input: {
  turn: { left: number; top: number; right: number; bottom?: number };
  size: { width: number; height: number };
  composerTop: number;
  viewportWidth: number;
  avoid?: OverlayBox | null;
  railLeft?: number;
  minTop?: number;
  /** Right bound of the conversation column; enables the gutter beside the Turn. */
  gutterRight?: number;
}): { left: number; top: number } {
  const width = Math.max(0, input.size.width);
  const height = Math.max(0, input.size.height);
  const preferredTop = Math.max(input.turn.top + 8, input.minTop ?? 0);
  const candidates: Array<{ left: number; top: number }> = [];
  // Prefer the empty gutter right of the Turn so nothing covers prompt text;
  // fall back inside the Turn's top-right when the window is too narrow.
  if (
    typeof input.gutterRight === "number" &&
    input.turn.right + 8 + width + 8 <= Math.min(input.gutterRight, input.viewportWidth)
  ) {
    candidates.push({
      left: input.turn.right + 8,
      top: Math.max(input.turn.top, input.minTop ?? 0),
    });
  }
  candidates.push({ left: input.turn.right - width - 8, top: preferredTop });
  if (input.avoid) {
    const avoid = boxRect(input.avoid);
    candidates.push({ left: avoid.left - width - 8, top: preferredTop });
    candidates.push({ left: input.turn.right - width - 8, top: avoid.bottom + 8 });
  }
  if (typeof input.railLeft === "number") {
    candidates.push({ left: input.railLeft, top: preferredTop });
  }
  const fallback = { left: input.turn.right - width - 8, top: preferredTop };
  const picked =
    candidates.find((origin) => {
      const box = { left: origin.left, top: origin.top, width, height };
      if (origin.left < 8) return false;
      if (origin.top + height > input.composerTop - 8) return false;
      if (input.avoid && rectsOverlap(box, input.avoid, 6)) return false;
      return true;
    }) ?? fallback;
  return clampFixedBox({
    left: picked.left,
    top: picked.top,
    width,
    height,
    viewportWidth: input.viewportWidth,
    maxBottom: input.composerTop,
  });
}

/**
 * Where the selected Turn's action cluster goes, or `null` when the Turn is
 * not usefully visible. The cluster lives in the conversation viewport only:
 * it sticks to the viewport's top edge while a long Turn scrolls past it and
 * never rises into the Desktop title bar or drops under the Composer.
 */
export function turnActionPlacement(input: {
  turn: { left: number; top: number; right: number; bottom: number };
  size: { width: number; height: number };
  composerTop: number;
  viewportWidth: number;
  scroller?: { top: number; bottom: number; right?: number } | null;
  avoid?: OverlayBox | null;
}): { left: number; top: number } | null {
  const visibleTop = input.scroller?.top ?? 8;
  const visibleBottom = Math.min(input.composerTop, input.scroller?.bottom ?? input.composerTop);
  const height = Math.max(0, input.size.height);
  if (input.turn.bottom < visibleTop + height + 8) return null;
  if (input.turn.top > visibleBottom - height - 8) return null;
  const stickyTop = Math.max(input.turn.top + 8, visibleTop + 8);
  const minTop = Math.min(stickyTop, Math.max(visibleTop + 8, input.turn.bottom - height - 4));
  return turnActionOrigin({
    turn: input.turn,
    size: input.size,
    composerTop: visibleBottom,
    viewportWidth: input.viewportWidth,
    avoid: input.avoid ?? null,
    minTop,
    ...(typeof input.scroller?.right === "number" ? { gutterRight: input.scroller.right } : {}),
  });
}

/** A rail dot is drawn only while its Turn edge sits inside the conversation viewport. */
export function railDotVisible(input: {
  top: number;
  scroller?: { top: number; bottom: number } | null;
  composerTop: number;
}): boolean {
  const visibleTop = input.scroller?.top ?? 0;
  const visibleBottom = Math.min(input.composerTop, input.scroller?.bottom ?? input.composerTop);
  return input.top >= visibleTop && input.top + 8 <= visibleBottom;
}

export function overflowScroller(start: Element | null): HTMLElement | null {
  let node: Element | null = start;
  const view = start?.ownerDocument.defaultView;
  while (node instanceof HTMLElement && node !== node.ownerDocument.documentElement) {
    const style = view?.getComputedStyle(node);
    if (
      style &&
      /(auto|scroll)/.test(style.overflowY) &&
      node.scrollHeight > node.clientHeight + 4
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function ensureOverlayChromeStyle(ownerDocument: Document): void {
  if (ownerDocument.querySelector(`style[${CHROME_STYLE_ATTRIBUTE}]`)) return;
  const style = ownerDocument.createElement("style");
  style.setAttribute(CHROME_STYLE_ATTRIBUTE, "true");
  style.textContent = `
    .codexhost-overlay-action {
      position: relative;
      display: inline-flex;
      pointer-events: auto;
    }
    .codexhost-overlay-chip {
      appearance: none;
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 0 10px;
      border: 1px solid rgb(255 255 255 / 12%);
      border-radius: 8px;
      /* Opaque: the cluster may sit over transcript text, which must not bleed through. */
      background: rgb(24 24 24);
      color: inherit;
      cursor: pointer;
      font-size: 12px;
      line-height: 16px;
      transition:
        background 120ms ease,
        border-color 120ms ease,
        transform 80ms ease,
        box-shadow 120ms ease;
    }
    .codexhost-overlay-chip:hover:not(:disabled) {
      background: rgb(44 44 44);
      border-color: rgb(255 255 255 / 22%);
    }
    .codexhost-overlay-chip:active:not(:disabled) {
      transform: translateY(1px) scale(0.97);
      background: rgb(58 58 58);
    }
    .codexhost-overlay-chip:focus-visible {
      outline: 2px solid #339cff;
      outline-offset: 2px;
    }
    .codexhost-overlay-chip:disabled {
      /* Dim the label, not the surface: a translucent disabled chip showed text through it. */
      color: rgb(255 255 255 / 38%);
      border-color: rgb(255 255 255 / 8%);
      cursor: not-allowed;
    }
    .codexhost-overlay-chip[data-tone="danger"]:hover:not(:disabled) {
      border-color: rgb(248 81 73 / 45%);
      background: rgb(52 30 30);
    }
    .codexhost-overlay-chip[data-busy="true"] {
      box-shadow: inset 0 0 0 1px rgb(51 156 255 / 45%);
    }
    .codexhost-overlay-tooltip {
      position: absolute;
      right: 0;
      bottom: calc(100% + 8px);
      z-index: 5;
      width: max-content;
      max-width: 280px;
      padding: 8px 10px;
      border: 1px solid rgb(255 255 255 / 10%);
      border-radius: 8px;
      background: #111;
      color: #e7e7e7;
      font-size: 11px;
      line-height: 16px;
      text-align: left;
      box-shadow: 0 16px 40px rgb(0 0 0 / 45%);
      pointer-events: none;
      opacity: 0;
      translate: 0 4px;
      transition:
        opacity 120ms ease,
        translate 120ms ease;
    }
    .codexhost-overlay-action:hover .codexhost-overlay-tooltip,
    .codexhost-overlay-action:focus-within .codexhost-overlay-tooltip,
    .codexhost-overlay-chip:hover .codexhost-overlay-tooltip,
    .codexhost-overlay-chip:focus-visible .codexhost-overlay-tooltip,
    .codexhost-workspace-stats:hover .codexhost-overlay-tooltip,
    .codexhost-workspace-stats:focus-visible .codexhost-overlay-tooltip {
      opacity: 1;
      translate: 0 0;
    }
    .codexhost-overlay-action:has([data-codexhost-turn-confirm]) .codexhost-overlay-tooltip {
      display: none;
    }
    .codexhost-overlay-confirm {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      z-index: 6;
      width: 304px;
      padding: 12px;
      border: 1px solid rgb(255 255 255 / 10%);
      border-radius: 12px;
      background: #151515;
      box-shadow: 0 16px 40px rgb(0 0 0 / 45%);
      text-align: left;
      pointer-events: auto;
    }
    .codexhost-overlay-confirm p {
      margin: 0 0 10px;
      color: #dcdcdc;
      font-size: 12px;
      line-height: 17px;
    }
    .codexhost-overlay-confirm-row {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }
    .codexhost-overlay-ghost {
      min-height: 28px;
      padding: 0 10px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .codexhost-overlay-ghost:hover {
      background: rgb(255 255 255 / 7%);
    }
    .codexhost-overlay-primary {
      min-height: 28px;
      padding: 0 10px;
      border: 0;
      border-radius: 8px;
      background: #2f6fed;
      color: #fff;
      cursor: pointer;
    }
    .codexhost-overlay-primary:hover {
      background: #3b7bff;
    }
    .codexhost-overlay-primary:active {
      transform: translateY(1px);
    }
    .codexhost-overlay-primary[data-tone="danger"] {
      background: #c93832;
    }
    .codexhost-overlay-primary[data-tone="danger"]:hover {
      background: #e0443d;
    }
  `;
  (ownerDocument.head ?? ownerDocument.documentElement).append(style);
}

/**
 * Where the pinned Turn header goes: the top edge of the transcript viewport,
 * below Desktop's own title chrome, spanning the Composer column. `null` when
 * the window leaves no usable room, in which case the header unmounts.
 */
export function turnHeaderBox(input: {
  anchor: { left: number; right: number };
  scrollerTop: number;
  chromeBottom: number | null;
  composerTop: number;
  viewportWidth: number;
  height: number;
}): { left: number; top: number; width: number } | null {
  const top = Math.max(0, Math.round(input.scrollerTop), Math.round(input.chromeBottom ?? 0));
  const left = Math.max(8, Math.round(input.anchor.left));
  const right = Math.min(Math.round(input.anchor.right), input.viewportWidth - 8);
  const width = right - left;
  if (width < 240) return null;
  if (top + input.height + 8 > input.composerTop) return null;
  return { left, top, width };
}

/**
 * Which Turn the header describes: the last Turn whose top edge has passed
 * under the header, the last Turn when the transcript end is in view, the
 * first Turn otherwise. Rect-based on purpose: the transcript scroller is
 * `flex column-reverse`, where `scrollTop` is zero at the bottom and negative
 * above it, so only element edges are trusted. A few pixels of hysteresis
 * keep the index from flapping while a boundary sits on the header edge.
 */
export function resolveCurrentTurn(input: {
  count: number;
  topAt(index: number): number;
  atBottom: boolean;
  headerBottom: number;
  previous: number | null;
  hysteresis?: number;
}): number | null {
  if (input.count <= 0) return null;
  const last = input.count - 1;
  if (input.atBottom) return last;
  const hysteresis = input.hysteresis ?? 6;
  let low = 0;
  let high = last;
  // Turn tops ascend in document order: binary-search the last Turn whose top
  // already sits at or above the header's bottom edge.
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (input.topAt(middle) <= input.headerBottom) low = middle;
    else high = middle - 1;
  }
  const base = input.topAt(low) <= input.headerBottom ? low : 0;
  const previous = input.previous;
  if (previous !== null && previous >= 0 && previous <= last) {
    if (base === previous + 1 && input.topAt(base) > input.headerBottom - hysteresis) {
      return previous;
    }
    if (base === previous - 1 && input.topAt(previous) < input.headerBottom + hysteresis) {
      return previous;
    }
  }
  return base;
}

/**
 * Whether the current Turn's prompt bubble has scrolled fully under the
 * header, so the header repeats the prompt. Once pinned it stays pinned until
 * the bubble clearly re-enters the viewport.
 */
export function promptPinned(input: {
  promptBottom: number;
  headerBottom: number;
  previous: boolean;
}): boolean {
  return input.promptBottom <= input.headerBottom + (input.previous ? 8 : 2);
}

/**
 * Inline `padding-top` for the transcript content column so the first Turn
 * clears the header at scroll-top. `need` is how far below the column's top
 * edge the first Turn must start; `spacers` is what Desktop already leaves
 * there besides the column's own padding, which is never reduced.
 */
export function transcriptTopReserve(input: {
  need: number;
  spacers: number;
  basePaddingTop: number;
}): number {
  return Math.max(0, Math.round(input.basePaddingTop), Math.round(input.need - input.spacers));
}

/** Scroll delta that brings a Turn's top edge just under the header. */
export function scrollDeltaToTurn(input: {
  turnTop: number;
  headerBottom: number;
  gap?: number;
}): number {
  return Math.round(input.turnTop - (input.headerBottom + (input.gap ?? 8)));
}

/**
 * Nearest ancestor that scrolls vertically, whether or not it overflows
 * right now (a short Thread has no overflow yet still has one scroller).
 */
export function scrollContainerFor(start: Element | null): HTMLElement | null {
  let node: Element | null = start;
  const view = start?.ownerDocument.defaultView;
  while (node instanceof HTMLElement && node !== node.ownerDocument.documentElement) {
    const style = view?.getComputedStyle(node);
    if (style && /(auto|scroll)/.test(style.overflowY)) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * The scroller child that holds the transcript: the ancestor of a Turn that
 * is a direct child of the scroller, or the first child when no Turn exists.
 * Desktop's Composer container is another scroller child and is never it.
 */
export function transcriptColumn(scroller: HTMLElement, turn: Element | null): HTMLElement | null {
  if (turn) {
    let node: Element | null = turn;
    while (node && node.parentElement !== scroller) node = node.parentElement;
    return node instanceof HTMLElement ? node : null;
  }
  const first = scroller.firstElementChild;
  return first instanceof HTMLElement ? first : null;
}

/** The column's own `padding-top` before codexhost first wrote to it. */
export function reservedBasePadding(column: HTMLElement): number {
  const stored = column.getAttribute(RESERVE_BASE_ATTRIBUTE);
  if (typeof stored === "string") return Number.parseFloat(stored) || 0;
  const computed = column.ownerDocument.defaultView?.getComputedStyle(column).paddingTop;
  return Number.parseFloat(computed ?? "0") || 0;
}

export function reserveTranscriptTop(column: HTMLElement, px: number): void {
  if (!column.hasAttribute(TRANSCRIPT_RESERVE_ATTRIBUTE)) {
    column.setAttribute(RESERVE_BASE_ATTRIBUTE, `${reservedBasePadding(column)}`);
    column.setAttribute(TRANSCRIPT_RESERVE_ATTRIBUTE, "true");
  }
  const value = `${Math.max(0, Math.round(px))}px`;
  if (column.style.paddingTop !== value) column.style.paddingTop = value;
}

export function releaseTranscriptColumn(column: HTMLElement): void {
  if (!column.hasAttribute(TRANSCRIPT_RESERVE_ATTRIBUTE)) return;
  column.style.paddingTop = "";
  column.removeAttribute(TRANSCRIPT_RESERVE_ATTRIBUTE);
  column.removeAttribute(RESERVE_BASE_ATTRIBUTE);
}

export function releaseTranscriptReservation(ownerDocument: Document): void {
  for (const column of ownerDocument.querySelectorAll<HTMLElement>(
    `[${TRANSCRIPT_RESERVE_ATTRIBUTE}]`,
  )) {
    releaseTranscriptColumn(column);
  }
}
