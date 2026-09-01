import { CODEX_COMPOSER_SELECTOR } from "./renderer-composer-dom.js";
import { turnKeyMatches } from "./renderer-conversation-files.js";
import type { RendererModelClient } from "./renderer-model-client.js";
import { WORKSPACE_BAR_ATTRIBUTE } from "./renderer-workspace-bar.js";

export const TURN_ACTIONS_ATTRIBUTE = "data-codexhost-turn-actions";
export const TURN_RAIL_ATTRIBUTE = "data-codexhost-turn-rail";
export const TURN_SELECTED_EVENT = "codexhost:turn-files-selected";

const STYLE_ATTRIBUTE = "data-codexhost-turn-actions-style";

export interface RendererTurnActions {
  refresh(): void;
  dispose(): void;
}

function ensureStyle(ownerDocument: Document): void {
  if (ownerDocument.querySelector(`style[${STYLE_ATTRIBUTE}]`)) return;
  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "true");
  style.textContent = `
    .codexhost-turn-actions {
      display: flex;
      gap: 8px;
      min-width: 0;
      padding: 0 2px 4px;
    }
    .codexhost-turn-actions[data-empty="true"] { display: none; }
    .codexhost-turn-actions button {
      appearance: none;
      border: 1px solid rgba(127, 127, 127, 0.28);
      border-radius: 8px;
      background: rgba(127, 127, 127, 0.1);
      color: inherit;
      cursor: pointer;
      font-size: 12px;
      line-height: 16px;
      padding: 4px 10px;
    }
    .codexhost-turn-rail {
      position: fixed;
      z-index: 6;
      pointer-events: none;
    }
    .codexhost-turn-rail button {
      position: fixed;
      pointer-events: auto;
      width: 8px;
      height: 8px;
      padding: 0;
      border: 1px solid rgba(127, 127, 127, 0.55);
      border-radius: 999px;
      background: rgba(127, 127, 127, 0.35);
      cursor: pointer;
    }
    .codexhost-turn-rail button[data-selected="true"] {
      background: #3fb950;
      border-color: #3fb950;
    }
  `;
  (ownerDocument.head ?? ownerDocument.documentElement).append(style);
}

