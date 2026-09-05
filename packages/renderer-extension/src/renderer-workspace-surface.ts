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
const PREVIEW_HIDE_GRACE_MS = 120;

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
  // No native `title`: the OS tooltip only appears after about a second and is
  // unstyled, which reads as the chip being slow. The overlay tooltip below
  // opens in 120ms instead; `aria-label` keeps the same text for assistive tech.
  row.setAttribute("aria-label", `${roleLabel} ${repository.root} ${branchText}`);
  // The chip is clipped to keep the header one line, so hovering has to be able
  // to show the full root path, worktree owner and branch.
  const detail = ownerDocument.createElement("span");
  detail.className = "codexhost-overlay-tooltip codexhost-workspace-detail";
  detail.setAttribute("aria-hidden", "true");
  const lines: string[] = [roleLabel, repository.root];
  if (repository.isWorktree && owner !== display) {
    lines.push(chinese ? `${owner} 的工作树` : `${owner} worktree`);
  }
  lines.push(chinese ? `分支 ${branchText}` : `Branch ${branchText}`);
  detail.textContent = lines.join("\n");
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
  onPreviewLeave(): void;
  onOpen(file: ThreadConversationFile): void;
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
      row.addEventListener("mouseenter", previewFile);
      row.addEventListener("mouseleave", input.onPreviewLeave);
      row.addEventListener("focus", previewFile);
      row.addEventListener("blur", input.onPreviewLeave);
      row.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        input.onOpen(file);
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

export interface DiffPreviewOverlay {
  element: HTMLElement;
  show(input: {
    file: ThreadConversationFile;
    row: HTMLElement;
    list: HTMLElement | null;
    composerTop: number;
    minTop: number;
    chinese: boolean;
  }): void;
  scheduleHide(): void;
  hide(): void;
  dispose(): void;
}

/** One body-level diff preview shared by every header on the page. */
export function createDiffPreviewOverlay(ownerDocument: Document): DiffPreviewOverlay {
  const preview = ownerDocument.createElement("div");
  preview.setAttribute(WORKSPACE_PREVIEW_ATTRIBUTE, "true");
  preview.setAttribute(OVERLAY_ROOT_ATTRIBUTE, "true");
  preview.hidden = true;
  const head = ownerDocument.createElement("div");
  head.className = "codexhost-workspace-preview-head";
  const body = ownerDocument.createElement("div");
  body.className = "codexhost-workspace-preview-body";
  preview.append(head, body);
  (ownerDocument.body ?? ownerDocument.documentElement).append(preview);
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let previewingRow: HTMLElement | null = null;

  const clearTimer = (): void => {
    if (hideTimer === null) return;
    clearTimeout(hideTimer);
    hideTimer = null;
  };
  const hide = (): void => {
    clearTimer();
    preview.hidden = true;
    body.replaceChildren();
    head.replaceChildren();
    previewingRow?.removeAttribute("data-previewing");
    previewingRow = null;
  };
  const scheduleHide = (): void => {
    clearTimer();
    hideTimer = setTimeout(() => {
      hideTimer = null;
      hide();
    }, PREVIEW_HIDE_GRACE_MS);
  };
  preview.addEventListener("mouseenter", clearTimer);
  preview.addEventListener("mouseleave", scheduleHide);

  return {
    element: preview,
    show(input) {
      clearTimer();
      previewingRow?.removeAttribute("data-previewing");
      previewingRow = input.row;
      input.row.setAttribute("data-previewing", "true");
      head.replaceChildren();
      const path = ownerDocument.createElement("code");
      path.textContent = input.file.path;
      path.title = input.file.path;
      head.append(
        path,
        formatStats(
          ownerDocument,
          input.file.addedLines,
          input.file.deletedLines,
          "codexhost-workspace-stats",
        ),
      );
      fillDiffPreview(body, input.file.preview, input.chinese);
      preview.hidden = false;
      const view = ownerDocument.defaultView;
      const viewportWidth = view?.innerWidth ?? 800;
      const width = Math.min(
        560,
        Math.max(280, Math.floor(viewportWidth * 0.6)),
        viewportWidth - 24,
      );
      preview.style.width = `${width}px`;
      // Never taller than the band between the header and the Composer.
      preview.style.maxHeight = `min(420px, 50vh, ${Math.max(80, input.composerTop - input.minTop - 8)}px)`;
      const height = preview.offsetHeight || 200;
      const anchor = input.row.getBoundingClientRect();
      const list = input.list?.getBoundingClientRect() ?? null;
      const origin = previewOrigin({
        anchor: { top: anchor.top },
        list: list
          ? { left: list.left, right: list.right }
          : { left: anchor.left, right: anchor.right },
        size: { width, height },
        viewportWidth,
        composerTop: input.composerTop,
        minTop: input.minTop,
      });
      preview.style.left = `${origin.left}px`;
      preview.style.top = `${origin.top}px`;
    },
    scheduleHide,
    hide,
    dispose() {
      hide();
      preview.remove();
    },
  };
}
