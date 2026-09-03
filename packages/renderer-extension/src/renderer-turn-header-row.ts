import { TURN_ACTIONS_ATTRIBUTE } from "./renderer-turn-actions.js";

export const TURN_HEADER_INDEX_ATTRIBUTE = "data-codexhost-turn-header-index";
export const TURN_HEADER_PROMPT_ATTRIBUTE = "data-codexhost-turn-header-prompt";
export const TURN_HEADER_EXPAND_ATTRIBUTE = "data-codexhost-turn-header-expand";
export const TURN_HEADER_PANEL_ATTRIBUTE = "data-codexhost-turn-header-panel";
export const TURN_HEADER_WORKSPACE_ATTRIBUTE = "data-codexhost-turn-header-workspace";

const PROMPT_LINE_MAX_CHARS = 200;
const NOTICE_MS = 4_000;

export interface TurnHeaderRowState {
  count: number;
  index: number | null;
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
  },
): TurnHeaderView {
  const root = ownerDocument.createElement("div");
  root.className = input.className;
  root.setAttribute(input.rootAttribute, input.threadId);
  root.setAttribute(input.overlayAttribute, "true");
  root.setAttribute("data-state", "ready");
  const row = ownerDocument.createElement("div");
  row.className = "codexhost-turn-header-row";
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
  row.append(index, prompt, spacer, expand, cluster);
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
    paintRow(state) {
      const zh = state.chinese;
      if (!state.reloading) {
        index.textContent =
          state.index === null
            ? zh
              ? "还没有轮次"
              : "No turns yet"
            : zh
              ? `第 ${state.index + 1}/${state.count} 轮`
              : `Turn ${state.index + 1}/${state.count}`;
      }
      root.setAttribute("data-state", state.reloading ? "reloading" : "ready");
      root.setAttribute("data-native-edit", state.nativeEdit ? "true" : "false");
      root.setAttribute("data-streaming", state.busy ? "true" : "false");
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
        expand.hidden = false;
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
