import type { ThreadWorkspaceSnapshot } from "@codexhost/shared-contracts";

import {
  aggregateConversationFileStats,
  groupConversationFilesByRepository,
  repositoryDisplayName,
  workspaceLocationLabel,
  type ConversationFileGroup,
  type ThreadConversationFile,
} from "./renderer-conversation-files.js";
import { OVERLAY_ROOT_ATTRIBUTE, clampFixedBox } from "./renderer-overlay-layout.js";
import surfaceCss from "./workspace-surface.css";

/**
 * The workspace row of the Turn header: core worktree chip, touched roots
 * (collapsing into `+N` on one line), the changed-file disclosure that opens
 * downward, and the diff preview overlay beside it. Rendering only; state and
 * placement belong to the header.
 */
export const WORKSPACE_SURFACE_CLASS = "codexhost-workspace-surface";
export const WORKSPACE_ROW_ATTRIBUTE = "data-codexhost-workspace-row";
export const WORKSPACE_CORE_ATTRIBUTE = "data-codexhost-workspace-core";
export const WORKSPACE_MORE_ATTRIBUTE = "data-codexhost-workspace-more";
export const WORKSPACE_FILES_ATTRIBUTE = "data-codexhost-workspace-files";
export const WORKSPACE_FILE_LIST_ATTRIBUTE = "data-codexhost-workspace-file-list";
export const WORKSPACE_FILE_ATTRIBUTE = "data-codexhost-workspace-file";
export const WORKSPACE_TURN_FILE_ATTRIBUTE = "data-codexhost-workspace-turn-file";
export const WORKSPACE_PREVIEW_ATTRIBUTE = "data-codexhost-workspace-preview";

const STYLE_ATTRIBUTE = "data-codexhost-workspace-surface-style";

export function ensureWorkspaceSurfaceStyle(ownerDocument: Document): void {
  if (ownerDocument.querySelector(`style[${STYLE_ATTRIBUTE}]`)) return;
  const style = ownerDocument.createElement("style");
  style.setAttribute(STYLE_ATTRIBUTE, "true");
  style.textContent = surfaceCss;
  (ownerDocument.head ?? ownerDocument.documentElement).append(style);
}

export function formatStats(
  ownerDocument: Document,
  addedLines: number,
  deletedLines: number,
  className: string,
): HTMLSpanElement {
  const stats = ownerDocument.createElement("span");
  stats.className = className;
  const added = ownerDocument.createElement("span");
  added.className = "codexhost-workspace-added";
  added.textContent = `+${addedLines.toLocaleString()}`;
  const deleted = ownerDocument.createElement("span");
  deleted.className = "codexhost-workspace-deleted";
  deleted.textContent = `-${deletedLines.toLocaleString()}`;
  stats.append(added, deleted);
  return stats;
}

export function renderRow(
  ownerDocument: Document,
  group: ConversationFileGroup,
  chinese: boolean,
): HTMLDivElement {
  const { repository } = group;
  const row = ownerDocument.createElement("div");
  row.setAttribute(WORKSPACE_ROW_ATTRIBUTE, repository.kind);
  row.setAttribute("data-codexhost-workspace-root", repository.root);
  if (group.core) row.setAttribute(WORKSPACE_CORE_ATTRIBUTE, "true");
  // Bold: where the files live (worktree directory or checkout folder).
  // Muted: the checkout a worktree belongs to, then the branch.
  const display = workspaceLocationLabel(repository);
  const owner = repositoryDisplayName(repository);
  const branchText = repository.branch ?? repository.headSha;
  const location = ownerDocument.createElement("span");
  location.className = "codexhost-workspace-tree";
  location.textContent = display;
  row.append(location);
  if (repository.isWorktree && owner !== display) {
    const tree = ownerDocument.createElement("span");
    tree.className = "codexhost-workspace-worktree";
    tree.textContent = chinese ? `${owner} 的工作树` : `${owner} worktree`;
    row.append(tree);
  }
  // A worktree named after its branch reads once, not `foo · foo`.
  if (branchText !== display) {
    const branch = ownerDocument.createElement("span");
    branch.className = "codexhost-workspace-branch";
    branch.textContent = `· ${branchText}`;
    row.append(branch);
  }
  if (group.addedLines + group.deletedLines > 0) {
    row.append(
      formatStats(
        ownerDocument,
        group.addedLines,
        group.deletedLines,
        "codexhost-workspace-row-stats",
      ),
    );
  }
  const roleLabel = group.core
    ? chinese
      ? "核心工作区"
      : "Core workspace"
    : repository.kind === "external"
      ? chinese
        ? "涉及的外部仓库"
        : "External repository touched"
      : chinese
        ? "涉及的仓库"
        : "Repository touched";
  // Keep the complete identity available to assistive tech and on activation.
  row.setAttribute("aria-label", `${roleLabel} ${repository.root} ${branchText}`);
  // Rich details open on activation, so paths remain selectable.
  const detail = ownerDocument.createElement("span");
  detail.className = "codexhost-workspace-detail";
  detail.setAttribute("aria-hidden", "true");
  const lines: string[] = [roleLabel, repository.root];
  if (repository.isWorktree && owner !== display) {
    lines.push(chinese ? `${owner} 的工作树` : `${owner} worktree`);
  }
  lines.push(chinese ? `分支 ${branchText}` : `Branch ${branchText}`);
  detail.textContent = lines.join("\n");
  row.setAttribute("role", "button");
  row.tabIndex = 0;
  row.setAttribute("aria-expanded", "false");
  const toggle = (): void => {
    const expanded = row.getAttribute("aria-expanded") !== "true";
    row.setAttribute("aria-expanded", String(expanded));
    detail.setAttribute("aria-hidden", String(!expanded));
  };
  row.addEventListener("click", toggle);
  detail.addEventListener("click", (event) => event.stopPropagation());
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
    if (event.key === "Escape") {
      row.setAttribute("aria-expanded", "false");
      detail.setAttribute("aria-hidden", "true");
      row.focus();
      event.preventDefault();
    }
  });
  row.append(detail);
  return row;
}

