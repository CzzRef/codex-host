import {
  groupConversationFilesByRepository,
  snapshotSignature,
} from "./renderer-conversation-files.js";
import { openConversationFile } from "./renderer-native-diff-controls.js";
import { TURN_HEADER_WORKSPACE_ATTRIBUTE } from "./renderer-turn-header-row.js";
import type { WorkspaceFilesState } from "./renderer-workspace-files-state.js";
import {
  WORKSPACE_MORE_ATTRIBUTE,
  fitWorkspaceChips,
  renderFileDisclosure,
  renderWorkspaceChips,
  type DiffPreviewOverlay,
} from "./renderer-workspace-surface.js";

const PREVIEW_GAP = 8;

/** The slice of a header's state the workspace row reads and writes. */
export interface WorkspaceRowState {
  threadId: string;
  composer: Element;
  view: { root: HTMLElement; workspace: HTMLElement };
  currentKey: string | null;
  filesExpanded: boolean;
  lastWorkspace: string;
}

export interface WorkspaceRowPainter {
  /** Repaints the row when its inputs changed; cheap otherwise. */
  paint(state: WorkspaceRowState, bounds: { headerBottom: number }): void;
  /** Closes the `+N` list and the file disclosure. */
  collapse(state: WorkspaceRowState): void;
}

/**
 * Paints the independent Composer workspace dock: core identity, touched roots
 * behind `+N`, an upward file list and explicitly opened file detail. The turn
 * header owns the shared lifecycle and supplies layout bounds.
 */
