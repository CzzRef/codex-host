import { CODEX_COMPOSER_SELECTOR, EDITOR_SELECTOR } from "./renderer-composer-dom.js";
import { threadIdForComposer } from "./renderer-workspace-bar.js";

export const PROMPT_GHOST_ATTRIBUTE = "data-codexhost-prompt-ghost";
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
  let disposed = false;

  const storage = (): Storage | null => windowSessionStorage(documentNode.defaultView);

  const hide = (composer: Element): void => {
    overlays.get(composer)?.remove();
    overlays.delete(composer);
  };

  const suggestionFor = (composer: Element): string =>
    readStoredPrompt(storage(), threadIdForComposer(composer));

  const paint = (composer: Element): void => {
    const editor = composer.querySelector<HTMLElement>(EDITOR_SELECTOR);
    if (!editor || !composer.isConnected) {
      hide(composer);
      return;
    }
    const typed = editorPromptText(editor);
    const suggestion = suggestionFor(composer);
    if (dismissed.get(composer) === suggestion && typed.length === 0) {
      hide(composer);
      return;
    }
    if (typed.length > 0 && dismissed.get(composer) === suggestion) dismissed.delete(composer);
    const remainder = reusablePromptRemainder(suggestion, typed);
    if (!remainder) {
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
    const rect = editor.getBoundingClientRect();
    overlay.style.left = `${Math.round(rect.left)}px`;
    overlay.style.top = `${Math.round(rect.top)}px`;
    overlay.style.width = `${Math.round(rect.width)}px`;
    overlay.style.height = `${Math.round(rect.height)}px`;
  };

  const capture = (composer: Element): void => {
    const editor = composer.querySelector<HTMLElement>(EDITOR_SELECTOR);
    if (!editor) return;
    const prompt = editorPromptText(editor);
    if (!prompt) return;
    writeStoredPrompt(storage(), threadIdForComposer(composer), prompt);
    dismissed.delete(composer);
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

  const scan = (): void => {
    if (disposed) return;
    const live = new Set<Element>();
    for (const composer of root.querySelectorAll(CODEX_COMPOSER_SELECTOR)) {
      live.add(composer);
      paint(composer);
    }
    for (const composer of [...overlays.keys()]) {
      if (!live.has(composer) || !composer.isConnected) hide(composer);
    }
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (disposed) return;
    const target = event.target instanceof Element ? event.target : null;
    const editor = target?.closest(EDITOR_SELECTOR);
    const composer = editor?.closest(CODEX_COMPOSER_SELECTOR);
    if (!composer || !editor) return;
    if (event.key === "Escape") {
      const suggestion = suggestionFor(composer);
      if (suggestion) dismissed.set(composer, suggestion);
      hide(composer);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      capture(composer);
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
    if (composer) capture(composer);
  };

  let timer: ReturnType<typeof setTimeout> | null = null;
  const observer = new MutationObserver(() => schedule());
  const observe = (): void => {
    observer.observe(documentNode.documentElement ?? documentNode, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["hidden", "aria-hidden", "data-codex-composer-root"],
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
      documentNode.removeEventListener("input", schedule, true);
      documentNode.defaultView?.removeEventListener("resize", schedule);
      documentNode.defaultView?.removeEventListener("scroll", schedule, true);
      for (const composer of [...overlays.keys()]) hide(composer);
    },
  };
}
