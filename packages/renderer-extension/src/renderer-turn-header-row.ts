import { TURN_ACTIONS_ATTRIBUTE } from "./renderer-turn-actions.js";

export const TURN_HEADER_INDEX_ATTRIBUTE = "data-codexhost-turn-header-index";
export const TURN_HEADER_PROMPT_ATTRIBUTE = "data-codexhost-turn-header-prompt";
export const TURN_HEADER_EXPAND_ATTRIBUTE = "data-codexhost-turn-header-expand";
export const TURN_HEADER_PANEL_ATTRIBUTE = "data-codexhost-turn-header-panel";
/** Values: `prev` | `next`. */
export const TURN_HEADER_STEP_ATTRIBUTE = "data-codexhost-turn-header-step";
export const TURN_HEADER_WORKSPACE_ATTRIBUTE = "data-codexhost-turn-header-workspace";
/** Row-1 host for the core workspace chip while the Turn row stays single-line. */
export const TURN_HEADER_CORE_ATTRIBUTE = "data-codexhost-turn-header-core";

const PROMPT_LINE_MAX_CHARS = 200;
const NOTICE_MS = 4_000;

export interface TurnHeaderRowState {
  /** Turns the DOM window holds; the arrows can only reach these. */
  count: number;
  index: number | null;
  /**
   * Position to print. The Host's Turn list when it publishes one, because a
   * virtualised transcript would otherwise label a 22-Turn Thread "Turn 1/3".
   */
  position: { index: number; count: number } | null;
  pinned: boolean;
  nativeEdit: boolean;
  busy: boolean;
  reloading: boolean;
  chinese: boolean;
  /** Full prompt text of the current Turn; only read while `pinned`. */
  promptText: string;
}

/**
 * The header's DOM: the Turn row (index, prompt, expand chevron, action
 * cluster host), the prompt panel, the notice toast and the workspace row
 * host. Painting only; what to paint is decided by the header.
 */
export interface TurnHeaderView {
  root: HTMLElement;
  cluster: HTMLElement;
  workspace: HTMLElement;
  /** Row-1 slot the workspace row uses when it has nothing but the core chip. */
  core: HTMLElement;
  paintRow(state: TurnHeaderRowState): void;
  notify(text: string): void;
  collapsePanel(): void;
  setThreadId(threadId: string): void;
  dispose(): void;
}

