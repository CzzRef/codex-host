import {
  normalizeComposerPrompt,
  PROMPT_REUSE_MAX_LENGTH,
} from "./renderer-composer-prompt-reuse.js";
import { turnKeyMatches } from "./renderer-conversation-files.js";
import { OVERLAY_ROOT_SELECTOR } from "./renderer-overlay-layout.js";

/** Host element of the Edit / Rollback / Redo cluster inside the Turn header. */
export const TURN_ACTIONS_ATTRIBUTE = "data-codexhost-turn-actions";
export const TURN_CONFIRM_ATTRIBUTE = "data-codexhost-turn-confirm";
export const TURN_ACTION_ATTRIBUTE = "data-codexhost-turn-action";

export type TurnActionId = "edit" | "rollback" | "redo";

/** What the Host reports `thread/rollback` can do for the current Thread. */
export type RollbackSupport = "full" | "lastTurnOnly" | "none";

/**
 * What activating Edit will do to the Thread.
 *
 * - `native`: Desktop's own edit-message control owns the Turn.
 * - `replace`: roll the Thread back to *before* this Turn, then refill the
 *   Composer, so sending replaces the Turn instead of appending a duplicate.
 * - `append`: the Turn cannot be dropped, so Edit only refills the Composer.
 */
export type EditMode = "native" | "replace" | "append";

/** Why every action is unavailable for the moment, independent of the Turn. */
export type TurnActionBlock = "nativeEdit" | "busy" | "noTurns";

/**
 * Desktop 26.831 marks the prompt bubble with `data-user-message-bubble`
 * (measured live 2026-09-03); the other markers are fallbacks for older or
 * future markup. The Turn's first block spans the whole Turn there, so the
 * marker is the only reliable way to find the bubble.
 */
const USER_PROMPT_SELECTOR =
  '[data-user-message-bubble], [data-message-role="user"], [data-role="user"], [data-slot="user-message"], [data-slot*="user-message"], [class*="user-message"], [class*="UserMessage"]';
const TURN_CONTROL_SELECTOR = `button, [role="button"], ${OVERLAY_ROOT_SELECTOR}`;

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
 * Collapses the Host's `rollback` capability bits into what the current Turn
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

export interface TurnActionCopy {
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
  rollbackNotice: string;
  redoNotice: string;
  redoOfficialFallbackNotice: string;
  redoUnavailableNotice: string;
  /** Desktop did not re-read the transcript after the Host replaced history. */
  staleTranscriptNotice: string;
  blocked: Record<TurnActionBlock, string>;
}