export function createWorkspaceRowPainter(options: {
  ownerDocument: Document;
  filesState: WorkspaceFilesState;
  preview: DiffPreviewOverlay;
  chinese(): boolean;
  scheduleFrame(): void;
  syncNativeDiffVisibility(): void;
  openWorkspacePicker?(input: {
    projectRoot: string;
    anchor: HTMLElement;
    composer: Element;
    threadId: string;
  }): void;
}): WorkspaceRowPainter {
  const { ownerDocument, filesState, preview } = options;
  return {
    paint(state, bounds) {
      const snapshot = filesState.snapshot(state.threadId);
      const files = filesState.files(state.threadId);
      const currentTurnPaths = filesState.turnFilePaths(state.threadId, state.currentKey);
      const chinese = options.chinese();
      const signature = [
        snapshotSignature(snapshot, files, null),
        state.filesExpanded,
        state.view.workspace.clientWidth,
        chinese,
        [...currentTurnPaths].join("\n"),
      ].join("|");
      if (signature === state.lastWorkspace) return;
      state.lastWorkspace = signature;
      preview.sync(state.composer, state.threadId, files);
      const grouped = groupConversationFilesByRepository(snapshot, files);
      if (grouped.unresolved.length > 0) {
        filesState.requestExtraPaths(state.threadId, grouped.unresolved);
      }
      const host = state.view.workspace;
      const expandedRoots = new Set(
        [
          ...host.querySelectorAll<HTMLElement>(
            '[data-codexhost-workspace-row][aria-expanded="true"]',
          ),
        ].map((entry) => entry.getAttribute("data-codexhost-workspace-root")),
      );
      const moreExpanded =
        host.querySelector(`[${WORKSPACE_MORE_ATTRIBUTE}]`)?.getAttribute("aria-expanded") ===
        "true";
      const previousManage = host.querySelector<HTMLButtonElement>(
        "[data-codexhost-workspace-manage]",
      );
      const focusedFile = host.contains(ownerDocument.activeElement)
        ? (ownerDocument.activeElement?.getAttribute("data-codexhost-workspace-file") ?? null)
        : null;
      host.replaceChildren();
      host.setAttribute(TURN_HEADER_WORKSPACE_ATTRIBUTE, "ready");
      if (grouped.groups.length === 0 && files.length === 0) {
        host.textContent = chinese ? "工作区信息暂不可用" : "Workspace information unavailable";
        options.syncNativeDiffVisibility();
        return;
      }
      const chips = renderWorkspaceChips(ownerDocument, grouped.groups, chinese);
      host.append(chips);
      const core = grouped.groups.find((group) => group.core)?.repository;
      if (core && options.openWorkspacePicker) {
        const manage = previousManage ?? ownerDocument.createElement("button");
        manage.type = "button";
        manage.className = "codexhost-workspace-manage";
        manage.setAttribute("data-codexhost-workspace-manage", "true");
        manage.textContent = chinese ? "工作树 ▾" : "Worktrees ▾";
        manage.setAttribute("aria-haspopup", "menu");
        manage.title = chinese ? "管理工作树" : "Manage worktrees";
        if (!previousManage) manage.setAttribute("aria-expanded", "false");
        manage.onclick = () =>
          options.openWorkspacePicker?.({
            projectRoot: core.primaryRoot ?? core.root,
            anchor: manage,
            composer: state.composer,
            threadId: state.threadId,
          });
        host.append(manage);
      }
      if (files.length > 0) {
        host.append(
          renderFileDisclosure({
            ownerDocument,
            snapshot,
            files,
            currentTurnPaths,
            expanded: state.filesExpanded,
            chinese,
            onToggle: () => {
              state.filesExpanded = !state.filesExpanded;
              state.lastWorkspace = "";
              options.scheduleFrame();
            },
            onPreview: (file, row) => {
              preview.show({
                file,
                row,
                threadId: state.threadId,
                owner: state.composer,
                bounds: () => ({
                  composerTop: state.view.workspace.getBoundingClientRect().top,
                  minTop: state.view.root.getBoundingClientRect().bottom + PREVIEW_GAP,
                }),
                onOpen: () => openConversationFile(ownerDocument, file),
                restoreFocus: () => {
                  const target = [
                    ...host.querySelectorAll<HTMLElement>("[data-codexhost-workspace-file]"),
                  ].find(
                    (entry) => entry.getAttribute("data-codexhost-workspace-file") === file.path,
                  );
                  (target ?? host.querySelector<HTMLElement>("button"))?.focus({
                    preventScroll: true,
                  });
                },
                chinese,
              });
            },
          }),
        );
      }
      fitWorkspaceChips(chips);
      for (const entry of host.querySelectorAll<HTMLElement>("[data-codexhost-workspace-row]")) {
        if (expandedRoots.has(entry.getAttribute("data-codexhost-workspace-root"))) {
          entry.setAttribute("aria-expanded", "true");
          entry.querySelector(".codexhost-workspace-detail")?.setAttribute("aria-hidden", "false");
        }
      }
      if (moreExpanded)
        host.querySelector(`[${WORKSPACE_MORE_ATTRIBUTE}]`)?.setAttribute("aria-expanded", "true");
      const list = host.querySelector<HTMLElement>(".codexhost-workspace-files-list");
      if (list) {
        const room = Math.max(
          80,
          state.composer.getBoundingClientRect().top - bounds.headerBottom - 24,
        );
        list.style.maxHeight = `min(300px, 42vh, ${Math.round(room)}px)`;
      }
      if (focusedFile !== null) {
        [...host.querySelectorAll<HTMLElement>("[data-codexhost-workspace-file]")]
          .find((entry) => entry.getAttribute("data-codexhost-workspace-file") === focusedFile)
          ?.focus({ preventScroll: true });
      }
      options.syncNativeDiffVisibility();
    },
    collapse(state) {
      for (const host of [state.view.workspace]) {
        for (const more of host.querySelectorAll(
          `[${WORKSPACE_MORE_ATTRIBUTE}], [data-codexhost-workspace-row]`,
        )) {
          more.setAttribute("aria-expanded", "false");
        }
      }
      if (!state.filesExpanded) return;
      state.filesExpanded = false;
      state.lastWorkspace = "";
      options.scheduleFrame();
    },
  };
}
