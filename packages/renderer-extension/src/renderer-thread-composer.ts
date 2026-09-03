import { hostThreadIdSchema } from "@codexhost/shared-contracts";

import { CODEX_COMPOSER_SELECTOR } from "./renderer-composer-dom.js";
import {
  findComposerModelTarget,
  threadIdFromComposerModelTarget,
} from "./versioned-renderer-adapter.js";

/** A Composer root that is laid out on screen (not hidden, non-zero box). */
export function composerVisible(composer: Element): boolean {
  const typed = composer as HTMLElement;
  if (typed.hidden || typed.getAttribute("aria-hidden") === "true") return false;
  const bounds = typed.getBoundingClientRect?.();
  return Boolean(bounds && bounds.width > 0 && bounds.height > 0);
}

/**
 * The Thread a Composer belongs to: Desktop stamps it on the above-Composer
 * portal; the React model target is the fallback. `null` for drafts.
 */
export function threadIdForComposer(composer: Element): string | null {
  const portal = [...composer.children].find((child) =>
    child.hasAttribute("data-above-composer-portal"),
  );
  const fromPortal = portal?.getAttribute("data-above-composer-conversation-id");
  const parsedPortal = fromPortal ? hostThreadIdSchema.safeParse(fromPortal) : null;
  if (parsedPortal?.success) return parsedPortal.data;
  try {
    return threadIdFromComposerModelTarget(findComposerModelTarget(composer)) ?? null;
  } catch {
    return null;
  }
}

/** Every visible Composer root, in document order. */
export function visibleComposers(root: ParentNode): Element[] {
  return [...root.querySelectorAll(CODEX_COMPOSER_SELECTOR)].filter(composerVisible);
}