export function createTurnHeaderView(
  ownerDocument: Document,
  input: {
    threadId: string;
    rootAttribute: string;
    overlayAttribute: string;
    className: string;
    onPromptClick(): void;
    /** Step the current Turn explicitly; `-1` previous, `+1` next. */
    onStep(delta: -1 | 1): void;
  },
): TurnHeaderView {
  const root = ownerDocument.createElement("div");
  root.className = input.className;
  root.setAttribute(input.rootAttribute, input.threadId);
  root.setAttribute(input.overlayAttribute, "true");
  root.setAttribute("data-state", "ready");
  const row = ownerDocument.createElement("div");
  row.className = "codexhost-turn-header-row";
  const step = (delta: -1 | 1): HTMLButtonElement => {
    const button = ownerDocument.createElement("button");
    button.type = "button";
    button.className = "codexhost-turn-header-step";
    button.setAttribute(TURN_HEADER_STEP_ATTRIBUTE, delta < 0 ? "prev" : "next");
    button.textContent = delta < 0 ? "‹" : "›";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      input.onStep(delta);
    });
    return button;
  };
  const previous = step(-1);
  const next = step(1);
  const index = ownerDocument.createElement("span");
  index.className = "codexhost-turn-header-index";
  index.setAttribute(TURN_HEADER_INDEX_ATTRIBUTE, "true");
  index.setAttribute("aria-live", "polite");
  const prompt = ownerDocument.createElement("button");
  prompt.type = "button";
  prompt.className = "codexhost-turn-header-prompt";
  prompt.setAttribute(TURN_HEADER_PROMPT_ATTRIBUTE, "true");
  prompt.hidden = true;
  const spacer = ownerDocument.createElement("span");
  spacer.className = "codexhost-turn-header-spacer";
  const expand = ownerDocument.createElement("button");
  expand.type = "button";
  expand.className = "codexhost-turn-header-expand";
  expand.setAttribute(TURN_HEADER_EXPAND_ATTRIBUTE, "true");
  expand.setAttribute("aria-expanded", "false");
  expand.textContent = "▾";
  expand.hidden = true;
  const panel = ownerDocument.createElement("div");
  panel.className = "codexhost-turn-header-panel";
  panel.setAttribute(TURN_HEADER_PANEL_ATTRIBUTE, "true");
  panel.setAttribute("role", "region");
  panel.hidden = true;
  const cluster = ownerDocument.createElement("div");
  cluster.className = "codexhost-turn-actions";
  cluster.setAttribute(TURN_ACTIONS_ATTRIBUTE, "true");
  const notice = ownerDocument.createElement("div");
  notice.className = "codexhost-turn-notice";
  notice.hidden = true;
  const workspace = ownerDocument.createElement("div");
  workspace.className = "codexhost-turn-header-row codexhost-workspace-surface";
  workspace.setAttribute(TURN_HEADER_WORKSPACE_ATTRIBUTE, "empty");
  const core = ownerDocument.createElement("div");
  core.className = "codexhost-turn-header-core codexhost-workspace-surface";
  core.setAttribute(TURN_HEADER_CORE_ATTRIBUTE, "true");
  core.hidden = true;
  row.append(previous, index, next, prompt, spacer, expand, core, cluster);
  root.append(row, workspace, panel, notice);
  let promptExpanded = false;
  let noticeTimer: ReturnType<typeof setTimeout> | null = null;

  const collapsePanel = (): void => {
    if (!promptExpanded) return;
    promptExpanded = false;
    panel.hidden = true;
    expand.setAttribute("aria-expanded", "false");
  };

  prompt.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    input.onPromptClick();
  });
  expand.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    promptExpanded = !promptExpanded;
    panel.hidden = !promptExpanded;
    expand.setAttribute("aria-expanded", promptExpanded ? "true" : "false");
  });

  return {
    root,
    cluster,
    workspace,
    core,
    paintRow(state) {
      const zh = state.chinese;
      const position =
        state.position ??
        (state.index === null ? null : { index: state.index, count: state.count });
      if (!state.reloading) {
        index.textContent =
          position === null
            ? zh
              ? "还没有轮次"
              : "No turns yet"
            : zh
              ? `第 ${position.index + 1}/${position.count} 轮`
              : `Turn ${position.index + 1}/${position.count}`;
      }
      root.setAttribute("data-state", state.reloading ? "reloading" : "ready");
      // One Turn has nowhere to step: the arrows would be permanent dead weight.
      // A reloading transcript reports zero Turns for a moment; keep them then.
      const singleTurn =
        !state.reloading && state.count < 2 && (position?.count ?? state.count) < 2;
      previous.hidden = singleTurn;
      next.hidden = singleTurn;
      // Bounds stay on the transcript window even though the label counts Host
      // Turns: measured on a forked Thread whose inherited first Turn Desktop
      // never renders, so a Host-bounded arrow would be permanently dead.
      previous.disabled = state.index === null || state.index <= 0;
      next.disabled = state.index === null || state.index >= state.count - 1;
      previous.setAttribute("aria-label", zh ? "上一轮" : "Previous turn");
      next.setAttribute("aria-label", zh ? "下一轮" : "Next turn");
      root.setAttribute("data-native-edit", state.nativeEdit ? "true" : "false");
      root.setAttribute("data-streaming", state.busy ? "true" : "false");
      // While the row carries the prompt it belongs to the prompt; the core
      // workspace chip fills the row only when there is no prompt to show.
      root.setAttribute("data-pinned", state.pinned && !state.nativeEdit ? "true" : "false");
      if (state.nativeEdit) {
        prompt.hidden = false;
        prompt.textContent = zh ? "正在编辑本轮" : "Editing this turn";
        prompt.title = "";
        expand.hidden = true;
        spacer.hidden = true;
        collapsePanel();
        return;
      }
      if (state.pinned) {
        prompt.hidden = false;
        prompt.textContent = state.promptText.slice(0, PROMPT_LINE_MAX_CHARS);
        prompt.title = zh ? "回到本轮开始" : "Scroll to this turn";
        expand.setAttribute("aria-label", zh ? "展开完整提示词" : "Show the full prompt");
        panel.textContent = state.promptText;
        // Only a prompt the single line actually clipped has anything to expand.
        // Measured with the chevron gone so the answer cannot depend on itself.
        expand.hidden = true;
        const clipped = prompt.scrollWidth > prompt.clientWidth + 1;
        expand.hidden = !clipped;
        if (!clipped) collapsePanel();
        spacer.hidden = true;
        return;
      }
      prompt.hidden = true;
      prompt.textContent = "";
      expand.hidden = true;
      spacer.hidden = false;
      collapsePanel();
    },
    notify(text) {
      notice.textContent = text;
      notice.hidden = false;
      if (noticeTimer !== null) clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => {
        notice.hidden = true;
        noticeTimer = null;
      }, NOTICE_MS);
    },
    collapsePanel,
    setThreadId(threadId) {
      root.setAttribute(input.rootAttribute, threadId);
    },
    dispose() {
      if (noticeTimer !== null) clearTimeout(noticeTimer);
      collapsePanel();
      root.remove();
    },
  };
}