/**
 * Keeps the workspace row single-line: trailing repository chips that do not
 * fit are hidden behind a `+N` chip whose list shows them in full. The core
 * chip is never hidden.
 */
export function fitWorkspaceChips(chips: HTMLElement): number {
  const rows = [...chips.querySelectorAll<HTMLElement>(`:scope > [${WORKSPACE_ROW_ATTRIBUTE}]`)];
  const more = chips.querySelector<HTMLElement>(`:scope > [${WORKSPACE_MORE_ATTRIBUTE}]`);
  for (const row of rows) row.hidden = false;
  if (!more) return 0;
  more.hidden = true;
  const list = more.querySelector<HTMLElement>(".codexhost-workspace-more-list");
  list?.replaceChildren();
  let hidden = 0;
  const overflows = (): boolean => chips.scrollWidth > chips.clientWidth + 1;
  while (overflows() && rows.length - hidden > 1) {
    const row = rows[rows.length - 1 - hidden];
    if (!row) break;
    row.hidden = true;
    hidden += 1;
    more.hidden = false;
    more.replaceChildren();
    more.textContent = `+${hidden}`;
    if (list) more.append(list);
  }
  if (hidden > 0 && list) {
    for (const row of rows.slice(rows.length - hidden)) {
      const clone = row.cloneNode(true) as HTMLElement;
      clone.hidden = false;
      clone.removeAttribute("role");
      clone.removeAttribute("tabindex");
      clone.removeAttribute("aria-expanded");
      clone.querySelector(".codexhost-workspace-detail")?.remove();
      const directory = chips.ownerDocument.createElement("small");
      directory.textContent = row.getAttribute("data-codexhost-workspace-root");
      clone.append(directory);
      // Clones are presentation only; they must not read as extra rows.
      clone.removeAttribute(WORKSPACE_ROW_ATTRIBUTE);
      clone.setAttribute(
        "data-codexhost-workspace-more-row",
        row.getAttribute(WORKSPACE_ROW_ATTRIBUTE) ?? "",
      );
      list.append(clone);
    }
  }
  return hidden;
}

/** The chips block: one row per group plus the (initially hidden) `+N` chip. */
export function renderWorkspaceChips(
  ownerDocument: Document,
  groups: readonly ConversationFileGroup[],
  chinese: boolean,
): HTMLDivElement {
  const chips = ownerDocument.createElement("div");
  chips.className = "codexhost-workspace-chips";
  for (const group of groups) chips.append(renderRow(ownerDocument, group, chinese));
  if (groups.length > 1) {
    const more = ownerDocument.createElement("button");
    more.type = "button";
    more.setAttribute(WORKSPACE_MORE_ATTRIBUTE, "true");
    more.setAttribute("aria-expanded", "false");
    more.title = chinese ? "更多涉及的仓库" : "More repositories touched";
    more.hidden = true;
    more.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      more.setAttribute(
        "aria-expanded",
        more.getAttribute("aria-expanded") === "true" ? "false" : "true",
      );
    });
    const list = ownerDocument.createElement("div");
    list.className = "codexhost-workspace-more-list";
    more.append(list);
    chips.append(more);
  }
  return chips;
}

