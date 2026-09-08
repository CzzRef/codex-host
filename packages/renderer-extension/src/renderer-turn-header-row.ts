import { TURN_ACTIONS_ATTRIBUTE } from "./renderer-turn-actions.js";
import { turnSubtitle } from "./renderer-turn-subtitle.js";

export const TURN_HEADER_INDEX_ATTRIBUTE = "data-codexhost-turn-header-index";
export const TURN_HEADER_PROMPT_ATTRIBUTE = "data-codexhost-turn-header-prompt";
export const TURN_HEADER_PANEL_ATTRIBUTE = "data-codexhost-turn-header-panel";
export const TURN_HEADER_STEP_ATTRIBUTE = "data-codexhost-turn-header-step";
export const TURN_HEADER_WORKSPACE_ATTRIBUTE = "data-codexhost-turn-header-workspace";
export const TURN_HEADER_ENTRY_ATTRIBUTE = "data-codexhost-turn-header-entry";
const NOTICE_MS = 4_000;

export interface TurnHeaderRowState {
  count: number;
  index: number | null;
  position: { index: number; count: number } | null;
  pinned: boolean;
  nativeEdit: boolean;
  busy: boolean;
  reloading: boolean;
  chinese: boolean;
  promptText: string;
  /** Only real, currently addressable transcript nodes; never synthetic Host rows. */
  entries: Array<{ key: string; prompt: string; position: number | null }>;
}

export interface TurnHeaderView {
  root: HTMLElement;
  cluster: HTMLElement;
  /** Mounted beside the Composer, independently of the transcript header. */
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
    onStep(delta: -1 | 1): void;
    onSelect(key: string): void;
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
    button.addEventListener("click", () => input.onStep(delta));
    return button;
  };
  const previous = step(-1);
  const next = step(1);
  const index = ownerDocument.createElement("button");
  index.type = "button";
  index.className = "codexhost-turn-header-index";
  index.setAttribute(TURN_HEADER_INDEX_ATTRIBUTE, "true");
  index.setAttribute("aria-expanded", "false");
  const prompt = ownerDocument.createElement("button");
  prompt.type = "button";
  prompt.className = "codexhost-turn-header-prompt";
  prompt.setAttribute(TURN_HEADER_PROMPT_ATTRIBUTE, "true");
  prompt.addEventListener("click", input.onPromptClick);
  const panel = ownerDocument.createElement("nav");
  panel.className = "codexhost-turn-header-panel";
  panel.setAttribute(TURN_HEADER_PANEL_ATTRIBUTE, "true");
  panel.hidden = true;
  const cluster = ownerDocument.createElement("div");
  cluster.className = "codexhost-turn-actions";
  cluster.setAttribute(TURN_ACTIONS_ATTRIBUTE, "true");
  const notice = ownerDocument.createElement("div");
  notice.className = "codexhost-turn-notice";
  notice.setAttribute("role", "status");
  notice.hidden = true;
  const workspace = ownerDocument.createElement("div");
  workspace.className = "codexhost-composer-workspace codexhost-workspace-surface";
  workspace.setAttribute(TURN_HEADER_WORKSPACE_ATTRIBUTE, "empty");
  workspace.setAttribute(input.overlayAttribute, "true");
  row.append(previous, index, next, prompt, cluster);
  root.append(row, panel, notice);
  let noticeTimer: ReturnType<typeof setTimeout> | null = null;
  const collapsePanel = (): void => {
    if (panel.hidden) return;
    const restore = panel.contains(ownerDocument.activeElement);
    panel.hidden = true;
    index.setAttribute("aria-expanded", "false");
    if (restore) index.focus({ preventScroll: true });
  };
  index.addEventListener("click", () => {
    if (!panel.hidden) {
      collapsePanel();
      return;
    }
    panel.hidden = false;
    index.setAttribute("aria-expanded", "true");
    panel.querySelector<HTMLElement>('[aria-current="step"]')?.focus({ preventScroll: true });
  });
  panel.addEventListener("keydown", (event) => {
    const buttons = [...panel.querySelectorAll<HTMLButtonElement>("button")];
    const current = buttons.indexOf(ownerDocument.activeElement as HTMLButtonElement);
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowDown"
            ? current + 1
            : event.key === "ArrowUp"
              ? current - 1
              : null;
    if (target === null) return;
    event.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, target))]?.focus();
  });
  return {
    root,
    cluster,
    workspace,
    paintRow(state) {
      const zh = state.chinese;
      const position =
        state.position ??
        (state.index === null ? null : { index: state.index, count: state.count });
      if (!state.reloading)
        index.textContent =
          position === null
            ? zh
              ? "还没有轮次"
              : "No turns yet"
            : `${position.index + 1} / ${position.count} ▾`;
      index.disabled = state.count === 0 || state.reloading;
      index.setAttribute("aria-label", zh ? "选择轮次" : "Choose turn");
      panel.setAttribute("aria-label", zh ? "已加载的轮次" : "Loaded turns");
      root.setAttribute("data-state", state.reloading ? "reloading" : "ready");
      previous.disabled = state.index === null || state.index <= 0;
      next.disabled = state.index === null || state.index >= state.count - 1;
      previous.setAttribute("aria-label", zh ? "上一轮" : "Previous turn");
      next.setAttribute("aria-label", zh ? "下一轮" : "Next turn");
      root.setAttribute("data-native-edit", String(state.nativeEdit));
      root.setAttribute("data-streaming", String(state.busy));
      root.setAttribute("data-pinned", String(state.pinned && !state.nativeEdit));
      prompt.textContent = state.nativeEdit
        ? zh
          ? "正在编辑本轮"
          : "Editing this turn"
        : turnSubtitle(state.promptText, zh);
      prompt.disabled = state.nativeEdit || state.index === null;
      prompt.title = zh ? "回到本轮原始提问" : "Go to the original request";
      if (!panel.hidden) collapsePanel();
      panel.replaceChildren();
      state.entries.forEach((entry, loadedIndex) => {
        const button = ownerDocument.createElement("button");
        button.type = "button";
        button.setAttribute(TURN_HEADER_ENTRY_ATTRIBUTE, entry.key);
        if (loadedIndex === state.index) button.setAttribute("aria-current", "step");
        const number = entry.position === null ? loadedIndex + 1 : entry.position + 1;
        button.textContent = `${number}. ${turnSubtitle(entry.prompt, zh)}`;
        button.addEventListener("click", () => {
          collapsePanel();
          input.onSelect(entry.key);
        });
        panel.append(button);
      });
      if ((position?.count ?? state.count) > state.count) {
        const hint = ownerDocument.createElement("p");
        hint.textContent = zh
          ? `已加载 ${state.count} / ${position?.count} 轮；向上滚动可加载更早内容`
          : `${state.count} / ${position?.count} turns loaded. Scroll up to load earlier turns.`;
        panel.append(hint);
      }
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
      workspace.remove();
      root.remove();
    },
  };
}
