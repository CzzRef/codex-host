import type { WorkspaceWorktreeListResult } from "@codexhost/shared-contracts";

import type { RendererModelClient } from "./renderer-model-client.js";
import type { RendererDraftPrewarmPolicy } from "./versioned-renderer-adapter.js";

export const DRAFT_WORKTREE_PICKER_ATTRIBUTE = "data-codexhost-draft-worktree-picker";
export const DRAFT_WORKTREE_MENU_ATTRIBUTE = "data-codexhost-draft-worktree-menu";
export const DRAFT_WORKTREE_OPTION_ATTRIBUTE = "data-codexhost-draft-worktree-option";
/**
 * Remembers only the last pick so the menu can highlight it; a new draft
 * always starts on Desktop's local project directory.
 */
export const DRAFT_WORKTREE_PREFERENCE_KEY = "codexhost.draft-worktree.v1";
/** Retired boolean opt-in of the checkbox era; read once so nothing is lost. */
export const BRANCH_WORKTREE_PREFERENCE_KEY = "codexhost.switch-branch-worktree.v2";

const STYLE_ATTRIBUTE = "data-codexhost-draft-worktree-style";
const RUN_LOCATION_SELECTOR =
  'button[aria-haspopup="menu"][data-composer-navigation-target="run-location"]';
const MODE_SYNC_TIMEOUT_MS = 1_000;
const MENU_GAP_PX = 6;
const FIBER_DEPTH_LIMIT = 60;
const PATH_PROP_KEYS = new Set([
  "cwd",
  "projectRoot",
  "projectPath",
  "workspaceRoot",
  "workspacePath",
  "rootPath",
  "directory",
  // Desktop 26.831 composer owner props (measured live 2026-09-03).
  "gitRootForStartingState",
  "worktreeEnvironmentWorkspaceRoot",
]);
// Nested execution-target objects Desktop hands the composer; `cwd` is the draft's project directory.
const PATH_PROP_NESTED_KEYS = [
  "project",
  "workspace",
  "draft",
  "executionTargetOverride",
  "localRemoteExecutionTarget",
];

type DraftWorktreeMode = "local" | "worktree";

export type DraftWorktreeSelection =
  | { kind: "local" }
  | { kind: "desktop" }
  | { kind: "worktree"; root: string; name: string };

export interface RendererDraftWorktreePicker {
  refresh(): void;
  dispose(): void;
}

export interface RendererDraftWorktreePickerOptions {
  getClient(): RendererModelClient | null;
  getPolicy?(): RendererDraftPrewarmPolicy | null;
}

export interface DraftWorktreeModeBinding {
  mode: DraftWorktreeMode;
  setMode(mode: DraftWorktreeMode): void;
  /** Absolute project directory read from the same React owner, if exposed. */
  projectRoot: string | null;
}

interface PickerCopy {
  chip: string;
  local: string;
  localHint: string;
  desktop: string;
  desktopHint: string;
  existing: string;
  create: string;
  createHint: string;
  createPlaceholder: string;
  createSubmit: string;
  loading: string;
  empty: string;
  noRoot: string;
  noHost: string;
  dirty: string;
  primary: string;
  last: string;
  invalidName: string;
  createFailed: string;
  listFailed: string;
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

export function isAbsoluteWorkspacePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 1 &&
    (value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value))
  );
}

/** First absolute path exposed on props under a project/cwd-like key. */
export function projectRootFromProps(props: Record<string, unknown>): string | null {
  for (const key of PATH_PROP_KEYS) {
    const value = props[key];
    if (isAbsoluteWorkspacePath(value)) return value;
  }
  for (const nested of PATH_PROP_NESTED_KEYS) {
    const value = props[nested];
    if (!isRecord(value)) continue;
    for (const key of ["path", "root", "cwd", "directory", "activeWorkspaceRoot"]) {
      const candidate = value[key];
      if (isAbsoluteWorkspacePath(candidate)) return candidate;
    }
  }
  return null;
}

