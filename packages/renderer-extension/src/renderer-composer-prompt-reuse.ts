import {
  CODEX_COMPOSER_SELECTOR,
  EDITOR_SELECTOR,
  isComposerSubmissionKey,
  isComposerSubmitButton,
} from "./renderer-composer-dom.js";
import { threadIdForComposer } from "./renderer-workspace-bar.js";

export const PROMPT_GHOST_ATTRIBUTE = "data-codexhost-prompt-ghost";
export const PROMPT_GHOST_ACTIVE_ATTRIBUTE = "data-codexhost-prompt-ghost-active";
export const PROMPT_REUSE_STORAGE_PREFIX = "codexhost.prompt-reuse:";
export const PROMPT_REUSE_MAX_LENGTH = 4_000;

const STYLE_ATTRIBUTE = "data-codexhost-prompt-ghost-style";
const GHOST_CLASS = "codexhost-prompt-ghost";

export interface RendererComposerPromptReuse {
  refresh(): void;
  dispose(): void;
}

function ensureStyle(ownerDocument: Document): void {
  if (ownerDocument.querySelector(`style[${STYLE_ATTRIBUTE}]`)) return;
  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "true");
  style.textContent = `
    .${GHOST_CLASS} {
      position: fixed;
      pointer-events: none;
      overflow: hidden;
      white-space: pre-wrap;
      word-break: break-word;
      color: inherit;
      z-index: 2;
    }
    .${GHOST_CLASS} .codexhost-prompt-prefix {
      visibility: hidden;
    }
    .${GHOST_CLASS} .codexhost-prompt-suffix {
      opacity: 0.42;
    }
    .${GHOST_CLASS} .codexhost-prompt-hint {
      position: absolute;
      right: 8px;
      bottom: 4px;
      font-size: 10px;
      letter-spacing: 0.04em;
      opacity: 0.45;
    }
    [${PROMPT_GHOST_ACTIVE_ATTRIBUTE}] p.placeholder::after,
    [${PROMPT_GHOST_ACTIVE_ATTRIBUTE}] [data-placeholder]::after,
    [${PROMPT_GHOST_ACTIVE_ATTRIBUTE}] p.placeholder::before,
    [${PROMPT_GHOST_ACTIVE_ATTRIBUTE}] [data-placeholder]::before {
      content: none !important;
      display: none !important;
    }
  `;
  (ownerDocument.head ?? ownerDocument.documentElement).append(style);
}

export function normalizeComposerPrompt(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function editorPromptText(editor: Element): string {
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    return normalizeComposerPrompt(editor.value);
  }
  return normalizeComposerPrompt(editor.textContent ?? "");
}

export function reusablePromptRemainder(suggestion: string, typed: string): string | null {
  if (suggestion.length === 0) return null;
  if (typed.length === 0) return suggestion;
  if (suggestion.startsWith(typed)) {
    const remainder = suggestion.slice(typed.length);
    return remainder.length > 0 ? remainder : null;
  }
  const lowerSuggestion = suggestion.toLowerCase();
  const lowerTyped = typed.toLowerCase();
  if (!lowerSuggestion.startsWith(lowerTyped)) return null;
  const remainder = suggestion.slice(typed.length);
  return remainder.length > 0 ? remainder : null;
}

export function shouldAcceptPromptTab(input: {
  remainder: string | null;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  composing: boolean;
  competing: boolean;
}): boolean {
  return (
    Boolean(input.remainder) &&
    !input.shiftKey &&
    !input.altKey &&
    !input.metaKey &&
    !input.ctrlKey &&
    !input.composing &&
    !input.competing
  );
}

export function isComposerStopLabel(value: string | null | undefined): boolean {
  const label = (value ?? "").trim().toLowerCase();
  if (!label) return false;
  return /^(stop|stop generating|停止|停止生成)$/u.test(label);
}

export function isComposerTurnBusy(composer: Element): boolean {
  return [...composer.querySelectorAll("button")].some((button) =>
    isComposerStopLabel(button.getAttribute("aria-label") ?? button.getAttribute("title")),
  );
}

export function shouldRevealPromptGhost(input: {
  remainder: string | null;
  turnBusy: boolean;
}): boolean {
  return Boolean(input.remainder) && !input.turnBusy;
}

export function shouldQueueComposerPrompt(input: { turnBusy: boolean; prompt: string }): boolean {
  return input.turnBusy && input.prompt.length > 0;
}