export interface FileDisclosureInput {
  ownerDocument: Document;
  snapshot: ThreadWorkspaceSnapshot | null;
  files: readonly ThreadConversationFile[];
  /** Paths the current Turn touched; they are tagged and listed first. */
  currentTurnPaths: ReadonlySet<string>;
  expanded: boolean;
  chinese: boolean;
  onToggle(): void;
  onPreview(file: ThreadConversationFile, row: HTMLElement, list: HTMLElement): void;
}

/** The right-edge file disclosure whose list opens downward under the header. */
export function renderFileDisclosure(input: FileDisclosureInput): HTMLDivElement {
  const { ownerDocument, chinese, expanded, files } = input;
  const disclosure = ownerDocument.createElement("div");
  disclosure.setAttribute(WORKSPACE_FILES_ATTRIBUTE, expanded ? "open" : "collapsed");
  const heading = ownerDocument.createElement("button");
  heading.type = "button";
  heading.className = "codexhost-workspace-files-toggle";
  heading.setAttribute("aria-expanded", expanded ? "true" : "false");
  const changeLabel = chinese
    ? `变更 ${files.length} 个文件`
    : `${files.length} ${files.length === 1 ? "file" : "files"} changed`;
  heading.setAttribute(
    "aria-label",
    chinese
      ? `${expanded ? "折叠" : "展开"}${changeLabel}`
      : `${expanded ? "Collapse" : "Expand"} ${changeLabel}`,
  );
  const count = ownerDocument.createElement("span");
  count.className = "codexhost-workspace-files-count";
  count.textContent = changeLabel;
  const aggregate = aggregateConversationFileStats(files);
  const chevron = ownerDocument.createElement("span");
  chevron.className = "codexhost-workspace-files-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = expanded ? "▴" : "▾";
  heading.append(count);
  // "+0 -0" beside "0 files" is noise; counters appear once there is a diff.
  if (aggregate.addedLines > 0 || aggregate.deletedLines > 0) {
    heading.append(
      formatStats(
        ownerDocument,
        aggregate.addedLines,
        aggregate.deletedLines,
        "codexhost-workspace-summary-stats",
      ),
    );
  }
  heading.append(chevron);
  heading.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    input.onToggle();
  });
  const rows = ownerDocument.createElement("div");
  rows.className = "codexhost-workspace-files-list";
  rows.setAttribute(WORKSPACE_FILE_LIST_ATTRIBUTE, "downward-right");
  const grouped = groupConversationFilesByRepository(input.snapshot, files);
  const ownedPaths = new Set(
    grouped.groups.flatMap((group) => group.files.map((file) => file.path)),
  );
  const sections: Array<{ label: string | null; files: readonly ThreadConversationFile[] }> =
    grouped.groups.length > 1
      ? grouped.groups
          .filter((group) => group.files.length > 0)
          .map((group) => ({ label: workspaceLocationLabel(group.repository), files: group.files }))
      : [{ label: null, files: files.filter((file) => ownedPaths.has(file.path)) }];
  const leftovers = files.filter((file) => !ownedPaths.has(file.path));
  if (leftovers.length > 0) {
    sections.push({
      label: grouped.groups.length > 0 ? (chinese ? "其他路径" : "Other paths") : null,
      files: leftovers,
    });
  }
  if (sections.every((section) => section.files.length === 0)) {
    sections.splice(0, sections.length, { label: null, files });
  }
  const isCurrent = (file: ThreadConversationFile): boolean =>
    input.currentTurnPaths.has(file.path);
  for (const section of sections) {
    if (section.files.length === 0) continue;
    if (section.label) {
      const groupLabel = ownerDocument.createElement("div");
      groupLabel.className = "codexhost-workspace-files-group";
      groupLabel.textContent = section.label;
      rows.append(groupLabel);
    }
    const ordered = [...section.files].sort(
      (left, right) => Number(isCurrent(right)) - Number(isCurrent(left)),
    );
    for (const file of ordered) {
      const row = ownerDocument.createElement("button");
      row.type = "button";
      row.setAttribute(WORKSPACE_FILE_ATTRIBUTE, file.path);
      const path = ownerDocument.createElement("code");
      path.textContent = file.path;
      row.append(path);
      if (isCurrent(file)) {
        row.setAttribute(WORKSPACE_TURN_FILE_ATTRIBUTE, "true");
        const tag = ownerDocument.createElement("span");
        tag.className = "codexhost-workspace-turn-tag";
        tag.textContent = chinese ? "本轮" : "this turn";
        row.append(tag);
      }
      row.append(
        formatStats(ownerDocument, file.addedLines, file.deletedLines, "codexhost-workspace-stats"),
      );
      const previewFile = (): void => input.onPreview(file, row, rows);
      row.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        previewFile();
      });
      rows.append(row);
    }
  }
  disclosure.append(heading, rows);
  return disclosure;
}

