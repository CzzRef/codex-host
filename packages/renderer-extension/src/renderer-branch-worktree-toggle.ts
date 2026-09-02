export const BRANCH_WORKTREE_TOGGLE_ATTRIBUTE = "data-codexhost-branch-worktree-toggle";
export const BRANCH_WORKTREE_PREFERENCE_KEY = "codexhost.switch-branch-worktree";

const STYLE_ATTRIBUTE = "data-codexhost-branch-worktree-style";
const RUN_LOCATION_SELECTOR =
  'button[aria-haspopup="menu"][data-composer-navigation-target="run-location"]';
const MODE_SYNC_TIMEOUT_MS = 1_000;

type DraftWorktreeMode = "local" | "worktree";

export interface RendererBranchWorktreeToggle {
  refresh(): void;
  dispose(): void;
}

export interface DraftWorktreeModeBinding {
  mode: DraftWorktreeMode;
  setMode(mode: DraftWorktreeMode): void;
}

interface ToggleEntry {
  checkbox: HTMLInputElement;
  label: HTMLElement;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstFiber(element: Element): Record<string, unknown> | null {
  const names = Object.getOwnPropertyNames(element).filter((name) =>
    name.startsWith("__reactFiber$"),
  );
  const name = names[0];
  if (names.length !== 1 || !name) return null;
  const value = Object.getOwnPropertyDescriptor(element, name)?.value;
  return isRecord(value) ? value : null;
}

export function draftWorktreeModeBindingFromButton(
  button: Element,
): DraftWorktreeModeBinding | null {
  if (!button.matches(RUN_LOCATION_SELECTOR)) return null;

  let ownsTrigger = false;
  const owners = new Set<Record<string, unknown>>();
  let fiber = firstFiber(button);
  for (let depth = 0; fiber && depth < 60; depth += 1) {
    const props = fiber.memoizedProps;
    if (isRecord(props)) {
      if (
        props["data-composer-navigation-target"] === "run-location" &&
        props["aria-haspopup"] === "menu"
      ) {
        ownsTrigger = true;
      }
      if (
        (props.composerMode === "local" || props.composerMode === "worktree") &&
        typeof props.setComposerMode === "function" &&
        props.conversationId === null
      ) {
        owners.add(props);
      }
    }
    fiber = isRecord(fiber.return) ? fiber.return : null;
  }

  const owner = [...owners][0];
  if (!ownsTrigger || owners.size !== 1 || !owner) return null;
  const mode = owner.composerMode;
  const setMode = owner.setComposerMode;
  if ((mode !== "local" && mode !== "worktree") || typeof setMode !== "function") return null;
  return {
    mode,
    setMode(nextMode) {
      setMode(nextMode);
    },
  };
}

export function findDraftWorktreeModeBinding(
  root: ParentNode = document,
): DraftWorktreeModeBinding | null {
  const bindings = [...root.querySelectorAll(RUN_LOCATION_SELECTOR)]
    .map((button) => draftWorktreeModeBindingFromButton(button))
    .filter((binding): binding is DraftWorktreeModeBinding => binding !== null);
  return bindings.length === 1 ? (bindings[0] ?? null) : null;
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
  return [typed.getAttribute?.("aria-label"), typed.getAttribute?.("title")]
    .filter((value): value is string => typeof value === "string")
    .some((value) => /^(?:switch branch|切换分支)(?:\s|$)/i.test(value.trim()));
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
    [${BRANCH_WORKTREE_TOGGLE_ATTRIBUTE}] input:disabled {
      opacity: 0.6;
    }
  `;
  (ownerDocument.head ?? ownerDocument.documentElement).append(style);
}

function chineseLocale(ownerDocument: Document): boolean {
  return (ownerDocument.documentElement.lang || "").toLowerCase().startsWith("zh");
}

function preferredMode(storage: Pick<Storage, "getItem"> | null): DraftWorktreeMode {
  return readBranchWorktreePreference(storage) ? "worktree" : "local";
}

function modeUsesWorktree(mode: DraftWorktreeMode): boolean {
  return mode === "worktree";
}

export function installRendererBranchWorktreeToggle(
  root: ParentNode = document,
): RendererBranchWorktreeToggle {
  const documentNode =
    root instanceof Document ? root : ((root as Element).ownerDocument ?? document);
  const storage = windowLocalStorage(documentNode.defaultView);
  ensureStyle(documentNode);
  const toggles = new Map<Element, ToggleEntry>();
  let disposed = false;
  let activeDraft = false;
  let lastObservedMode: DraftWorktreeMode | null = null;
  let pendingMode: DraftWorktreeMode | null = null;
  let verificationTimer: ReturnType<typeof setTimeout> | null = null;

  const clearVerificationTimer = (): void => {
    if (verificationTimer === null) return;
    clearTimeout(verificationTimer);
    verificationTimer = null;
  };

  const removeToggles = (): void => {
    for (const entry of toggles.values()) entry.label.remove();
    toggles.clear();
  };

  const resetDraft = (): void => {
    clearVerificationTimer();
    activeDraft = false;
    lastObservedMode = null;
    pendingMode = null;
  };

  const requestMode = (
    binding: DraftWorktreeModeBinding,
    mode: DraftWorktreeMode,
    remember: boolean,
  ): void => {
    if (remember) writeBranchWorktreePreference(storage, modeUsesWorktree(mode));
    if (binding.mode === mode) {
      pendingMode = null;
      lastObservedMode = mode;
      return;
    }
    pendingMode = mode;
    lastObservedMode = binding.mode;
    try {
      binding.setMode(mode);
    } catch {
      pendingMode = null;
      writeBranchWorktreePreference(storage, modeUsesWorktree(binding.mode));
      return;
    }
    clearVerificationTimer();
    verificationTimer = setTimeout(() => {
      verificationTimer = null;
      const expectedMode = pendingMode;
      scan();
      if (expectedMode === null || pendingMode !== expectedMode) return;
      const current = findDraftWorktreeModeBinding(root);
      pendingMode = null;
      if (current) {
        lastObservedMode = current.mode;
        writeBranchWorktreePreference(storage, modeUsesWorktree(current.mode));
      }
      scan();
    }, MODE_SYNC_TIMEOUT_MS);
  };

  const onPreferenceChange = (checkbox: HTMLInputElement): void => {
    const binding = findDraftWorktreeModeBinding(root);
    if (!binding) {
      checkbox.checked = lastObservedMode === "worktree";
      return;
    }
    requestMode(binding, checkbox.checked ? "worktree" : "local", true);
    scan();
  };

  const createToggle = (button: Element): ToggleEntry => {
    const label = documentNode.createElement("label");
    label.setAttribute(BRANCH_WORKTREE_TOGGLE_ATTRIBUTE, "true");
    const checkbox = documentNode.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", () => onPreferenceChange(checkbox));
    const text = documentNode.createElement("span");
    text.textContent = chineseLocale(documentNode) ? "工作树" : "Worktree";
    label.append(checkbox, text);
    const entry = { checkbox, label };
    toggles.set(button, entry);
    return entry;
  };

  const place = (button: Element): ToggleEntry | null => {
    const parent = button.parentElement;
    if (!parent) return null;
    const entry = toggles.get(button) ?? createToggle(button);
    if (entry.label.previousElementSibling !== button || entry.label.parentElement !== parent) {
      parent.insertBefore(entry.label, button.nextSibling);
    }
    return entry;
  };

  function scan(): void {
    if (disposed) return;
    const binding = findDraftWorktreeModeBinding(root);
    const branchButtons = [...root.querySelectorAll("button")].filter(isSwitchBranchButton);
    if (!binding || branchButtons.length !== 1) {
      removeToggles();
      resetDraft();
      return;
    }

    const button = branchButtons[0];
    if (!button) return;
    for (const [candidate, entry] of toggles) {
      if (candidate === button && candidate.isConnected) continue;
      entry.label.remove();
      toggles.delete(candidate);
    }
    const entry = place(button);
    if (!entry) return;

    if (!activeDraft) {
      activeDraft = true;
      lastObservedMode = binding.mode;
      const desiredMode = preferredMode(storage);
      if (desiredMode !== binding.mode) requestMode(binding, desiredMode, false);
    } else if (pendingMode !== null) {
      if (binding.mode === pendingMode) {
        pendingMode = null;
        lastObservedMode = binding.mode;
        clearVerificationTimer();
        writeBranchWorktreePreference(storage, modeUsesWorktree(binding.mode));
      } else if (lastObservedMode !== binding.mode) {
        pendingMode = null;
        lastObservedMode = binding.mode;
        clearVerificationTimer();
        writeBranchWorktreePreference(storage, modeUsesWorktree(binding.mode));
      }
    } else if (lastObservedMode !== binding.mode) {
      lastObservedMode = binding.mode;
      writeBranchWorktreePreference(storage, modeUsesWorktree(binding.mode));
    }

    entry.checkbox.checked = (pendingMode ?? binding.mode) === "worktree";
    entry.checkbox.disabled = pendingMode !== null;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => {
    if (disposed || timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      scan();
    }, 0);
  });
  observer.observe(documentNode.documentElement ?? documentNode, {
    attributes: true,
    attributeFilter: ["aria-haspopup", "data-composer-navigation-target", "title"],
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
      clearVerificationTimer();
      removeToggles();
    },
  };
}
