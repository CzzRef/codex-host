export const BRANCH_WORKTREE_TOGGLE_ATTRIBUTE = "data-codexhost-branch-worktree-toggle";
export const BRANCH_WORKTREE_PREFERENCE_KEY = "codexhost.switch-branch-worktree";

const STYLE_ATTRIBUTE = "data-codexhost-branch-worktree-style";

export interface RendererBranchWorktreeToggle {
  refresh(): void;
  dispose(): void;
}

export function windowLocalStorage(view: Window | null | undefined): Storage | null {
  try {
    return view?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readBranchWorktreePreference(storage: Pick<Storage, "getItem"> | null): boolean {
  try {
    const value = storage?.getItem(BRANCH_WORKTREE_PREFERENCE_KEY);
    if (value === "0" || value === "false") return false;
    return true;
  } catch {
    return true;
  }
}

export function writeBranchWorktreePreference(
  storage: Pick<Storage, "setItem"> | null,
  enabled: boolean,
): void {
  try {
    storage?.setItem(BRANCH_WORKTREE_PREFERENCE_KEY, enabled ? "1" : "0");
  } catch {
    // Opaque origins may deny localStorage.
  }
}

export function isSwitchBranchButton(element: Element): boolean {
  const typed = element as HTMLButtonElement;
  const label = [
    typed.getAttribute?.("aria-label"),
    typed.getAttribute?.("title"),
    typed.textContent,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return /switch branch|切换分支/.test(label);
}

function ensureStyle(ownerDocument: Document): void {
  if (ownerDocument.querySelector(`style[${STYLE_ATTRIBUTE}]`)) return;
  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "true");
  style.textContent = `
    [${BRANCH_WORKTREE_TOGGLE_ATTRIBUTE}] {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 8px;
      font-size: 12px;
      line-height: 16px;
      white-space: nowrap;
      pointer-events: auto;
    }
    [${BRANCH_WORKTREE_TOGGLE_ATTRIBUTE}] input {
      margin: 0;
    }
  `;
  (ownerDocument.head ?? ownerDocument.documentElement).append(style);
}

function chineseLocale(ownerDocument: Document): boolean {
  return (ownerDocument.documentElement.lang || "").toLowerCase().startsWith("zh");
}

export function installRendererBranchWorktreeToggle(
  root: ParentNode = document,
): RendererBranchWorktreeToggle {
  const documentNode =
    root instanceof Document ? root : ((root as Element).ownerDocument ?? document);
  ensureStyle(documentNode);
  const toggles = new Map<Element, HTMLElement>();
  let disposed = false;

  const place = (button: Element): void => {
    const parent = button.parentElement;
    if (!parent) return;
    let toggle = toggles.get(button);
    if (!toggle) {
      toggle = documentNode.createElement("label");
      toggle.setAttribute(BRANCH_WORKTREE_TOGGLE_ATTRIBUTE, "true");
      const checkbox = documentNode.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = readBranchWorktreePreference(windowLocalStorage(documentNode.defaultView));
      checkbox.addEventListener("change", () => {
        writeBranchWorktreePreference(
          windowLocalStorage(documentNode.defaultView),
          checkbox.checked,
        );
      });
      const text = documentNode.createElement("span");
      text.textContent = chineseLocale(documentNode) ? "工作树" : "Worktree";
      toggle.append(checkbox, text);
      toggles.set(button, toggle);
    }
    if (toggle.previousElementSibling !== button || toggle.parentElement !== parent) {
      parent.insertBefore(toggle, button.nextSibling);
    }
  };

  const scan = (): void => {
    if (disposed) return;
    const live = new Set<Element>();
    for (const button of root.querySelectorAll("button")) {
      if (!isSwitchBranchButton(button)) continue;
      live.add(button);
      place(button);
    }
    for (const [button, toggle] of toggles) {
      if (live.has(button) && button.isConnected) continue;
      toggle.remove();
      toggles.delete(button);
    }
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (disposed || timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      scan();
    }, 0);
  });
  observer.observe(documentNode.documentElement ?? documentNode, {
    childList: true,
    subtree: true,
  });
  scan();

  return {
    refresh: scan,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
      for (const toggle of toggles.values()) toggle.remove();
      toggles.clear();
    },
  };
}