export function fillDiffPreview(host: HTMLElement, preview: string, chinese: boolean): void {
  host.replaceChildren();
  if (preview.length === 0) {
    host.textContent = chinese ? "暂无改动预览" : "No diff preview";
    return;
  }
  const ownerDocument = host.ownerDocument;
  for (const line of preview.split("\n")) {
    const row = ownerDocument.createElement("div");
    if (line.startsWith("+") && !line.startsWith("+++")) {
      row.className = "codexhost-workspace-preview-add";
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      row.className = "codexhost-workspace-preview-del";
    } else {
      row.className = "codexhost-workspace-preview-meta";
    }
    row.textContent = line.length > 0 ? line : " ";
    host.append(row);
  }
}

/**
 * Where the hover preview goes: beside the file list, never over it. The list
 * hugs the right edge of the header, so the left side is preferred and the
 * right side is the fallback; vertically it aligns with the hovered row, stays
 * below the header (`minTop`) and above the Composer.
 */
export function previewOrigin(input: {
  anchor: { top: number };
  list: { left: number; right: number };
  size: { width: number; height: number };
  viewportWidth: number;
  composerTop: number;
  minTop?: number;
}): { left: number; top: number } {
  const leftCandidate = input.list.left - input.size.width - 8;
  const rightCandidate = input.list.right + 8;
  const left =
    leftCandidate >= 8
      ? leftCandidate
      : rightCandidate + input.size.width <= input.viewportWidth - 8
        ? rightCandidate
        : Math.max(8, leftCandidate);
  const box = clampFixedBox({
    left,
    top: Math.max(input.anchor.top, input.minTop ?? 8),
    width: input.size.width,
    height: input.size.height,
    viewportWidth: input.viewportWidth,
    maxBottom: input.composerTop,
  });
  return { left: box.left, top: Math.max(box.top, input.minTop ?? 8) };
}

interface DiffPreviewInput {
  threadId: string;
  owner: Element;
  file: ThreadConversationFile;
  row: HTMLElement;
  bounds(): { composerTop: number; minTop: number };
  chinese: boolean;
  onOpen(): void;
  restoreFocus(): void;
}

export interface DiffPreviewOverlay {
  element: HTMLElement;
  show(input: DiffPreviewInput): void;
  sync(owner: Element, threadId: string, files: readonly ThreadConversationFile[]): void;
  reposition(): void;
  hide(restoreFocus?: boolean): void;
  hideFor(owner: Element): void;
  dispose(): void;
}

