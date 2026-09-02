import { hostThreadIdSchema } from "@codexhost/shared-contracts";

import { CODEX_COMPOSER_SELECTOR } from "./renderer-composer-dom.js";
import { turnKeyMatches } from "./renderer-conversation-files.js";
import {
  ensureOverlayChromeStyle,
  overflowScroller,
  railDotVisible,
  turnActionOrigin,
  turnActionPlacement,
  type OverlayBox,
} from "./renderer-overlay-layout.js";
import type { RendererModelClient } from "./renderer-model-client.js";
import { isNativeWorkspaceDiffControl } from "./renderer-workspace-bar.js";

export const TURN_ACTIONS_ATTRIBUTE = "data-codexhost-turn-actions";
export const TURN_RAIL_ATTRIBUTE = "data-codexhost-turn-rail";
export const TURN_SELECTED_EVENT = "codexhost:turn-files-selected";
export const TURN_CONFIRM_ATTRIBUTE = "data-codexhost-turn-confirm";
export const TURN_ACTION_ATTRIBUTE = "data-codexhost-turn-action";

const STYLE_ATTRIBUTE = "data-codexhost-turn-actions-style";

export interface RendererTurnActions {
  refresh(): void;
  dispose(): void;
}

function ensureStyle(ownerDocument: Document): void {
  ensureOverlayChromeStyle(ownerDocument);
  ownerDocument.querySelector(`style[${STYLE_ATTRIBUTE}]`)?.remove();
  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "true");
  style.textContent = `
    .codexhost-turn-actions {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      justify-content: flex-end;
      gap: 6px;
      min-width: 0;
      padding: 0;
      position: fixed;
      z-index: 13;
      pointer-events: none;
    }
    .codexhost-turn-actions[data-empty="true"] { display: none; }
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
    .codexhost-turn-notice {
      position: fixed;
      z-index: 50;
      max-width: min(320px, calc(100vw - 24px));
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid rgba(127, 127, 127, 0.3);
      background: rgba(20, 20, 20, 0.94);
      color: inherit;
      font-size: 12px;
      line-height: 16px;
      pointer-events: none;
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

export function turnActionCopy(input: {
  chinese: boolean;
  /** This session already rolled the Thread back to the selected Turn. */
  rolledBack: boolean;
  laterTurns: number;
  /** Host holds a last-Turn Redo slot for the Thread (thread-level, not per Turn). */
  redoAvailable?: boolean;
}): {
  editLabel: string;
  editTitle: string;
  editConfirm: string;
  editConfirmAction: string;
  rollbackLabel: string;
  rollbackTitle: string;
  rollbackConfirm: string;
  rollbackConfirmAction: string;
  rollbackDisabled: boolean;
  redoLabel: string;
  redoTitle: string;
  redoConfirm: string;
  redoConfirmAction: string;
  redoDisabled: boolean;
  editNeedsConfirm: boolean;
  cancelLabel: string;
  editNotice: string;
} {
  const redoAvailable = input.redoAvailable === true;
  const editNeedsConfirm = input.laterTurns > 0 && !input.rolledBack;
  if (input.chinese) {
    return {
      editLabel: "编辑",
      editTitle: editNeedsConfirm
        ? "将先回滚该轮之后的对话与文件，再到本轮开始处编辑"
        : input.rolledBack
          ? "已回滚到本轮开始，可直接编辑提示"
          : "这是最后一轮，直接编辑提示",
      editConfirm: "编辑会先回滚该轮之后的对话和文件，再打开提示。确定继续？",
      editConfirmAction: "确认编辑",
      rollbackLabel: "回滚",
      rollbackTitle:
        input.laterTurns > 0 && !input.rolledBack
          ? "回滚到本轮开始：取消之后的对话，并尽量还原本轮文件"
          : "没有后续轮次可回滚",
      rollbackConfirm: "回滚到本轮开始，将取消之后的对话，并尽量还原本轮文件。",
      rollbackConfirmAction: "确认回滚",
      rollbackDisabled: input.laterTurns === 0 || input.rolledBack,
      redoLabel: "Redo",
      redoTitle: redoAvailable ? "恢复刚回滚掉的最后一轮对话" : "只有回滚最后一轮之后才能 Redo",
      redoConfirm: "恢复刚回滚掉的最后一轮对话。文件不会自动再改回去。",
      redoConfirmAction: "确认 Redo",
      redoDisabled: !redoAvailable,
      editNeedsConfirm,
      cancelLabel: "取消",
      editNotice: "已回滚到本轮开始，后续对话已取消，可以编辑后重新发送",
    };
  }
  return {
    editLabel: "Edit",
    editTitle: editNeedsConfirm
      ? "Rollback later turns and files to this turn, then edit"
      : input.rolledBack
        ? "Already rolled back to this turn; edit the prompt"
        : "Last turn; edit the prompt",
    editConfirm:
      "Editing will first roll back later turns and files, then open the prompt. Continue?",
    editConfirmAction: "Confirm edit",
    rollbackLabel: "Rollback",
    rollbackTitle:
      input.laterTurns > 0 && !input.rolledBack
        ? "Roll back to this turn: drop later turns and undo this turn's files"
        : "No later turns to roll back",
    rollbackConfirm: "Roll back to this turn, drop later conversation, and undo this turn's files.",
    rollbackConfirmAction: "Confirm rollback",
    rollbackDisabled: input.laterTurns === 0 || input.rolledBack,
    redoLabel: "Redo",
    redoTitle: redoAvailable
      ? "Restore the last turn dropped by rollback"
      : "Redo becomes available after rolling back the last turn",
    redoConfirm: "Restore the last turn dropped by rollback. Project files are not rewritten.",
    redoConfirmAction: "Confirm redo",
    redoDisabled: !redoAvailable,
    editNeedsConfirm,
    cancelLabel: "Cancel",
    editNotice: "Rolled back to this turn. Later turns were dropped; you can edit and resend.",
  };
}

export function nativeTurnButton(turn: Element, pattern: RegExp): HTMLButtonElement | null {
  return (
    [...turn.querySelectorAll("button")].find((button) => {
      if (button.closest(`[${TURN_ACTIONS_ATTRIBUTE}]`)) return false;
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

function controlLabel(element: Element): string {
  return [element.getAttribute("aria-label"), element.getAttribute("title"), element.textContent]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

export function nativeTurnChromeBox(turn: Element): OverlayBox | null {
  const hit = [...turn.querySelectorAll("button, [role='button']")].find((element) => {
    if (element.closest(`[${TURN_ACTIONS_ATTRIBUTE}]`)) return false;
    const label = controlLabel(element);
    return (
      isNativeWorkspaceDiffControl(element) ||
      /提交所有的代码变更|commit all code changes/i.test(label)
    );
  });
  if (!(hit instanceof HTMLElement)) return null;
  const rect = hit.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

export function installRendererTurnActions(options: {
  getClient(): RendererModelClient | null;
  root?: ParentNode;
}): RendererTurnActions {
  const root = options.root ?? document;
  const documentNode =
    root instanceof Document ? root : ((root as Element).ownerDocument ?? document);
  ensureStyle(documentNode);
  const row = documentNode.createElement("div");
  row.setAttribute(TURN_ACTIONS_ATTRIBUTE, "true");
  row.className = "codexhost-turn-actions";
  row.setAttribute("data-empty", "true");
  (documentNode.body ?? documentNode.documentElement).append(row);
  const rail = documentNode.createElement("div");
  rail.setAttribute(TURN_RAIL_ATTRIBUTE, "true");
  rail.className = "codexhost-turn-rail";
  (documentNode.body ?? documentNode.documentElement).append(rail);
  let selected: { threadId: string; turnKey: string } | null = null;
  // Turn-scoped: this session rolled the Thread back to the selected Turn.
  let rolledBack = false;
  // Thread-scoped: Host reports a last-Turn Redo slot for the selected Thread.
  let redoAvailable = false;
  // Who owns the selected Thread. Official Desktop Redo is only a fallback
  // for Codex-owned Threads; an external Thread without a slot gets nothing.
  let owner: "external" | "official" | "unknown" = "unknown";
  let confirming: "edit" | "rollback" | "redo" | null = null;
  let disposed = false;
  const notice = documentNode.createElement("div");
  notice.className = "codexhost-turn-notice";
  notice.hidden = true;
  (documentNode.body ?? documentNode.documentElement).append(notice);
  let noticeTimer: ReturnType<typeof setTimeout> | null = null;

  const selectedTurnElement = (): Element | null => {
    if (!selected) return null;
    return (
      [...root.querySelectorAll("[data-turn-key]")].find((element) => {
        const key = element.getAttribute("data-turn-key") ?? "";
        return turnKeyMatches(key, selected?.turnKey ?? "");
      }) ?? null
    );
  };

  const composerForPlacement = (): Element | null =>
    [...root.querySelectorAll(CODEX_COMPOSER_SELECTOR)].find((composer) => {
      const typed = composer as HTMLElement;
      const bounds = typed.getBoundingClientRect?.();
      return Boolean(bounds && bounds.width > 0 && bounds.height > 0);
    }) ?? null;

  const placeNotice = (): void => {
    if (notice.hidden) return;
    const origin = row.getBoundingClientRect();
    const composer = composerForPlacement();
    const composerTop = composer?.getBoundingClientRect().top ?? origin.bottom + 48;
    const scroller = overflowScroller(selectedTurnElement());
    const box = turnActionOrigin({
      turn: {
        left: origin.left,
        top: origin.bottom,
        right: origin.right,
      },
      size: { width: notice.offsetWidth || 240, height: notice.offsetHeight || 36 },
      composerTop,
      viewportWidth: documentNode.defaultView?.innerWidth ?? origin.right,
      minTop: (scroller?.getBoundingClientRect().top ?? 0) + 8,
    });
    notice.style.left = `${box.left}px`;
    notice.style.top = `${box.top}px`;
  };

  const showNotice = (text: string): void => {
    notice.textContent = text;
    notice.hidden = false;
    placeNotice();
    if (noticeTimer !== null) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice.hidden = true;
      noticeTimer = null;
    }, 4_000);
  };

  const placeActions = (): void => {
    const turn = selectedTurnElement();
    const composer = composerForPlacement();
    if (!turn || !composer || row.getAttribute("data-empty") === "true") {
      row.style.top = "-999px";
      return;
    }
    const turnRect = turn.getBoundingClientRect();
    const composerRect = composer.getBoundingClientRect();
    const scrollerRect = overflowScroller(turn)?.getBoundingClientRect() ?? null;
    const origin = turnActionPlacement({
      turn: turnRect,
      size: { width: row.offsetWidth || 200, height: row.offsetHeight || 32 },
      composerTop: composerRect.top,
      viewportWidth: documentNode.defaultView?.innerWidth ?? turnRect.right,
      scroller: scrollerRect,
      avoid: nativeTurnChromeBox(turn),
    });
    if (!origin) {
      row.style.top = "-999px";
      return;
    }
    row.style.left = `${origin.left}px`;
    row.style.top = `${origin.top}px`;
    placeNotice();
  };

  const paintRail = (): void => {
    rail.replaceChildren();
    const composerTop =
      composerForPlacement()?.getBoundingClientRect().top ??
      documentNode.defaultView?.innerHeight ??
      Number.POSITIVE_INFINITY;
    for (const turn of root.querySelectorAll("[data-turn-key]")) {
      const key = turn.getAttribute("data-turn-key");
      if (!key) continue;
      const rect = turn.getBoundingClientRect();
      if (rect.height <= 0 || rect.width <= 0) continue;
      const scrollerRect = overflowScroller(turn)?.getBoundingClientRect() ?? null;
      if (!railDotVisible({ top: rect.top + 10, scroller: scrollerRect, composerTop })) continue;
      const dot = documentNode.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", chineseLocale(documentNode) ? "选择此轮" : "Select this turn");
      dot.title = chineseLocale(documentNode)
        ? "选择此轮以编辑或回滚"
        : "Select this turn to edit or roll back";
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

  const paintActions = (): void => {
    row.replaceChildren();
    const chinese = chineseLocale(documentNode);
    if (!selected) {
      confirming = null;
      row.setAttribute("data-empty", "true");
      placeActions();
      return;
    }
    row.setAttribute("data-empty", "false");
    const later = turnsAfterKey(orderedTurnKeys(root), selected.turnKey);
    const copy = turnActionCopy({ chinese, rolledBack, laterTurns: later, redoAvailable });
    const selectedTurn = selectedTurnElement();
    const runRollback = (): Promise<void> => {
      const current = selected;
      if (selectedTurn) nativeTurnButton(selectedTurn, /^undo$|^撤销$/i)?.click();
      if (later > 0 && current) {
        return (
          options.getClient()?.rollbackThread?.({
            threadId: current.threadId,
            numTurns: later,
          }) ?? Promise.resolve()
        ).then(() => {
          rolledBack = true;
          // Host stashes a Redo slot only for a single last-Turn rollback;
          // the inspect that follows is the authority and may revoke this.
          redoAvailable = later === 1;
          void inspectSelected();
        });
      }
      rolledBack = true;
      return Promise.resolve();
    };
    const clickEdit = (): void => {
      if (selectedTurn) {
        nativeTurnButton(selectedTurn, /edit message|编辑消息|^edit$|^编辑$/i)?.click();
      }
    };
    const runRedo = (): void => {
      const current = selected;
      const restored = (): void => {
        rolledBack = false;
        redoAvailable = false;
        showNotice(
          chinese ? "已恢复刚回滚掉的最后一轮对话" : "Restored the last turn dropped by rollback",
        );
        paintAll();
        void inspectSelected();
      };
      // Official Desktop Redo is an app-action stack, not a conversation
      // restore. It is only a fallback for Threads Codex itself owns.
      const fallback = (): void => {
        const official =
          owner !== "external"
            ? nativeTurnButton(documentNode.documentElement, /^redo$|^重做$/i)
            : null;
        official?.click();
        showNotice(
          chinese
            ? official
              ? "Host Redo 不可用，已请求官方 Redo"
              : "Host 没有可恢复的最后一轮"
            : official
              ? "Host Redo unavailable; requested official Redo"
              : "Host has no last turn to restore",
        );
        paintAll();
        void inspectSelected();
      };
      const request = current
        ? options.getClient()?.redoThread?.({ threadId: current.threadId })
        : undefined;
      if (!request) {
        fallback();
        return;
      }
      void request.then(restored).catch(fallback);
    };
    const appendConfirm = (
      host: HTMLElement,
      text: string,
      actionLabel: string,
      danger: boolean,
      onConfirm: () => void,
    ): void => {
      const box = documentNode.createElement("div");
      box.className = "codexhost-overlay-confirm";
      box.setAttribute(TURN_CONFIRM_ATTRIBUTE, "true");
      const message = documentNode.createElement("p");
      message.textContent = text;
      const actions = documentNode.createElement("div");
      actions.className = "codexhost-overlay-confirm-row";
      const cancel = documentNode.createElement("button");
      cancel.type = "button";
      cancel.className = "codexhost-overlay-ghost";
      cancel.textContent = copy.cancelLabel;
      cancel.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        confirming = null;
        paintAll();
      });
      const ok = documentNode.createElement("button");
      ok.type = "button";
      ok.className = "codexhost-overlay-primary";
      if (danger) ok.setAttribute("data-tone", "danger");
      ok.textContent = actionLabel;
      ok.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        confirming = null;
        onConfirm();
      });
      actions.append(cancel, ok);
      box.append(message, actions);
      host.append(box);
    };
    const appendAction = (input: {
      id: "edit" | "rollback" | "redo";
      label: string;
      title: string;
      disabled: boolean;
      tone?: "danger";
      onRun: () => void;
      confirmText?: string;
      confirmAction?: string;
    }): void => {
      const wrap = documentNode.createElement("span");
      wrap.className = "codexhost-overlay-action";
      const button = documentNode.createElement("button");
      button.type = "button";
      button.className = "codexhost-overlay-chip";
      button.textContent = input.label;
      button.setAttribute(TURN_ACTION_ATTRIBUTE, input.id);
      button.setAttribute("aria-label", input.title);
      button.disabled = input.disabled;
      if (input.tone) button.dataset.tone = input.tone;
      if (confirming === input.id) button.dataset.busy = "true";
      const tooltip = documentNode.createElement("span");
      tooltip.className = "codexhost-overlay-tooltip";
      tooltip.setAttribute("aria-hidden", "true");
      tooltip.textContent = input.title;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (input.disabled) return;
        if (!input.confirmText) {
          input.onRun();
          return;
        }
        if (confirming === input.id) {
          confirming = null;
          paintAll();
          return;
        }
        confirming = input.id;
        paintAll();
      });
      wrap.append(button, tooltip);
      if (confirming === input.id && input.confirmText && input.confirmAction) {
        appendConfirm(
          wrap,
          input.confirmText,
          input.confirmAction,
          input.tone === "danger",
          input.onRun,
        );
      }
      row.append(wrap);
    };
    appendAction({
      id: "edit",
      label: copy.editLabel,
      title: copy.editTitle,
      disabled: false,
      ...(copy.editNeedsConfirm ? { tone: "danger", confirmText: copy.editConfirm } : {}),
      confirmAction: copy.editConfirmAction,
      onRun: () => {
        if (copy.editNeedsConfirm) {
          void runRollback().then(() => {
            showNotice(copy.editNotice);
            clickEdit();
            paintAll();
          });
          return;
        }
        clickEdit();
      },
    });
    appendAction({
      id: "rollback",
      label: copy.rollbackLabel,
      title: copy.rollbackTitle,
      disabled: copy.rollbackDisabled,
      tone: "danger",
      confirmText: copy.rollbackConfirm,
      confirmAction: copy.rollbackConfirmAction,
      onRun: () => {
        void runRollback().then(() => {
          showNotice(
            chinese
              ? "已回滚到本轮开始，后续对话已取消"
              : "Rolled back to this turn; later turns were dropped",
          );
          paintAll();
        });
      },
    });
    appendAction({
      id: "redo",
      label: copy.redoLabel,
      title: copy.redoTitle,
      disabled: copy.redoDisabled,
      confirmText: copy.redoConfirm,
      confirmAction: copy.redoConfirmAction,
      onRun: runRedo,
    });
    placeActions();
    documentNode.defaultView?.requestAnimationFrame(placeActions);
  };

  const paintAll = (): void => {
    if (disposed) return;
    paintActions();
    paintRail();
  };

  // Thread-level truth from the Host: who owns the Thread and whether a
  // last-Turn Redo slot exists. Survives Renderer refresh and Turn reselect.
  const inspectSelected = (): Promise<void> => {
    const current = selected;
    if (!current) return Promise.resolve();
    const parsedThreadId = hostThreadIdSchema.safeParse(current.threadId);
    if (!parsedThreadId.success) return Promise.resolve();
    const request = options.getClient()?.inspectThread?.({ threadId: parsedThreadId.data });
    if (!request) return Promise.resolve();
    return request
      .then((inspection) => {
        if (disposed || selected?.threadId !== current.threadId) return;
        owner = inspection.owner === "external" ? "external" : "official";
        redoAvailable = inspection.owner === "external" && inspection.historyRedoAvailable === true;
        paintAll();
      })
      .catch(() => undefined);
  };

  const onSelected = (event: Event): void => {
    const detail = (event as CustomEvent).detail as {
      threadId?: string;
      turnKey?: string | null;
    };
    if (typeof detail?.threadId !== "string") return;
    confirming = null;
    selected =
      typeof detail.turnKey === "string" && detail.turnKey.length > 0
        ? { threadId: detail.threadId, turnKey: detail.turnKey }
        : null;
    rolledBack = false;
    if (!selected) {
      redoAvailable = false;
      owner = "unknown";
      paintAll();
      return;
    }
    paintAll();
    void inspectSelected();
  };

  const reposition = (): void => {
    paintRail();
    placeActions();
  };

  const onDocumentClick = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!confirming || target?.closest(`[${TURN_ACTIONS_ATTRIBUTE}]`)) return;
    confirming = null;
    paintAll();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !confirming) return;
    confirming = null;
    paintAll();
  };

  documentNode.defaultView?.addEventListener(TURN_SELECTED_EVENT, onSelected);
  documentNode.defaultView?.addEventListener("scroll", reposition, true);
  documentNode.defaultView?.addEventListener("resize", reposition);
  documentNode.addEventListener("click", onDocumentClick, true);
  documentNode.addEventListener("keydown", onKeyDown);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (disposed || timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      reposition();
    }, 250);
  });
  observer.observe(documentNode.documentElement ?? documentNode, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-turn-key", "hidden"],
  });
  paintAll();

  return {
    refresh() {
      paintAll();
      void inspectSelected();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
      documentNode.defaultView?.removeEventListener(TURN_SELECTED_EVENT, onSelected);
      documentNode.defaultView?.removeEventListener("scroll", reposition, true);
      documentNode.defaultView?.removeEventListener("resize", reposition);
      documentNode.removeEventListener("click", onDocumentClick, true);
      documentNode.removeEventListener("keydown", onKeyDown);
      if (noticeTimer !== null) clearTimeout(noticeTimer);
      notice.remove();
      rail.remove();
      row.remove();
    },
  };
}