export function turnActionCopy(input: {
  chinese: boolean;
  /** This session already rolled the Thread back to the current Turn. */
  rolledBack: boolean;
  laterTurns: number;
  /** Host holds a Redo slot for the Thread (thread-level, not per Turn). */
  redoAvailable?: boolean;
  /** Host-reported rollback ability; defaults to `full` for official Threads. */
  rollbackSupport?: RollbackSupport;
  /**
   * What Edit will actually do. `native` hands the Turn to Desktop's own pencil
   * (today's behaviour). `replace` rolls the Thread back to *before* this Turn
   * and refills the Composer, so resending replaces the Turn instead of
   * appending a duplicate. `append` cannot drop the Turn and only refills.
   */
  editMode?: EditMode;
  /** Why `append` cannot replace the Turn. */
  editAppendReason?: "firstTurn" | "unsupported";
}): TurnActionCopy {
  const redoAvailable = input.redoAvailable === true;
  const support = input.rollbackSupport ?? "full";
  const rollbackUnsupported =
    input.laterTurns > 0 &&
    (support === "none" || (support === "lastTurnOnly" && input.laterTurns > 1));
  const rollbackPossible = input.laterTurns > 0 && !input.rolledBack && !rollbackUnsupported;
  const editMode = input.editMode ?? "native";
  const replaces = editMode === "replace";
  // A replacing Edit always drops a Turn, including the last one, so it always
  // asks first; the native pencil keeps the old rule.
  const editNeedsConfirm = replaces || (editMode === "native" && rollbackPossible);
  const firstTurn = input.editAppendReason === "firstTurn";
  if (input.chinese) {
    const unsupportedReason =
      support === "none"
        ? "此线程的 Harness 不支持回滚"
        : `此线程只能回滚最后一轮，选中轮次之后还有 ${input.laterTurns} 轮`;
    return {
      editLabel: "编辑",
      editTitle: replaces
        ? "回滚到本轮之前——本轮及之后的对话都会取消，再把提示回填到输入框改写重发；文件不会自动回退"
        : editMode === "append"
          ? firstTurn
            ? "这是第一轮，无法取消；编辑会把提示回填到输入框追加发送"
            : `${unsupportedReason}；编辑会把本轮提示回填到输入框追加发送`
          : rollbackUnsupported
            ? `${unsupportedReason}；编辑会把本轮提示回填到输入框重新发送`
            : editNeedsConfirm
              ? "将先回滚该轮之后的对话，再到本轮开始处编辑；文件不会自动回退"
              : input.rolledBack
                ? "已回滚到本轮开始，可直接编辑提示"
                : "这是最后一轮，直接编辑提示",
      editConfirm: replaces
        ? "编辑会回滚到本轮之前：本轮及之后的对话都会被取消，然后把提示回填到输入框由你改写重发。文件不会自动回退，如需回退请用官方 Undo 或 Git。确定继续？"
        : "编辑会先回滚该轮之后的对话，再打开提示。文件不会自动回退，如需回退请用官方 Undo 或 Git。确定继续？",
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
      redoTitle: redoAvailable ? "恢复刚回滚掉的对话" : "只有回滚之后才能 Redo",
      redoConfirm: "恢复刚回滚掉的对话。文件不会自动再改回去。",
      redoConfirmAction: "确认 Redo",
      redoDisabled: !redoAvailable,
      editNeedsConfirm,
      cancelLabel: "取消",
      editNotice: replaces
        ? "已回滚到本轮之前，本轮及之后的对话已取消；改好提示直接发送即可"
        : "已回滚到本轮开始，后续对话已取消，可以编辑后重新发送",
      editFallbackNotice: "官方编辑不可用，已把本轮提示回填到输入框",
      editFailedNotice: "找不到官方编辑按钮，也读不到本轮提示文本",
      rollbackNotice: "已回滚到本轮开始，后续对话已取消",
      redoNotice: "已恢复刚回滚掉的对话",
      redoOfficialFallbackNotice: "Host Redo 不可用，已请求官方 Redo",
      redoUnavailableNotice: "Host 没有可恢复的对话",
      staleTranscriptNotice: "对话已在 Host 侧更新；切换线程再切回可刷新显示",
      blocked: {
        nativeEdit: "正在使用官方编辑，本轮动作已停用",
        busy: "回复进行中，结束后再编辑或回滚",
        noTurns: "还没有轮次",
      },
    };
  }
  const unsupportedReason =
    support === "none"
      ? "This Thread's Harness does not support rollback"
      : `This Thread can only roll back its last turn; ${input.laterTurns} turns follow the selected one`;
  return {
    editLabel: "Edit",
    editTitle: replaces
      ? "Roll back to before this turn — this turn and the later ones are dropped — then edit the prompt and resend; files are not rewritten"
      : editMode === "append"
        ? firstTurn
          ? "The first turn cannot be dropped; Edit places its prompt in the Composer to append"
          : `${unsupportedReason}; Edit places this turn's prompt in the Composer to append`
        : rollbackUnsupported
          ? `${unsupportedReason}; Edit places this turn's prompt in the Composer to resend`
          : editNeedsConfirm
            ? "Roll back later turns to this turn, then edit; files are not rewritten"
            : input.rolledBack
              ? "Already rolled back to this turn; edit the prompt"
              : "Last turn; edit the prompt",
    editConfirm: replaces
      ? "Editing rolls the thread back to before this turn: this turn and the later ones are dropped, then the prompt is placed in the Composer for you to rewrite and resend. Files are not rewritten; use the official Undo or Git for that. Continue?"
      : "Editing will first roll back later turns, then open the prompt. Files are not rewritten; use the official Undo or Git for that. Continue?",
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
      ? "Restore the turns dropped by rollback"
      : "Redo becomes available after a rollback",
    redoConfirm: "Restore the turns dropped by rollback. Project files are not rewritten.",
    redoConfirmAction: "Confirm redo",
    redoDisabled: !redoAvailable,
    editNeedsConfirm,
    cancelLabel: "Cancel",
    editNotice: replaces
      ? "Rolled back to before this turn. This turn and the later ones were dropped; edit the prompt and send."
      : "Rolled back to this turn. Later turns were dropped; you can edit and resend.",
    editFallbackNotice: "Native edit is unavailable; the prompt was placed in the Composer",
    editFailedNotice: "Neither a native Edit control nor this turn's prompt text was found",
    rollbackNotice: "Rolled back to this turn; later turns were dropped",
    redoNotice: "Restored the turns dropped by rollback",
    redoOfficialFallbackNotice: "Host Redo unavailable; requested official Redo",
    redoUnavailableNotice: "Host has no dropped turns to restore",
    staleTranscriptNotice:
      "The Host updated the conversation; switch threads and back to refresh the transcript",
    blocked: {
      nativeEdit: "Desktop's own edit mode is open; turn actions are paused",
      busy: "A turn is running; edit or roll back once it finishes",
      noTurns: "No turns yet",
    },
  };
}