/** A single explicitly opened detail, independent of transcript scroll/hover. */
export function createDiffPreviewOverlay(ownerDocument: Document): DiffPreviewOverlay {
  const preview = ownerDocument.createElement("section");
  preview.setAttribute(WORKSPACE_PREVIEW_ATTRIBUTE, "true");
  preview.setAttribute(OVERLAY_ROOT_ATTRIBUTE, "true");
  preview.setAttribute("role", "region");
  preview.hidden = true;
  const grip = ownerDocument.createElement("div");
  grip.className = "codexhost-workspace-preview-grip";
  grip.setAttribute("role", "separator");
  grip.setAttribute("aria-orientation", "vertical");
  grip.tabIndex = 0;
  const head = ownerDocument.createElement("div");
  head.className = "codexhost-workspace-preview-head";
  const body = ownerDocument.createElement("div");
  body.className = "codexhost-workspace-preview-body";
  body.tabIndex = 0;
  preview.append(grip, head, body);
  (ownerDocument.body ?? ownerDocument.documentElement).append(preview);
  const view = ownerDocument.defaultView;
  let active: DiffPreviewInput | null = null;
  let preferredWidth = 480;
  const widthKey = "codexhost.workspace-detail.width.v1";
  try {
    const stored = Number(view?.localStorage.getItem(widthKey));
    if (Number.isFinite(stored) && stored >= 280) preferredWidth = Math.min(800, stored);
  } catch {
    /* Storage may be unavailable in embedded windows. */
  }
  const reposition = (): void => {
    if (!active || preview.hidden) return;
    const bounds = active.bounds();
    const width = Math.min(preferredWidth, (view?.innerWidth ?? 800) - 16);
    const top = Math.max(8, bounds.minTop);
    preview.style.width = `${width}px`;
    preview.style.right = "8px";
    preview.style.top = `${top}px`;
    preview.style.height = `${Math.max(0, Math.min((view?.innerHeight ?? 600) - 8, bounds.composerTop - 8) - top)}px`;
    grip.setAttribute("aria-valuenow", String(Math.round(width)));
  };
  const hide = (restoreFocus = false): void => {
    const previous = active;
    active = null;
    preview.hidden = true;
    previous?.row.removeAttribute("data-previewing");
    head.replaceChildren();
    body.replaceChildren();
    if (restoreFocus) previous?.restoreFocus();
  };
  const paint = (): void => {
    if (!active) return;
    const input = active;
    const scrollTop = body.scrollTop;
    head.replaceChildren();
    const path = ownerDocument.createElement("code");
    path.textContent = input.file.path;
    path.title = input.file.path;
    const open = ownerDocument.createElement("button");
    open.type = "button";
    open.textContent = input.chinese ? "打开文件" : "Open file";
    open.addEventListener("click", () => {
      hide();
      input.onOpen();
    });
    const close = ownerDocument.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", input.chinese ? "关闭文件详情" : "Close file detail");
    close.addEventListener("click", () => hide(true));
    head.append(
      path,
      formatStats(
        ownerDocument,
        input.file.addedLines,
        input.file.deletedLines,
        "codexhost-workspace-stats",
      ),
      open,
      close,
    );
    preview.setAttribute(
      "aria-label",
      `${input.chinese ? "文件详情" : "File detail"}: ${input.file.path}`,
    );
    grip.setAttribute("aria-label", input.chinese ? "调整详情宽度" : "Resize file detail");
    fillDiffPreview(body, input.file.preview, input.chinese);
    body.scrollTop = scrollTop;
  };
  const setWidth = (width: number): void => {
    preferredWidth = Math.max(280, Math.min(800, width));
    reposition();
    try {
      view?.localStorage.setItem(widthKey, String(preferredWidth));
    } catch {
      /* Optional preference. */
    }
  };
  const drag = (event: PointerEvent): void =>
    setWidth((view?.innerWidth ?? 800) - event.clientX - 8);
  const stopDrag = (): void => {
    ownerDocument.removeEventListener("pointermove", drag);
    ownerDocument.removeEventListener("pointerup", stopDrag);
    ownerDocument.removeEventListener("pointercancel", stopDrag);
  };
  grip.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    ownerDocument.addEventListener("pointermove", drag);
    ownerDocument.addEventListener("pointerup", stopDrag);
    ownerDocument.addEventListener("pointercancel", stopDrag);
  });
  grip.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setWidth(preferredWidth + (event.key === "ArrowLeft" ? 24 : -24));
  });
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !active) return;
    event.preventDefault();
    hide(true);
  };
  ownerDocument.addEventListener("keydown", onKeyDown);
  view?.addEventListener("resize", reposition);
  return {
    element: preview,
    show(input) {
      active?.row.removeAttribute("data-previewing");
      active = input;
      input.row.setAttribute("data-previewing", "true");
      paint();
      preview.hidden = false;
      reposition();
      body.focus({ preventScroll: true });
    },
    sync(owner, threadId, files) {
      if (!active || active.owner !== owner || active.threadId !== threadId) return;
      const file = files.find((entry) => entry.path === active?.file.path);
      if (!file) {
        hide();
        return;
      }
      if (
        file.preview === active.file.preview &&
        file.addedLines === active.file.addedLines &&
        file.deletedLines === active.file.deletedLines
      )
        return;
      active = { ...active, file };
      paint();
    },
    reposition,
    hide,
    hideFor(owner) {
      if (active?.owner === owner) hide();
    },
    dispose() {
      stopDrag();
      hide();
      view?.removeEventListener("resize", reposition);
      ownerDocument.removeEventListener("keydown", onKeyDown);
      preview.remove();
    },
  };
}