export function draftWorktreeModeBindingFromButton(
  button: Element,
): DraftWorktreeModeBinding | null {
  if (!button.matches(RUN_LOCATION_SELECTOR)) return null;

  let ownsTrigger = false;
  let projectRoot: string | null = null;
  const owners = new Set<Record<string, unknown>>();
  let fiber = firstFiber(button);
  for (let depth = 0; fiber && depth < FIBER_DEPTH_LIMIT; depth += 1) {
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
      if (projectRoot === null) projectRoot = projectRootFromProps(props);
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
    projectRoot,
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

export function readDraftWorktreePreference(
  storage: Pick<Storage, "getItem"> | null,
): DraftWorktreeSelection | null {
  try {
    const raw = storage?.getItem(DRAFT_WORKTREE_PREFERENCE_KEY);
    if (typeof raw !== "string" || raw.length === 0) {
      const legacy = storage?.getItem(BRANCH_WORKTREE_PREFERENCE_KEY);
      return legacy === "1" || legacy === "true" ? { kind: "desktop" } : null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.kind === "local" || parsed.kind === "desktop") return { kind: parsed.kind };
    if (
      parsed.kind === "worktree" &&
      isAbsoluteWorkspacePath(parsed.root) &&
      typeof parsed.name === "string" &&
      parsed.name.length > 0
    ) {
      return { kind: "worktree", root: parsed.root, name: parsed.name };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeDraftWorktreePreference(
  storage: Pick<Storage, "setItem"> | null,
  selection: DraftWorktreeSelection,
): void {
  try {
    storage?.setItem(DRAFT_WORKTREE_PREFERENCE_KEY, JSON.stringify(selection));
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

export function selectionsEqual(
  left: DraftWorktreeSelection | null,
  right: DraftWorktreeSelection | null,
): boolean {
  if (left === null || right === null) return left === right;
  if (left.kind !== right.kind) return false;
  return left.kind !== "worktree" || right.kind !== "worktree" || left.root === right.root;
}

/** Chip text for the current pick; the menu carries the details. */
export function draftWorktreeChipLabel(
  selection: DraftWorktreeSelection,
  copy: Pick<PickerCopy, "local" | "desktop">,
): string {
  if (selection.kind === "local") return copy.local;
  if (selection.kind === "desktop") return copy.desktop;
  return selection.name;
}

function chineseLocale(ownerDocument: Document): boolean {
  return (ownerDocument.documentElement.lang || "").toLowerCase().startsWith("zh");
}

export function pickerCopy(chinese: boolean): PickerCopy {
  return chinese
    ? {
        chip: "工作树",
        local: "本地",
        localHint: "在项目主目录里开始",
        desktop: "临时工作树",
        desktopHint: "Desktop 自建匿名 worktree",
        existing: "已有工作树",
        create: "新建工作树…",
        createHint: "yyMMdd-功能核心，分支 codex/<名称>",
        createPlaceholder: "260903-feature",
        createSubmit: "创建",
        loading: "读取中…",
        empty: "还没有 Host 管理的工作树",
        noRoot: "先选择项目，才能列出工作树",
        noHost: "Host 路由未就绪",
        dirty: "有未提交改动",
        primary: "主目录",
        last: "上次",
        invalidName: "名称需为 yyMMdd-小写功能核心",
        createFailed: "创建失败",
        listFailed: "读取失败",
      }
    : {
        chip: "Worktree",
        local: "Local",
        localHint: "Start in the project directory",
        desktop: "Temporary worktree",
        desktopHint: "Desktop creates an anonymous worktree",
        existing: "Existing worktrees",
        create: "New worktree…",
        createHint: "yyMMdd-core, branch codex/<name>",
        createPlaceholder: "260903-feature",
        createSubmit: "Create",
        loading: "Loading…",
        empty: "No Host-managed worktrees yet",
        noRoot: "Pick a project to list worktrees",
        noHost: "Host routing is not ready",
        dirty: "uncommitted changes",
        primary: "primary",
        last: "last used",
        invalidName: "Name must be yyMMdd-lowercase-core",
        createFailed: "Create failed",
        listFailed: "List failed",
      };
}

function ensureStyle(ownerDocument: Document): void {
  if (ownerDocument.querySelector(`style[${STYLE_ATTRIBUTE}]`)) return;
  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "true");
  style.textContent = `
    [${DRAFT_WORKTREE_PICKER_ATTRIBUTE}] {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 8px;
      padding: 2px 8px;
      border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      border-radius: 999px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-size: 12px;
      line-height: 16px;
      white-space: nowrap;
      max-width: 220px;
      cursor: pointer;
      pointer-events: auto;
    }
    [${DRAFT_WORKTREE_PICKER_ATTRIBUTE}]:hover,
    [${DRAFT_WORKTREE_PICKER_ATTRIBUTE}][aria-expanded="true"] {
      background: color-mix(in srgb, currentColor 8%, transparent);
    }
    [${DRAFT_WORKTREE_PICKER_ATTRIBUTE}][data-pending="true"] {
      opacity: 0.6;
    }
    [${DRAFT_WORKTREE_PICKER_ATTRIBUTE}] .codexhost-draft-worktree-kind {
      opacity: 0.65;
    }
    [${DRAFT_WORKTREE_PICKER_ATTRIBUTE}] .codexhost-draft-worktree-value {
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 600;
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] {
      position: fixed;
      z-index: 2147483000;
      min-width: 260px;
      max-width: 360px;
      max-height: 60vh;
      overflow: auto;
      padding: 6px;
      border-radius: 10px;
      border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
      background: var(--color-background-primary, Canvas);
      color: inherit;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
      font-size: 12px;
      line-height: 16px;
      pointer-events: auto;
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] .codexhost-draft-worktree-section {
      padding: 6px 8px 2px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.55;
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] [${DRAFT_WORKTREE_OPTION_ATTRIBUTE}] {
      display: flex;
      width: 100%;
      align-items: baseline;
      gap: 8px;
      padding: 6px 8px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] [${DRAFT_WORKTREE_OPTION_ATTRIBUTE}]:hover,
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] [${DRAFT_WORKTREE_OPTION_ATTRIBUTE}]:focus-visible {
      background: color-mix(in srgb, currentColor 8%, transparent);
      outline: none;
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] [${DRAFT_WORKTREE_OPTION_ATTRIBUTE}][aria-checked="true"] {
      background: color-mix(in srgb, currentColor 12%, transparent);
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] .codexhost-draft-worktree-name {
      font-weight: 600;
      flex: 0 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] .codexhost-draft-worktree-meta {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: 0.6;
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] .codexhost-draft-worktree-dirty {
      color: #d97706;
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] .codexhost-draft-worktree-status {
      padding: 6px 8px;
      opacity: 0.6;
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] .codexhost-draft-worktree-error {
      padding: 6px 8px;
      color: #dc2626;
      white-space: normal;
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] form {
      display: flex;
      gap: 6px;
      padding: 4px 8px 6px;
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] input {
      flex: 1 1 auto;
      min-width: 0;
      padding: 4px 6px;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      background: transparent;
      color: inherit;
      font: inherit;
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] form button {
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] form button:disabled,
    [${DRAFT_WORKTREE_MENU_ATTRIBUTE}] input:disabled {
      opacity: 0.6;
      cursor: default;
    }
  `;
  (ownerDocument.head ?? ownerDocument.documentElement).append(style);
}

interface WorktreeListState {
  root: string;
  status: "loading" | "ready" | "error";
  result: WorkspaceWorktreeListResult | null;
  error: string | null;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return String(error);
}

export function installRendererDraftWorktreePicker(
  options: RendererDraftWorktreePickerOptions,
  root: ParentNode = document,
): RendererDraftWorktreePicker {
  const documentNode =
    root instanceof Document ? root : ((root as Element).ownerDocument ?? document);
  const view = documentNode.defaultView;
  const storage = windowLocalStorage(view);
  ensureStyle(documentNode);
  const policyOf = (): RendererDraftPrewarmPolicy | null =>
    options.getPolicy?.() ??
    (view as (Window & { __codexhostDraftPrewarmPolicyV1?: RendererDraftPrewarmPolicy }) | null)
      ?.__codexhostDraftPrewarmPolicyV1 ??
    null;

  let disposed = false;
  let activeDraft = false;
  let chip: HTMLButtonElement | null = null;
  let chipAnchor: Element | null = null;
  let menu: HTMLDivElement | null = null;
  let selection: DraftWorktreeSelection = { kind: "local" };
  let lastObservedMode: DraftWorktreeMode | null = null;
  let pendingMode: DraftWorktreeMode | null = null;
  let verificationTimer: ReturnType<typeof setTimeout> | null = null;
  let list: WorktreeListState | null = null;
  let creating = false;
  let createError: string | null = null;
  let createOpen = false;
  let notice: string | null = null;

  const copy = (): PickerCopy => pickerCopy(chineseLocale(documentNode));

  const clearVerificationTimer = (): void => {
    if (verificationTimer === null) return;
    clearTimeout(verificationTimer);
    verificationTimer = null;
  };

  const currentProjectRoot = (binding: DraftWorktreeModeBinding | null): string | null => {
    if (binding?.projectRoot) return binding.projectRoot;
    if (selection.kind === "worktree" && list) return list.root;
    const observed = policyOf()?.draftCwd?.();
    return isAbsoluteWorkspacePath(observed) ? observed : null;
  };

  const applyWorkspace = (cwd: string | null): boolean => {
    const policy = policyOf();
    if (!policy?.selectWorkspace) return cwd === null;
    try {
      policy.selectWorkspace(cwd === null ? null : { cwd });
      return true;
    } catch {
      return false;
    }
  };

  const resetDraft = (): void => {
    clearVerificationTimer();
    if (activeDraft) applyWorkspace(null);
    activeDraft = false;
    lastObservedMode = null;
    pendingMode = null;
    selection = { kind: "local" };
    createOpen = false;
    createError = null;
    notice = null;
    closeMenu();
  };

  const requestMode = (binding: DraftWorktreeModeBinding, mode: DraftWorktreeMode): void => {
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
      if (current) lastObservedMode = current.mode;
      scan();
    }, MODE_SYNC_TIMEOUT_MS);
  };

  const loadList = (projectRoot: string, force = false): void => {
    if (!force && list && list.root === projectRoot && list.status !== "error") return;
    const client = options.getClient();
    if (!client?.listWorkspaceWorktrees) {
      list = { root: projectRoot, status: "error", result: null, error: copy().noHost };
      renderMenu();
      return;
    }
    const state: WorktreeListState = { root: projectRoot, status: "loading", result: null, error: null };
    list = state;
    renderMenu();
    const listWorktrees = client.listWorkspaceWorktrees.bind(client);
    void Promise.resolve()
      .then(() => listWorktrees({ projectRoot }))
      .then((result) => {
        if (disposed || list !== state) return;
        list = { root: projectRoot, status: "ready", result, error: null };
        renderMenu();
      })
      .catch((error: unknown) => {
        if (disposed || list !== state) return;
        list = { root: projectRoot, status: "error", result: null, error: errorText(error) };
        renderMenu();
      });
  };

  const choose = (next: DraftWorktreeSelection, binding: DraftWorktreeModeBinding | null): void => {
    const current = binding ?? findDraftWorktreeModeBinding(root);
    if (!current) return;
    notice = null;
    if (next.kind === "worktree") {
      if (!applyWorkspace(next.root)) {
        notice = copy().noHost;
        renderMenu();
        return;
      }
      requestMode(current, "local");
    } else {
      applyWorkspace(null);
      requestMode(current, next.kind === "desktop" ? "worktree" : "local");
    }
    selection = next;
    writeDraftWorktreePreference(storage, next);
    closeMenu();
    scan();
  };

  const createWorktree = (
    name: string,
    projectRoot: string,
    binding: DraftWorktreeModeBinding | null,
  ): void => {
    const client = options.getClient();
    if (!client?.createWorkspaceWorktree) {
      createError = copy().noHost;
      renderMenu();
      return;
    }
    creating = true;
    createError = null;
    renderMenu();
    const create = client.createWorkspaceWorktree.bind(client);
    void Promise.resolve()
      .then(() => create({ projectRoot, name, lane: "codex" }))
      .then((result) => {
        if (disposed) return;
        creating = false;
        createOpen = false;
        list = null;
        loadList(result.primaryRoot, true);
        choose(
          { kind: "worktree", root: result.worktree.root, name: result.worktree.name },
          binding,
        );
      })
      .catch((error: unknown) => {
        if (disposed) return;
        creating = false;
        createError = `${copy().createFailed}: ${errorText(error)}`;
        renderMenu();
      });
  };

  function closeMenu(): void {
    if (!menu) return;
    menu.remove();
    menu = null;
    chip?.setAttribute("aria-expanded", "false");
    documentNode.removeEventListener("pointerdown", onDocumentPointerDown, true);
    documentNode.removeEventListener("keydown", onDocumentKeyDown, true);
  }

  const onDocumentPointerDown = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (menu?.contains(target) || chip?.contains(target)) return;
    closeMenu();
  };

  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      closeMenu();
      chip?.focus();
    }
  };

  const placeMenu = (): void => {
    if (!menu || !chip) return;
    const rect = chip.getBoundingClientRect();
    const viewportHeight = view?.innerHeight ?? documentNode.documentElement.clientHeight;
    const viewportWidth = view?.innerWidth ?? documentNode.documentElement.clientWidth;
    menu.style.left = `${Math.max(8, Math.min(rect.left, viewportWidth - menu.offsetWidth - 8))}px`;
    const below = rect.bottom + MENU_GAP_PX;
    if (below + menu.offsetHeight <= viewportHeight - 8) {
      menu.style.top = `${below}px`;
      menu.style.bottom = "";
    } else {
      menu.style.top = "";
      menu.style.bottom = `${Math.max(8, viewportHeight - rect.top + MENU_GAP_PX)}px`;
    }
  };

  const optionButton = (
    text: PickerCopy,
    label: string,
    hint: string,
    checked: boolean,
    onPick: () => void,
    extra?: { dirty?: boolean; title?: string },
  ): HTMLButtonElement => {
    const button = documentNode.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitemradio");
    button.setAttribute("aria-checked", checked ? "true" : "false");
    button.setAttribute(DRAFT_WORKTREE_OPTION_ATTRIBUTE, label);
    if (extra?.title) button.title = extra.title;
    const name = documentNode.createElement("span");
    name.className = "codexhost-draft-worktree-name";
    name.textContent = label;
    const meta = documentNode.createElement("span");
    meta.className = "codexhost-draft-worktree-meta";
    meta.textContent = hint;
    button.append(name, meta);
    if (extra?.dirty) {
      const dirty = documentNode.createElement("span");
      dirty.className = "codexhost-draft-worktree-dirty";
      dirty.textContent = `● ${text.dirty}`;
      button.append(dirty);
    }
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onPick();
    });
    return button;
  };

  function renderMenu(): void {
    if (!menu || disposed) return;
    const text = copy();
    const binding = findDraftWorktreeModeBinding(root);
    const projectRoot = currentProjectRoot(binding);
    menu.replaceChildren();

    menu.append(
      optionButton(text, text.local, text.localHint, selection.kind === "local", () =>
        choose({ kind: "local" }, binding),
      ),
      optionButton(text, text.desktop, text.desktopHint, selection.kind === "desktop", () =>
        choose({ kind: "desktop" }, binding),
      ),
    );

    const section = documentNode.createElement("div");
    section.className = "codexhost-draft-worktree-section";
    section.textContent = text.existing;
    menu.append(section);

    if (!projectRoot) {
      const status = documentNode.createElement("div");
      status.className = "codexhost-draft-worktree-status";
      status.textContent = text.noRoot;
      menu.append(status);
    } else if (!list || list.root !== projectRoot) {
      loadList(projectRoot);
      return;
    } else if (list.status === "loading") {
      const status = documentNode.createElement("div");
      status.className = "codexhost-draft-worktree-status";
      status.textContent = text.loading;
      menu.append(status);
    } else if (list.status === "error") {
      const status = documentNode.createElement("div");
      status.className = "codexhost-draft-worktree-error";
      status.textContent = `${text.listFailed}: ${list.error ?? ""}`;
      menu.append(status);
    } else if (list.result) {
      const linked = list.result.worktrees.filter((entry) => !entry.isPrimary);
      if (linked.length === 0) {
        const status = documentNode.createElement("div");
        status.className = "codexhost-draft-worktree-status";
        status.textContent = text.empty;
        menu.append(status);
      }
      const remembered = readDraftWorktreePreference(storage);
      for (const entry of linked) {
        const wasLast = remembered?.kind === "worktree" && remembered.root === entry.root;
        menu.append(
          optionButton(
            text,
            entry.name,
            `${entry.branch ?? entry.headSha}${wasLast ? ` · ${text.last}` : ""}`,
            selection.kind === "worktree" && selection.root === entry.root,
            () => choose({ kind: "worktree", root: entry.root, name: entry.name }, binding),
            { dirty: entry.dirty, title: entry.root },
          ),
        );
      }
    }

    const createButton = documentNode.createElement("button");
    createButton.type = "button";
    createButton.setAttribute("role", "menuitem");
    createButton.setAttribute(DRAFT_WORKTREE_OPTION_ATTRIBUTE, "create");
    createButton.disabled = !projectRoot;
    const createName = documentNode.createElement("span");
    createName.className = "codexhost-draft-worktree-name";
    createName.textContent = text.create;
    const createMeta = documentNode.createElement("span");
    createMeta.className = "codexhost-draft-worktree-meta";
    createMeta.textContent = text.createHint;
    createButton.append(createName, createMeta);
    createButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      createOpen = !createOpen;
      createError = null;
      renderMenu();
      if (createOpen) menu?.querySelector("input")?.focus();
    });
    menu.append(createButton);

    if (createOpen && projectRoot) {
      const form = documentNode.createElement("form");
      const input = documentNode.createElement("input");
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.placeholder = text.createPlaceholder;
      input.value = list?.result?.suggestedName ?? "";
      input.disabled = creating;
      input.setAttribute("aria-label", text.create);
      const submit = documentNode.createElement("button");
      submit.type = "submit";
      submit.textContent = text.createSubmit;
      submit.disabled = creating;
      form.append(input, submit);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const name = input.value.trim();
        if (!/^\d{6}-[a-z0-9][a-z0-9-]{1,40}$/u.test(name)) {
          createError = text.invalidName;
          renderMenu();
          menu?.querySelector("input")?.focus();
          return;
        }
        createWorktree(name, projectRoot, binding);
      });
      form.addEventListener("keydown", (event) => event.stopPropagation());
      menu.append(form);
      if (!creating) {
        const focused = input;
        setTimeout(() => {
          if (focused.isConnected) {
            focused.focus();
            focused.setSelectionRange(focused.value.length, focused.value.length);
          }
        }, 0);
      }
    }
    if (createError || notice) {
      const error = documentNode.createElement("div");
      error.className = "codexhost-draft-worktree-error";
      error.textContent = createError ?? notice ?? "";
      menu.append(error);
    }
    placeMenu();
  }

  const openMenu = (): void => {
    if (menu || !chip) return;
    menu = documentNode.createElement("div");
    menu.setAttribute(DRAFT_WORKTREE_MENU_ATTRIBUTE, "true");
    menu.setAttribute("role", "menu");
    (documentNode.body ?? documentNode.documentElement).append(menu);
    chip.setAttribute("aria-expanded", "true");
    documentNode.addEventListener("pointerdown", onDocumentPointerDown, true);
    documentNode.addEventListener("keydown", onDocumentKeyDown, true);
    // A failed or never-attempted list (Host client not mounted yet) is retried
    // on every open, so a transient error does not stick for the whole draft.
    const projectRoot = currentProjectRoot(findDraftWorktreeModeBinding(root));
    if (projectRoot && (!list || list.root !== projectRoot || list.status === "error")) {
      loadList(projectRoot, true);
      return;
    }
    renderMenu();
  };

  const createChip = (): HTMLButtonElement => {
    const button = documentNode.createElement("button");
    button.type = "button";
    button.setAttribute(DRAFT_WORKTREE_PICKER_ATTRIBUTE, "true");
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    const kind = documentNode.createElement("span");
    kind.className = "codexhost-draft-worktree-kind";
    const value = documentNode.createElement("span");
    value.className = "codexhost-draft-worktree-value";
    const caret = documentNode.createElement("span");
    caret.className = "codexhost-draft-worktree-caret";
    caret.textContent = "▾";
    button.append(kind, value, caret);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (menu) closeMenu();
      else openMenu();
    });
    return button;
  };

  const paintChip = (): void => {
    if (!chip) return;
    const text = copy();
    const kind = chip.querySelector<HTMLElement>(".codexhost-draft-worktree-kind");
    const value = chip.querySelector<HTMLElement>(".codexhost-draft-worktree-value");
    if (kind) kind.textContent = `${text.chip} ·`;
    if (value) value.textContent = draftWorktreeChipLabel(selection, text);
    chip.title = selection.kind === "worktree" ? selection.root : "";
    chip.setAttribute("data-pending", pendingMode !== null ? "true" : "false");
    chip.setAttribute("data-codexhost-draft-worktree-kind", selection.kind);
  };

  const place = (anchor: Element): void => {
    const parent = anchor.parentElement;
    if (!parent) return;
    chip ??= createChip();
    chipAnchor = anchor;
    if (chip.previousElementSibling !== anchor || chip.parentElement !== parent) {
      parent.insertBefore(chip, anchor.nextSibling);
    }
  };

  const removeChip = (): void => {
    closeMenu();
    chip?.remove();
    chip = null;
    chipAnchor = null;
  };

  function scan(): void {
    if (disposed) return;
    const binding = findDraftWorktreeModeBinding(root);
    const branchButtons = [...root.querySelectorAll("button")].filter(isSwitchBranchButton);
    if (!binding || branchButtons.length !== 1) {
      removeChip();
      resetDraft();
      return;
    }
    const anchor = branchButtons[0];
    if (!anchor) return;
    if (chipAnchor !== anchor) removeChip();
    place(anchor);

    if (!activeDraft) {
      activeDraft = true;
      lastObservedMode = binding.mode;
      // A new draft always starts on Desktop's local directory; the last pick
      // is only remembered for the menu highlight.
      selection = binding.mode === "worktree" ? { kind: "desktop" } : { kind: "local" };
    } else if (pendingMode !== null) {
      if (binding.mode === pendingMode || lastObservedMode !== binding.mode) {
        pendingMode = null;
        lastObservedMode = binding.mode;
        clearVerificationTimer();
      }
    } else if (lastObservedMode !== binding.mode) {
      // Desktop's own run-location menu moved: mirror it without persisting.
      lastObservedMode = binding.mode;
      if (binding.mode === "worktree" && selection.kind === "worktree") {
        // A Host-managed worktree needs Desktop's own mode on `local`; drifting
        // back to `worktree` used to discard the pick silently, so the Thread
        // started in the project root instead of the worktree just created.
        requestMode(binding, "local");
      } else if (binding.mode === "worktree" && selection.kind !== "desktop") {
        applyWorkspace(null);
        selection = { kind: "desktop" };
      } else if (binding.mode === "local" && selection.kind === "desktop") {
        selection = { kind: "local" };
      }
    }
    paintChip();
    // Prefetch once the Host client is mounted so the first open is instant.
    const projectRoot = currentProjectRoot(binding);
    if (projectRoot && !list && options.getClient()?.listWorkspaceWorktrees) loadList(projectRoot);
    if (menu) renderMenu();
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver((records) => {
    if (disposed || timer !== null) return;
    if (
      records.every((record) => {
        const target = record.target;
        return target instanceof Node && (menu?.contains(target) || chip?.contains(target));
      })
    ) {
      return;
    }
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
  const onWorkspaceChanged = (): void => {
    if (disposed) return;
    const binding = findDraftWorktreeModeBinding(root);
    const projectRoot = currentProjectRoot(binding);
    if (projectRoot && (!list || list.root !== projectRoot)) loadList(projectRoot, true);
  };
  const onViewportChange = (): void => {
    if (menu) placeMenu();
  };
  view?.addEventListener("codexhost:draft-workspace-changed", onWorkspaceChanged);
  view?.addEventListener("resize", onViewportChange);
  documentNode.addEventListener("scroll", onViewportChange, true);
  scan();

  return {
    refresh: scan,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
      clearVerificationTimer();
      view?.removeEventListener("codexhost:draft-workspace-changed", onWorkspaceChanged);
      view?.removeEventListener("resize", onViewportChange);
      documentNode.removeEventListener("scroll", onViewportChange, true);
      if (activeDraft) applyWorkspace(null);
      removeChip();
    },
  };
}