/**
 * A Desktop-owned button inside `scope` whose label matches. codexhost's own
 * overlays are skipped so a Host chip is never mistaken for a native control.
 */
export function nativeTurnButton(scope: Element, pattern: RegExp): HTMLButtonElement | null {
  return (
    [...scope.querySelectorAll("button")].find((button) => {
      if (button.closest(OVERLAY_ROOT_SELECTOR)) return false;
      return [button.getAttribute("aria-label"), button.getAttribute("title"), button.textContent]
        .filter((value): value is string => typeof value === "string")
        .some((value) => pattern.test(value.trim()));
    }) ?? null
  );
}

/**
 * The node that renders a Turn's user prompt: the user-marked bubble. A Turn
 * without one (Desktop renders some Turns with no user message, and its first
 * block spans the whole Turn) has no prompt to show or refill, so this is
 * `null` rather than a guess that would surface assistant text.
 */
export function turnPromptElement(turn: Element): Element | null {
  return turn.querySelector(USER_PROMPT_SELECTOR);
}

/**
 * The user prompt of a transcript Turn, for the header line and for refilling
 * the Composer when Desktop offers no native Edit control. Controls and
 * codexhost overlays are excluded. Returns `""` when nothing readable is found.
 */
export function turnPromptText(turn: Element): string {
  const clone = turn.cloneNode(true) as Element;
  for (const node of clone.querySelectorAll(TURN_CONTROL_SELECTOR)) node.remove();
  const source = turnPromptElement(clone);
  if (!source) return "";
  const text = normalizeComposerPrompt(source.textContent ?? "");
  return text.slice(0, PROMPT_REUSE_MAX_LENGTH);
}

/**
 * Desktop's own "edit message" mode swaps the prompt for a textarea with
 * Cancel / Send; Host actions would only duplicate and cover it.
 */
export function turnInNativeEdit(turn: Element): boolean {
  return turn.querySelector('textarea, [contenteditable="true"]') !== null;
}

export interface TurnActionView {
  copy: TurnActionCopy;
  confirming: TurnActionId | null;
  blocked: TurnActionBlock | null;
}

export interface TurnActionHandlers {
  onActivate(id: TurnActionId): void;
  onConfirm(): void;
  onCancel(): void;
}

