import { reviewPathMatches } from "./renderer-conversation-files.js";
import { OVERLAY_ROOT_SELECTOR } from "./renderer-overlay-layout.js";

/**
 * Desktop's own Changes summary and Review/diff controls. codexhost hides them
 * only while its replacement file disclosure is mounted, and routes file
 * selection back through them so the native change display stays in charge.
 */
export const NATIVE_WORKSPACE_DIFF_HIDDEN_ATTRIBUTE = "data-codexhost-native-workspace-diff-hidden";

const STYLE_ATTRIBUTE = "data-codexhost-native-diff-style";

export function ensureNativeDiffControlStyle(ownerDocument: Document): void {
  if (ownerDocument.querySelector(`style[${STYLE_ATTRIBUTE}]`)) return;
  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "true");
  style.textContent = `
    [${NATIVE_WORKSPACE_DIFF_HIDDEN_ATTRIBUTE}] {
      display: none !important;
    }
  `;
  (ownerDocument.head ?? ownerDocument.documentElement).append(style);
}

function controlLabel(element: Element): string {
  return [element.getAttribute("aria-label"), element.getAttribute("title"), element.textContent]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

function controlVisible(element: Element): boolean {
  const typed = element as HTMLElement;
  if (typed.hidden || typed.getAttribute("aria-hidden") === "true") return false;
  const bounds = typed.getBoundingClientRect?.();
  return Boolean(bounds && bounds.width > 0 && bounds.height > 0);
}

export function isNativeWorkspaceDiffControl(element: Element): boolean {
  const label = controlLabel(element);
  if (
    element.getAttribute("data-slot") === "thread-summary-panel-item-button" &&
    /changes|files changed|变更|文件变更/i.test(label)
  ) {
    return true;
  }
  if (element.getAttribute("data-tab-id") === "diff") return true;
  return /open review tab|打开审查|打开变更/i.test(label);
}

function nativeWorkspaceDiffRank(element: Element): number {
  if (element.getAttribute("data-slot") === "thread-summary-panel-item-button") return 0;
  if (/open review tab|打开审查|打开变更/i.test(controlLabel(element))) return 1;
  if (element.getAttribute("data-tab-id") === "diff") return 2;
  return 3;
}

function nativeWorkspaceDiffCandidates(root: ParentNode): Element[] {
  return [...root.querySelectorAll("button, [role='button'], [data-tab-id='diff']")].filter(
    (element) => !element.closest(OVERLAY_ROOT_SELECTOR) && isNativeWorkspaceDiffControl(element),
  );
}

export function setNativeWorkspaceDiffControlsHidden(root: ParentNode, hidden: boolean): void {
  const ownerDocument =
    root instanceof Document ? root : ((root as Element).ownerDocument ?? document);
  if (!hidden) {
    for (const element of ownerDocument.querySelectorAll(
      `[${NATIVE_WORKSPACE_DIFF_HIDDEN_ATTRIBUTE}]`,
    )) {
      element.removeAttribute(NATIVE_WORKSPACE_DIFF_HIDDEN_ATTRIBUTE);
    }
    return;
  }
  for (const element of nativeWorkspaceDiffCandidates(root)) {
    element.setAttribute(NATIVE_WORKSPACE_DIFF_HIDDEN_ATTRIBUTE, "true");
  }
}

export function nativeWorkspaceDiffControl(root: ParentNode): HTMLElement | null {
  const candidates = nativeWorkspaceDiffCandidates(root).filter(
    (element) =>
      controlVisible(element) || element.hasAttribute(NATIVE_WORKSPACE_DIFF_HIDDEN_ATTRIBUTE),
  );
  candidates.sort((left, right) => nativeWorkspaceDiffRank(left) - nativeWorkspaceDiffRank(right));
  const match = candidates[0];
  if (!match) return null;
  if (match instanceof HTMLElement && match.tagName === "BUTTON") return match;
  const inner = match.querySelector("button");
  return inner instanceof HTMLElement ? inner : match instanceof HTMLElement ? match : null;
}

export function openNativeWorkspaceDiff(root: ParentNode = document): boolean {
  const control = nativeWorkspaceDiffControl(root);
  if (!control) return false;
  control.click();
  return true;
}

export function nativeReviewFileControl(root: ParentNode, filePath: string): HTMLElement | null {
  for (const element of root.querySelectorAll("[data-review-path]")) {
    const reviewPath = element.getAttribute("data-review-path") ?? "";
    if (!reviewPathMatches(reviewPath, filePath)) continue;
    const header = element.querySelector<HTMLElement>('[class*="diff-header"]');
    return header ?? (element instanceof HTMLElement ? element : null);
  }
  return null;
}

/** Opens Desktop's diff view and reveals one file in it (native review keeps ownership). */
export function openConversationFile(ownerDocument: Document, file: { path: string }): void {
  openNativeWorkspaceDiff(ownerDocument);
  const reveal = (): void => {
    const control = nativeReviewFileControl(ownerDocument, file.path);
    control?.scrollIntoView({ block: "center", inline: "nearest" });
    control?.click();
  };
  ownerDocument.defaultView?.setTimeout(reveal, 50);
}
