import { hostThreadIdSchema } from "@codexhost/shared-contracts";

import { CODEX_COMPOSER_SELECTOR, EDITOR_SELECTOR } from "./renderer-composer-dom.js";
import {
  clearComposerEditor,
  insertComposerText,
  normalizeComposerPrompt,
  PROMPT_REUSE_MAX_LENGTH,
} from "./renderer-composer-prompt-reuse.js";
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
export const TURN_HOVER_ATTRIBUTE = "data-codexhost-turn-hover";
export const TURN_SELECTED_EVENT = "codexhost:turn-files-selected";
export const TURN_CONFIRM_ATTRIBUTE = "data-codexhost-turn-confirm";
export const TURN_ACTION_ATTRIBUTE = "data-codexhost-turn-action";

const STYLE_ATTRIBUTE = "data-codexhost-turn-actions-style";
const HOVER_HIDE_GRACE_MS = 160;

export interface RendererTurnActions {
  refresh(): void;
  dispose(): void;
}

/** What the Host reports `thread/rollback` can do for the selected Thread. */
export type RollbackSupport = "full" | "lastTurnOnly" | "none";

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
      z-index: 12;
      pointer-events: none;
    }
    .codexhost-turn-rail button {
      position: fixed;
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 22px;
      padding: 0;
      border: 1px solid rgba(127, 127, 127, 0.28);
      border-radius: 7px;
      background: rgba(20, 20, 20, 0.62);
      color: rgba(255, 255, 255, 0.78);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      line-height: 1;
      letter-spacing: 0.08em;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .codexhost-turn-rail button[data-visible="true"] {
      opacity: 1;
    }
    .codexhost-turn-rail button:hover {
      background: rgba(40, 40, 40, 0.92);
      color: #fff;
    }
    .codexhost-turn-rail button[data-selected="true"] {
      border-color: #3fb950;
      color: #3fb950;
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

/**
 * Collapses the Host's `rollback` capability bits into what the selected Turn
 * can do. Official Codex Threads (no bits) keep Desktop's own `thread/rollback`
 * behaviour, so they read as `full`.
 */
export function rollbackSupportFor(
  capability: { lastTurn: boolean; multiTurn: boolean } | null | undefined,
): RollbackSupport {
  if (!capability) return "full";
  if (capability.multiTurn) return "full";
  return capability.lastTurn ? "lastTurnOnly" : "none";
}

export function turnActionCopy(input: {
  chinese: boolean;
  /** This session already rolled the Thread back to the selected Turn. */
  rolledBack: boolean;
  laterTurns: number;
  /** Host holds a last-Turn Redo slot for the Thread (thread-level, not per Turn). */
  redoAvailable?: boolean;
  /** Host-reported rollback ability; defaults to `full` for official Threads. */
  rollbackSupport?: RollbackSupport;
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
  /** Rollback is impossible for this Turn on this Thread (not merely "nothing later"). */
  rollbackUnsupported: boolean;
  redoLabel: string;
  redoTitle: string;
  redoConfirm: string;
  redoConfirmAction: string;
  redoDisabled: boolean;
  editNeedsConfirm: boolean;
  cancelLabel: string;
  editNotice: string;
  editFallbackNotice: string;
  editFailedNotice: string;
} {
  const redoAvailable = input.redoAvailable === true;
  const support = input.rollbackSupport ?? "full";
  const rollbackUnsupported =
    input.laterTurns > 0 &&
    (support === "none" || (support === "lastTurnOnly" && input.laterTurns > 1));
  const rollbackPossible = input.laterTurns > 0 && !input.rolledBack && !rollbackUnsupported;
  const editNeedsConfirm = rollbackPossible;
  if (input.chinese) {
    const unsupportedReason =
      support === "none"
        ? "此线程的 Harness 不支持回滚"
        : `此线程只能回滚最后一轮，选中轮次之后还有 ${input.laterTurns} 轮`;
    return {
      editLabel: "编辑",
      editTitle: editNeedsConfirm
        ? "将先回滚该轮之后的对话，再到本轮开始处编辑；文件不会自动回退"
        : rollbackUnsupported
          ? `${unsupportedReason}；编辑会把本轮提示回填到输入框重新发送`
          : input.rolledBack
            ? "已回滚到本轮开始，可直接编辑提示"
            : "这是最后一轮，直接编辑提示",
      editConfirm:
        "编辑会先回滚该轮之后的对话，再打开提示。文件不会自动回退，如需回退请用官方 Undo 或 Git。确定继续？",
      editConfirmAction: "确认编辑",
      rollbackLabel: "回滚",
      rollbackTitle: rollbackUnsupported
        ? unsupportedReason
        : rollbackPossible
          ? "回滚到本轮开始：取消之后的对话；文件不会自动回退"
          : "没有后续轮次可回滚",
      rollbackConfirm:
        "回滚到本轮开始，将取消之后的对话。文件不会自动回退，如需回退请用官方 Undo 或 Git。",
      rollbackConfirmAction: "确认回滚",
      rollbackDisabled: !rollbackPossible,
      rollbackUnsupported,
      redoLabel: "Redo",
      redoTitle: redoAvailable ? "恢复刚回滚掉的最后一轮对话" : "只有回滚最后一轮之后才能 Redo",
      redoConfirm: "恢复刚回滚掉的最后一轮对话。文件不会自动再改回去。",
      redoConfirmAction: "确认 Redo",
      redoDisabled: !redoAvailable,
      editNeedsConfirm,
      cancelLabel: "取消",
      editNotice: "已回滚到本轮开始，后续对话已取消，可以编辑后重新发送",
      editFallbackNotice: "官方编辑不可用，已把本轮提示回填到输入框",
      editFailedNotice: "找不到官方编辑按钮，也读不到本轮提示文本",
    };
  }
  const unsupportedReason =
    support === "none"
      ? "This Thread's Harness does not support rollback"
      : `This Thread can only roll back its last turn; ${input.laterTurns} turns follow the selected one`;
  return {
    editLabel: "Edit",
    editTitle: editNeedsConfirm
      ? "Roll back later turns to this turn, then edit; files are not rewritten"
      : rollbackUnsupported
        ? `${unsupportedReason}; Edit places this turn's prompt in the Composer to resend`
        : input.rolledBack
          ? "Already rolled back to this turn; edit the prompt"
          : "Last turn; edit the prompt",
    editConfirm:
      "Editing will first roll back later turns, then open the prompt. Files are not rewritten; use the official Undo or Git for that. Continue?",
    editConfirmAction: "Confirm edit",
    rollbackLabel: "Rollback",
    rollbackTitle: rollbackUnsupported
      ? unsupportedReason
      : rollbackPossible
        ? "Roll back to this turn: drop later turns; files are not rewritten"
        : "No later turns to roll back",
    rollbackConfirm:
      "Roll back to this turn and drop later conversation. Files are not rewritten; use the official Undo or Git for that.",
    rollbackConfirmAction: "Confirm rollback",
    rollbackDisabled: !rollbackPossible,
    rollbackUnsupported,
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
    editFallbackNotice: "Native edit is unavailable; the prompt was placed in the Composer",
    editFailedNotice: "Neither a native Edit control nor this turn's prompt text was found",
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

/**
 * The user prompt of a transcript Turn, for refilling the Composer when
 * Desktop offers no native Edit control (Harness Turns usually do not).
 * Prefers an explicitly user-marked node; otherwise the Turn's first block,
 * which is where Desktop renders the prompt. Controls and codexhost overlays
 * are excluded. Returns `""` when nothing readable is found.
 */
export function turnPromptText(turn: Element): string {
  const clone = turn.cloneNode(true) as Element;
  for (const node of clone.querySelectorAll(
    `button, [role="button"], [data-codexhost-turn-files], [${TURN_ACTIONS_ATTRIBUTE}], [${TURN_RAIL_ATTRIBUTE}], [data-codexhost-workspace-bar]`,
  )) {
    node.remove();
  }
  const marked = clone.querySelector(
    '[data-message-role="user"], [data-role="user"], [data-slot="user-message"], [data-slot*="user-message"], [class*="user-message"], [class*="UserMessage"]',
  );
  const source = marked ?? clone.firstElementChild ?? clone;
  const text = normalizeComposerPrompt(source.textContent ?? "");
  return text.slice(0, PROMPT_REUSE_MAX_LENGTH);
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
  const view = documentNode.defaultView;
  ensureStyle(documentNode);
  const row = documentNode.createElement("div");
  row.setAttribute(TURN_ACTIONS_ATTRIBUTE, "true");
  row.className = "codexhost-turn-actions";
  row.setAttribute("data-empty", "true");
  (documentNode.body ?? documentNode.documentElement).append(row);
  // One floating "⋯" chip that follows the hovered Turn; replaces the old
  // per-Turn rail dots that sat over transcript text.
  const rail = documentNode.createElement("div");
  rail.setAttribute(TURN_RAIL_ATTRIBUTE, "true");
  rail.className = "codexhost-turn-rail";
  const hoverChip = documentNode.createElement("button");
  hoverChip.type = "button";
  hoverChip.setAttribute(TURN_HOVER_ATTRIBUTE, "true");
  hoverChip.textContent = "⋯";
  hoverChip.style.top = "-999px";
  rail.append(hoverChip);
  (documentNode.body ?? documentNode.documentElement).append(rail);
  let hoveredTurn: Element | null = null;
  let hoverHideTimer: ReturnType<typeof setTimeout> | null = null;
  let selected: { threadId: string; turnKey: string } | null = null;
  // Turn-scoped: this session rolled the Thread back to the selected Turn.
  let rolledBack = false;
  // Thread-scoped: Host reports a last-Turn Redo slot for the selected Thread.
  let redoAvailable = false;
  // Thread-scoped: Host-reported rollback ability (null = official / unknown).
  let rollbackCapability: { lastTurn: boolean; multiTurn: boolean } | null = null;
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

  const composerEditor = (): HTMLElement | null => {
    const composer = composerForPlacement();
    const editor = composer?.querySelector(EDITOR_SELECTOR);
    return editor instanceof HTMLElement ? editor : null;
  };

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
      viewportWidth: view?.innerWidth ?? origin.right,
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
      viewportWidth: view?.innerWidth ?? turnRect.right,
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

  const hideHoverChip = (): void => {
    hoveredTurn = null;
    hoverChip.removeAttribute("data-visible");
    hoverChip.style.top = "-999px";
  };

  /**
   * Places the hover chip at the hovered Turn's top-right, inside the
   * conversation viewport and clear of native Turn chrome. Hidden while the
   * selected Turn's action cluster already occupies that corner.
   */
  const placeHoverChip = (): void => {
    const turn = hoveredTurn;
    if (!turn || !turn.isConnected) {
      hideHoverChip();
      return;
    }
    const key = turn.getAttribute("data-turn-key") ?? "";
    const isSelected =
      selected !== null &&
      (turnKeyMatches(selected.turnKey, key) || turnKeyMatches(key, selected.turnKey));
    if (isSelected && row.getAttribute("data-empty") !== "true") {
      hoverChip.removeAttribute("data-visible");
      hoverChip.style.top = "-999px";
      return;
    }
    const rect = turn.getBoundingClientRect();
    if (rect.height <= 0 || rect.width <= 0) {
      hideHoverChip();
      return;
    }
    const composerTop =
      composerForPlacement()?.getBoundingClientRect().top ??
      view?.innerHeight ??
      Number.POSITIVE_INFINITY;
    const scrollerRect = overflowScroller(turn)?.getBoundingClientRect() ?? null;
    const size = { width: hoverChip.offsetWidth || 26, height: hoverChip.offsetHeight || 22 };
    const origin = turnActionPlacement({
      turn: rect,
      size,
      composerTop,
      viewportWidth: view?.innerWidth ?? rect.right,
      scroller: scrollerRect,
      avoid: nativeTurnChromeBox(turn),
    });
    if (!origin || !railDotVisible({ top: origin.top, scroller: scrollerRect, composerTop })) {
      hoverChip.removeAttribute("data-visible");
      hoverChip.style.top = "-999px";
      return;
    }
    const chinese = chineseLocale(documentNode);
    hoverChip.setAttribute("aria-label", chinese ? "此轮操作" : "Turn actions");
    hoverChip.title = chinese ? "编辑 / 回滚 / Redo 此轮" : "Edit / roll back / redo this turn";
    if (isSelected) hoverChip.setAttribute("data-selected", "true");
    else hoverChip.removeAttribute("data-selected");
    hoverChip.style.left = `${origin.left}px`;
    hoverChip.style.top = `${origin.top}px`;
    hoverChip.setAttribute("data-visible", "true");
  };

  const cancelHoverHide = (): void => {
    if (hoverHideTimer === null) return;
    clearTimeout(hoverHideTimer);
    hoverHideTimer = null;
  };

  const scheduleHoverHide = (): void => {
    cancelHoverHide();
    hoverHideTimer = setTimeout(() => {
      hoverHideTimer = null;
      hideHoverChip();
    }, HOVER_HIDE_GRACE_MS);
  };

  const onPointerOver = (event: Event): void => {
    if (disposed) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest(`[${TURN_RAIL_ATTRIBUTE}], [${TURN_ACTIONS_ATTRIBUTE}]`)) {
      cancelHoverHide();
      return;
    }
    const turn = target.closest("[data-turn-key]");
    if (!turn) {
      if (hoveredTurn) scheduleHoverHide();
      return;
    }
    cancelHoverHide();
    if (turn !== hoveredTurn) {
      hoveredTurn = turn;
      placeHoverChip();
    }
  };

  const onPointerOut = (event: Event): void => {
    if (disposed || !hoveredTurn) return;
    const next = (event as MouseEvent).relatedTarget;
    const nextElement = next instanceof Element ? next : null;
    if (
      nextElement &&
      (nextElement.closest("[data-turn-key]") === hoveredTurn ||
        nextElement.closest(`[${TURN_RAIL_ATTRIBUTE}], [${TURN_ACTIONS_ATTRIBUTE}]`))
    ) {
      return;
    }
    scheduleHoverHide();
  };

  hoverChip.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const turn = hoveredTurn;
    if (!turn) return;
    turn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view }));
  });

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
    const copy = turnActionCopy({
      chinese,
      rolledBack,
      laterTurns: later,
      redoAvailable,
      rollbackSupport: rollbackSupportFor(rollbackCapability),
    });
    const selectedTurn = selectedTurnElement();
    const runRollback = (): Promise<void> => {
      const current = selected;
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
    /**
     * Prefers Desktop's own pencil (official Turns). Harness Turns rarely have
     * one, so the prompt is refilled into the Composer instead.
     */
    const clickEdit = (): void => {
      const pencil = selectedTurn
        ? nativeTurnButton(selectedTurn, /edit message|编辑消息|^edit$|^编辑$/i)
        : null;
      if (pencil) {
        pencil.click();
        return;
      }
      const text = selectedTurn ? turnPromptText(selectedTurn) : "";
      const editor = composerEditor();
      if (!editor || text.length === 0) {
        showNotice(copy.editFailedNotice);
        return;
      }
      clearComposerEditor(editor);
      insertComposerText(editor, text);
      editor.focus();
      showNotice(copy.editFallbackNotice);
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
    scheduleReposition();
  };

  // The selected Turn's own size changes (streaming, collapsing tool cards)
  // move its top-right corner; a ResizeObserver catches what scroll does not.
  let resizeObserver: ResizeObserver | null = null;
  let observedTurn: Element | null = null;
  const observeSelectedTurn = (): void => {
    const turn = selectedTurnElement();
    if (turn === observedTurn) return;
    resizeObserver?.disconnect();
    resizeObserver = null;
    observedTurn = turn;
    if (!turn || typeof ResizeObserver === "undefined") return;
    resizeObserver = new ResizeObserver(() => scheduleReposition());
    resizeObserver.observe(turn);
  };

  const paintAll = (): void => {
    if (disposed) return;
    paintActions();
    placeHoverChip();
    observeSelectedTurn();
  };

  // Thread-level truth from the Host: who owns the Thread, whether a
  // last-Turn Redo slot exists, and what rollback can do. Survives Renderer
  // refresh and Turn reselect.
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
        rollbackCapability = inspection.owner === "external" ? (inspection.rollback ?? null) : null;
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
    const previousThread = selected?.threadId ?? null;
    selected =
      typeof detail.turnKey === "string" && detail.turnKey.length > 0
        ? { threadId: detail.threadId, turnKey: detail.turnKey }
        : null;
    rolledBack = false;
    if (!selected) {
      redoAvailable = false;
      rollbackCapability = null;
      owner = "unknown";
      paintAll();
      return;
    }
    if (previousThread !== selected.threadId) rollbackCapability = null;
    paintAll();
    void inspectSelected();
  };

  // Scroll, resize, and DOM mutations all coalesce into one layout pass per
  // animation frame, so the cluster tracks the Turn without lagging behind
  // or thrashing layout.
  let repositionFrame: number | null = null;
  const reposition = (): void => {
    repositionFrame = null;
    if (disposed) return;
    placeActions();
    placeHoverChip();
    observeSelectedTurn();
  };
  const scheduleReposition = (): void => {
    if (disposed || repositionFrame !== null) return;
    if (!view?.requestAnimationFrame) {
      reposition();
      return;
    }
    repositionFrame = view.requestAnimationFrame(reposition);
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

  view?.addEventListener(TURN_SELECTED_EVENT, onSelected);
  view?.addEventListener("scroll", scheduleReposition, true);
  view?.addEventListener("resize", scheduleReposition);
  documentNode.addEventListener("click", onDocumentClick, true);
  documentNode.addEventListener("keydown", onKeyDown);
  documentNode.addEventListener("mouseover", onPointerOver, true);
  documentNode.addEventListener("mouseout", onPointerOut, true);
  const observer = new MutationObserver((mutations) => {
    if (disposed) return;
    const ours = (node: Node): boolean =>
      node instanceof Element &&
      Boolean(
        node.closest(
          `[${TURN_ACTIONS_ATTRIBUTE}], [${TURN_RAIL_ATTRIBUTE}], .codexhost-turn-notice, [data-codexhost-workspace-bar], [data-codexhost-workspace-preview]`,
        ),
      );
    if (mutations.every((mutation) => ours(mutation.target))) return;
    scheduleReposition();
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
      resizeObserver?.disconnect();
      if (repositionFrame !== null) view?.cancelAnimationFrame?.(repositionFrame);
      cancelHoverHide();
      view?.removeEventListener(TURN_SELECTED_EVENT, onSelected);
      view?.removeEventListener("scroll", scheduleReposition, true);
      view?.removeEventListener("resize", scheduleReposition);
      documentNode.removeEventListener("click", onDocumentClick, true);
      documentNode.removeEventListener("keydown", onKeyDown);
      documentNode.removeEventListener("mouseover", onPointerOver, true);
      documentNode.removeEventListener("mouseout", onPointerOut, true);
      if (noticeTimer !== null) clearTimeout(noticeTimer);
      notice.remove();
      rail.remove();
      row.remove();
    },
  };
}