function appendConfirm(
  host: HTMLElement,
  copy: TurnActionCopy,
  text: string,
  actionLabel: string,
  danger: boolean,
  handlers: TurnActionHandlers,
): void {
  const ownerDocument = host.ownerDocument;
  const box = ownerDocument.createElement("div");
  box.className = "codexhost-overlay-confirm";
  box.setAttribute(TURN_CONFIRM_ATTRIBUTE, "true");
  const message = ownerDocument.createElement("p");
  message.textContent = text;
  const actions = ownerDocument.createElement("div");
  actions.className = "codexhost-overlay-confirm-row";
  const cancel = ownerDocument.createElement("button");
  cancel.type = "button";
  cancel.className = "codexhost-overlay-ghost";
  cancel.textContent = copy.cancelLabel;
  cancel.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handlers.onCancel();
  });
  const ok = ownerDocument.createElement("button");
  ok.type = "button";
  ok.className = "codexhost-overlay-primary";
  if (danger) ok.setAttribute("data-tone", "danger");
  ok.textContent = actionLabel;
  ok.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    handlers.onConfirm();
  });
  actions.append(cancel, ok);
  box.append(message, actions);
  host.append(box);
}

/**
 * Renders the Edit / Rollback / Redo chips (with tooltip and, for the action
 * awaiting confirmation, its popover) into `host`. Pure DOM: decisions about
 * what runs live in the controller behind `handlers`.
 */
export function renderTurnActionCluster(
  host: HTMLElement,
  view: TurnActionView,
  handlers: TurnActionHandlers,
): void {
  const ownerDocument = host.ownerDocument;
  const { copy, confirming, blocked } = view;
  host.replaceChildren();
  const blockedTitle = blocked ? copy.blocked[blocked] : null;
  const append = (input: {
    id: TurnActionId;
    label: string;
    title: string;
    disabled: boolean;
    tone?: "danger";
    confirmText?: string;
    confirmAction?: string;
  }): void => {
    const wrap = ownerDocument.createElement("span");
    wrap.className = "codexhost-overlay-action";
    const button = ownerDocument.createElement("button");
    button.type = "button";
    button.className = "codexhost-overlay-chip";
    button.textContent = input.label;
    button.setAttribute(TURN_ACTION_ATTRIBUTE, input.id);
    const title = blockedTitle ?? input.title;
    button.setAttribute("aria-label", title);
    button.disabled = input.disabled || blocked !== null;
    if (input.tone) button.dataset.tone = input.tone;
    if (confirming === input.id) button.dataset.busy = "true";
    const tooltip = ownerDocument.createElement("span");
    tooltip.className = "codexhost-overlay-tooltip";
    tooltip.setAttribute("aria-hidden", "true");
    tooltip.textContent = title;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      handlers.onActivate(input.id);
    });
    wrap.append(button, tooltip);
    if (!blocked && confirming === input.id && input.confirmText && input.confirmAction) {
      appendConfirm(
        wrap,
        copy,
        input.confirmText,
        input.confirmAction,
        input.tone === "danger",
        handlers,
      );
    }
    host.append(wrap);
  };
  append({
    id: "edit",
    label: copy.editLabel,
    title: copy.editTitle,
    disabled: false,
    ...(copy.editNeedsConfirm ? { tone: "danger", confirmText: copy.editConfirm } : {}),
    confirmAction: copy.editConfirmAction,
  });
  append({
    id: "rollback",
    label: copy.rollbackLabel,
    title: copy.rollbackTitle,
    disabled: copy.rollbackDisabled,
    tone: "danger",
    confirmText: copy.rollbackConfirm,
    confirmAction: copy.rollbackConfirmAction,
  });
  append({
    id: "redo",
    label: copy.redoLabel,
    title: copy.redoTitle,
    disabled: copy.redoDisabled,
    confirmText: copy.redoConfirm,
    confirmAction: copy.redoConfirmAction,
  });
}