export function orderedTurnKeys(root: ParentNode): string[] {
  return [...root.querySelectorAll("[data-turn-key]")]
    .map((element) => element.getAttribute("data-turn-key"))
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

export function turnsAfterKey(keys: readonly string[], selected: string): number {
  const index = keys.findIndex(
    (key) => turnKeyMatches(key, selected) || turnKeyMatches(selected, key),
  );
  if (index < 0) return 0;
  return Math.max(0, keys.length - index - 1);
}

export function nativeTurnButton(turn: Element, pattern: RegExp): HTMLButtonElement | null {
  return (
    [...turn.querySelectorAll("button")].find((button) => {
      const label = [
        button.getAttribute("aria-label"),
        button.getAttribute("title"),
        button.textContent,
      ]
        .filter((value): value is string => typeof value === "string")
        .join(" ");
      return pattern.test(label);
    }) ?? null
  );
}

function chineseLocale(ownerDocument: Document): boolean {
  return (ownerDocument.documentElement.lang || "").toLowerCase().startsWith("zh");
}

export function installRendererTurnActions(options: {
  getClient(): RendererModelClient | null;
  root?: ParentNode;
}): RendererTurnActions {
  const root = options.root ?? document;
  const documentNode =
    root instanceof Document ? root : ((root as Element).ownerDocument ?? document);
  ensureStyle(documentNode);
  const actions = new Map<Element, HTMLElement>();
  const rail = documentNode.createElement("div");
  rail.setAttribute(TURN_RAIL_ATTRIBUTE, "true");
  rail.className = "codexhost-turn-rail";
  (documentNode.body ?? documentNode.documentElement).append(rail);
  let selected: { threadId: string; turnKey: string } | null = null;
  let rolledBack = false;
  let disposed = false;

  const hideActions = (composer: Element): void => {
    actions.get(composer)?.remove();
    actions.delete(composer);
  };

  const placeActions = (row: HTMLElement, composer: Element): void => {
    const parent = composer.parentElement;
    if (!parent) return;
    const bar = composer.previousElementSibling;
    if (bar?.hasAttribute(WORKSPACE_BAR_ATTRIBUTE) && bar.nextElementSibling !== row) {
      bar.after(row);
      return;
    }
    if (row.nextElementSibling !== composer) parent.insertBefore(row, composer);
  };

  const paintRail = (): void => {
    rail.replaceChildren();
    for (const turn of root.querySelectorAll("[data-turn-key]")) {
      const key = turn.getAttribute("data-turn-key");
      if (!key) continue;
      const rect = turn.getBoundingClientRect();
      if (rect.height <= 0 || rect.width <= 0) continue;
      const dot = documentNode.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", key);
      if (
        selected &&
        (turnKeyMatches(selected.turnKey, key) || turnKeyMatches(key, selected.turnKey))
      ) {
        dot.setAttribute("data-selected", "true");
      }
      dot.style.left = `${Math.max(4, Math.round(rect.left - 14))}px`;
      dot.style.top = `${Math.round(rect.top + 10)}px`;
      dot.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        turn.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: documentNode.defaultView,
          }),
        );
      });
      rail.append(dot);
    }
  };

  const paintActions = (composer: Element): void => {
    let row = actions.get(composer);
    if (!row) {
      row = documentNode.createElement("div");
      row.setAttribute(TURN_ACTIONS_ATTRIBUTE, "true");
      row.className = "codexhost-turn-actions";
      actions.set(composer, row);
    }
    row.replaceChildren();
    const chinese = chineseLocale(documentNode);
    if (!selected) {
      row.setAttribute("data-empty", "true");
      placeActions(row, composer);
      return;
    }
    row.setAttribute("data-empty", "false");
    const edit = documentNode.createElement("button");
    edit.type = "button";
    edit.textContent = chinese ? "编辑" : "Edit";
    edit.addEventListener("click", () => {
      const turn = [...root.querySelectorAll("[data-turn-key]")].find((element) => {
        const key = element.getAttribute("data-turn-key") ?? "";
        return turnKeyMatches(key, selected?.turnKey ?? "");
      });
      nativeTurnButton(turn ?? composer, /edit message|编辑消息|^edit$|^编辑$/i)?.click();
    });
    const later = turnsAfterKey(orderedTurnKeys(root), selected.turnKey);
    const redoAvailable = Boolean(nativeTurnButton(documentNode.documentElement, /^redo$|^重做$/i));
    const restore = documentNode.createElement("button");
    restore.type = "button";
    if (rolledBack || (later === 0 && redoAvailable)) {
      restore.textContent = chinese ? "Redo" : "Redo";
      restore.addEventListener("click", () => {
        nativeTurnButton(documentNode.documentElement, /^redo$|^重做$/i)?.click();
        rolledBack = false;
        paintAll();
      });
    } else {
      restore.textContent = chinese ? "回滚" : "Rollback";
      restore.disabled = later === 0;
      restore.addEventListener("click", () => {
        const current = selected;
        const turn = [...root.querySelectorAll("[data-turn-key]")].find((element) => {
          const key = element.getAttribute("data-turn-key") ?? "";
          return turnKeyMatches(key, current?.turnKey ?? "");
        });
        nativeTurnButton(turn ?? composer, /^undo$|^撤销$/i)?.click();
        const client = options.getClient();
        if (later > 0 && current) {
          void client
            ?.rollbackThread?.({ threadId: current.threadId, numTurns: later })
            .then(() => {
              rolledBack = true;
              paintAll();
            });
        } else {
          rolledBack = true;
          paintAll();
        }
      });
    }
    row.append(edit, restore);
    placeActions(row, composer);
  };

  const paintAll = (): void => {
    if (disposed) return;
    const live = new Set<Element>();
    for (const composer of root.querySelectorAll(CODEX_COMPOSER_SELECTOR)) {
      live.add(composer);
      paintActions(composer);
    }
    for (const composer of [...actions.keys()]) {
      if (!live.has(composer) || !composer.isConnected) hideActions(composer);
    }
    paintRail();
  };

  const onSelected = (event: Event): void => {
    const detail = (event as CustomEvent).detail as { threadId?: string; turnKey?: string | null };
    if (typeof detail?.threadId !== "string") return;
    selected =
      typeof detail.turnKey === "string" && detail.turnKey.length > 0
        ? { threadId: detail.threadId, turnKey: detail.turnKey }
        : null;
    if (!selected) rolledBack = false;
    paintAll();
  };

  documentNode.defaultView?.addEventListener(TURN_SELECTED_EVENT, onSelected);
  documentNode.defaultView?.addEventListener("scroll", paintRail, true);
  documentNode.defaultView?.addEventListener("resize", paintRail);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (disposed || timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      observer.disconnect();
      try {
        paintAll();
      } finally {
        if (!disposed) {
          observer.observe(documentNode.documentElement ?? documentNode, {
            childList: true,
            subtree: true,
          });
        }
      }
    }, 0);
  });
  observer.observe(documentNode.documentElement ?? documentNode, {
    childList: true,
    subtree: true,
  });
  paintAll();

  return {
    refresh: paintAll,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
      documentNode.defaultView?.removeEventListener(TURN_SELECTED_EVENT, onSelected);
      documentNode.defaultView?.removeEventListener("scroll", paintRail, true);
      documentNode.defaultView?.removeEventListener("resize", paintRail);
      rail.remove();
      for (const composer of [...actions.keys()]) hideActions(composer);
    },
  };
}