export function clearComposerEditor(editor: HTMLElement): void {
  editor.focus();
  const selection = editor.ownerDocument.defaultView?.getSelection();
  selection?.selectAllChildren(editor);
  try {
    editor.ownerDocument.execCommand("delete", false);
  } catch {
    // ProseMirror may reject execCommand.
  }
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    editor.value = "";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  if (editorPromptText(editor).length > 0) {
    editor.textContent = "";
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export function promptReuseStorageKey(threadId: string | null): string {
  return `${PROMPT_REUSE_STORAGE_PREFIX}${threadId ?? "draft"}`;
}

export function windowSessionStorage(view: Window | null | undefined): Storage | null {
  try {
    return view?.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function readStoredPrompt(
  storage: Pick<Storage, "getItem"> | null,
  threadId: string | null,
): string {
  try {
    const value = storage?.getItem(promptReuseStorageKey(threadId)) ?? "";
    return normalizeComposerPrompt(value).slice(0, PROMPT_REUSE_MAX_LENGTH);
  } catch {
    return "";
  }
}

export function writeStoredPrompt(
  storage: Pick<Storage, "setItem" | "removeItem"> | null,
  threadId: string | null,
  prompt: string,
): void {
  const normalized = normalizeComposerPrompt(prompt).slice(0, PROMPT_REUSE_MAX_LENGTH);
  const key = promptReuseStorageKey(threadId);
  try {
    if (!normalized) {
      storage?.removeItem(key);
      return;
    }
    storage?.setItem(key, normalized);
  } catch {
    // Opaque origins may deny sessionStorage.
  }
}

export function competingTabTargetOpen(root: ParentNode): boolean {
  const candidates = root.querySelectorAll(
    '[role="listbox"], [role="menu"][data-state="open"], [aria-haspopup="listbox"][aria-expanded="true"]',
  );
  return [...candidates].some((element) => {
    const typed = element as HTMLElement;
    if (typed.hidden || typed.getAttribute("aria-hidden") === "true") return false;
    const bounds = typed.getBoundingClientRect?.();
    return !bounds || bounds.width > 0 || bounds.height > 0;
  });
}

export function insertComposerText(editor: HTMLElement, text: string): boolean {
  if (text.length === 0) return false;
  editor.focus();
  const ownerDocument = editor.ownerDocument;
  try {
    if (ownerDocument.execCommand("insertText", false, text)) return true;
  } catch {
    // ProseMirror and test documents may reject execCommand.
  }
  const event = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType: "insertText",
    data: text,
  });
  editor.dispatchEvent(event);
  if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) {
    const start = editor.selectionStart ?? editor.value.length;
    const end = editor.selectionEnd ?? start;
    editor.value = `${editor.value.slice(0, start)}${text}${editor.value.slice(end)}`;
    editor.selectionStart = editor.selectionEnd = start + text.length;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }
  return !event.defaultPrevented;
}

function copyEditorTypography(overlay: HTMLElement, editor: HTMLElement): void {
  const style = editor.ownerDocument.defaultView?.getComputedStyle(editor);
  if (!style) return;
  overlay.style.font = style.font;
  overlay.style.fontSize = style.fontSize;
  overlay.style.lineHeight = style.lineHeight;
  overlay.style.letterSpacing = style.letterSpacing;
  overlay.style.padding = style.padding;
}

export function installRendererComposerPromptReuse(
  root: ParentNode = document,
): RendererComposerPromptReuse {
  const documentNode =
    root instanceof Document ? root : ((root as Element).ownerDocument ?? document);
  ensureStyle(documentNode);
  const overlays = new Map<Element, HTMLElement>();
  const dismissed = new Map<Element, string>();
  const pending = new Map<Element, string>();
  let disposed = false;

  const storage = (): Storage | null => windowSessionStorage(documentNode.defaultView);

  const hide = (composer: Element): void => {
    overlays.get(composer)?.remove();
    overlays.delete(composer);
    composer.removeAttribute(PROMPT_GHOST_ACTIVE_ATTRIBUTE);
  };

  const suggestionFor = (composer: Element): string => pending.get(composer) ?? "";

  const paint = (composer: Element): void => {
    const editor = composer.querySelector<HTMLElement>(EDITOR_SELECTOR);
    if (!editor || !composer.isConnected) {
      hide(composer);
      return;
    }
    const turnBusy = isComposerTurnBusy(composer);
    const typed = editorPromptText(editor);
    const suggestion = suggestionFor(composer);
    if (dismissed.get(composer) === suggestion && typed.length === 0) {
      hide(composer);
      return;
    }
    if (typed.length > 0 && dismissed.get(composer) === suggestion) dismissed.delete(composer);
    const remainder = reusablePromptRemainder(suggestion, typed);
    if (!shouldRevealPromptGhost({ remainder, turnBusy })) {
      hide(composer);
      return;
    }
    let overlay = overlays.get(composer);
    if (!overlay) {
      overlay = documentNode.createElement("div");
      overlay.className = GHOST_CLASS;
      overlay.setAttribute(PROMPT_GHOST_ATTRIBUTE, "true");
      overlays.set(composer, overlay);
      documentNode.body.append(overlay);
    }
    const prefix = documentNode.createElement("span");
    prefix.className = "codexhost-prompt-prefix";
    prefix.textContent = typed;
    const suffix = documentNode.createElement("span");
    suffix.className = "codexhost-prompt-suffix";
    suffix.textContent = remainder;
    const hint = documentNode.createElement("span");
    hint.className = "codexhost-prompt-hint";
    hint.textContent = "Tab";
    overlay.replaceChildren(prefix, suffix, hint);
    copyEditorTypography(overlay, editor);
    composer.setAttribute(PROMPT_GHOST_ACTIVE_ATTRIBUTE, "true");
    const rect = editor.getBoundingClientRect();
    overlay.style.left = `${Math.round(rect.left)}px`;
    overlay.style.top = `${Math.round(rect.top)}px`;
    overlay.style.width = `${Math.round(rect.width)}px`;
    overlay.style.height = `${Math.round(rect.height)}px`;
  };

  const queueNext = (composer: Element, editor: HTMLElement): boolean => {
    const prompt = editorPromptText(editor);
    if (!shouldQueueComposerPrompt({ turnBusy: isComposerTurnBusy(composer), prompt }))
      return false;
    pending.set(composer, prompt);
    writeStoredPrompt(storage(), threadIdForComposer(composer), prompt);
    dismissed.delete(composer);
    clearComposerEditor(editor);
    hide(composer);
    return true;
  };

  const accept = (composer: Element): boolean => {
    const editor = composer.querySelector<HTMLElement>(EDITOR_SELECTOR);
    if (!editor) return false;
    const remainder = reusablePromptRemainder(suggestionFor(composer), editorPromptText(editor));
    if (!remainder) return false;
    const inserted = insertComposerText(editor, remainder);
    if (inserted) hide(composer);
    return inserted;
  };

  const forget = (composer: Element): void => {
    hide(composer);
    pending.delete(composer);
    dismissed.delete(composer);
  };

  const scan = (): void => {
    if (disposed) return;
    const live = new Set<Element>();
    for (const composer of root.querySelectorAll(CODEX_COMPOSER_SELECTOR)) {
      live.add(composer);
      paint(composer);
    }
    for (const composer of [...overlays.keys(), ...pending.keys()]) {
      if (!live.has(composer) || !composer.isConnected) forget(composer);
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (disposed) return;
    const target = event.target instanceof Element ? event.target : null;
    const editor = target?.closest(EDITOR_SELECTOR);
    const composer = editor?.closest(CODEX_COMPOSER_SELECTOR);
    if (!composer || !(editor instanceof HTMLElement)) return;
    if (event.key === "Escape") {
      const suggestion = suggestionFor(composer);
      if (suggestion) dismissed.set(composer, suggestion);
      hide(composer);
      return;
    }
    if (isComposerSubmissionKey(event)) {
      if (queueNext(composer, editor)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      pending.delete(composer);
      hide(composer);
      return;
    }
    if (event.key !== "Tab") return;
    if (
      !shouldAcceptPromptTab({
        remainder: reusablePromptRemainder(suggestionFor(composer), editorPromptText(editor)),
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        composing: event.isComposing,
        competing: competingTabTargetOpen(documentNode),
      })
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    accept(composer);
  };

  const onSubmit = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    const composer = target?.closest(CODEX_COMPOSER_SELECTOR);
    const editor = composer?.querySelector<HTMLElement>(EDITOR_SELECTOR);
    if (!composer || !editor) return;
    if (queueNext(composer, editor)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    pending.delete(composer);
    hide(composer);
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("button");
    if (!button || !isComposerSubmitButton(button)) return;
    if (isComposerStopLabel(button.getAttribute("aria-label") ?? button.getAttribute("title"))) {
      return;
    }
    const composer = button.closest(CODEX_COMPOSER_SELECTOR);
    const editor = composer?.querySelector<HTMLElement>(EDITOR_SELECTOR);
    if (!composer || !editor) return;
    if (queueNext(composer, editor)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    pending.delete(composer);
    hide(composer);
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => schedule());
  const observe = (): void => {
    observer.observe(documentNode.documentElement ?? documentNode, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["hidden", "aria-hidden", "aria-label", "data-codex-composer-root"],
    });
  };
  const scanWithoutLoop = (): void => {
    observer.disconnect();
    try {
      scan();
    } finally {
      if (!disposed) observe();
    }
  };
  const schedule = (): void => {
    if (disposed || timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      scanWithoutLoop();
    }, 0);
  };
  observe();
  documentNode.addEventListener("keydown", onKeyDown, true);
  documentNode.addEventListener("submit", onSubmit, true);
  documentNode.addEventListener("click", onClick, true);
  documentNode.addEventListener("input", schedule, true);
  documentNode.defaultView?.addEventListener("resize", schedule);
  documentNode.defaultView?.addEventListener("scroll", schedule, true);
  scanWithoutLoop();

  return {
    refresh: scanWithoutLoop,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      if (timer !== null) clearTimeout(timer);
      documentNode.removeEventListener("keydown", onKeyDown, true);
      documentNode.removeEventListener("submit", onSubmit, true);
      documentNode.removeEventListener("click", onClick, true);
      documentNode.removeEventListener("input", schedule, true);
      documentNode.defaultView?.removeEventListener("resize", schedule);
      documentNode.defaultView?.removeEventListener("scroll", schedule, true);
      for (const composer of [...overlays.keys()]) hide(composer);
    },
  };
}
