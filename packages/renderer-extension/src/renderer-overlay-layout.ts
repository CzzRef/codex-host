export const CONVERSATION_GUTTER_ATTRIBUTE = "data-codexhost-conversation-gutter";

const CHROME_STYLE_ATTRIBUTE = "data-codexhost-overlay-chrome-style";

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
}): { left: number; top: number } {
  const width = Math.max(0, input.size.width);
  const height = Math.max(0, input.size.height);
  const preferredTop = Math.max(input.turn.top + 8, input.minTop ?? 0);
  const candidates: Array<{ left: number; top: number }> = [
    { left: input.turn.right - width - 8, top: preferredTop },
  ];
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
      background: rgb(20 20 20 / 88%);
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
      background: rgb(255 255 255 / 8%);
      border-color: rgb(255 255 255 / 22%);
    }
    .codexhost-overlay-chip:active:not(:disabled) {
      transform: translateY(1px) scale(0.97);
      background: rgb(255 255 255 / 14%);
    }
    .codexhost-overlay-chip:focus-visible {
      outline: 2px solid #339cff;
      outline-offset: 2px;
    }
    .codexhost-overlay-chip:disabled {
      opacity: 0.38;
      cursor: not-allowed;
    }
    .codexhost-overlay-chip[data-tone="danger"]:hover:not(:disabled) {
      border-color: rgb(248 81 73 / 45%);
      background: rgb(248 81 73 / 10%);
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
