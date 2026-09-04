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
  view: { root: HTMLElement; workspace: HTMLElement; core: HTMLElement };
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
 * Paints the Turn header's workspace row from the files state: core chip,
 * touched roots behind `+N`, the file disclosure opening downward, and the
 * diff preview beside it. The header decides when to paint and where the
 * Composer is.
 */
export function createWorkspaceRowPainter(options: {
  ownerDocument: Document;
  filesState: WorkspaceFilesState;
  preview: DiffPreviewOverlay;
  chinese(): boolean;
  scheduleFrame(): void;
  syncNativeDiffVisibility(): void;
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
        chinese,
        [...currentTurnPaths].join("\n"),
      ].join("|");
      if (signature === state.lastWorkspace) return;
      state.lastWorkspace = signature;
      preview.hide();
      const grouped = groupConversationFilesByRepository(snapshot, files);
      if (grouped.unresolved.length > 0) {
        filesState.requestExtraPaths(state.threadId, grouped.unresolved);
      }
      // Without changed files the workspace is one short chip: it rides in the
      // Turn row so the header stays a single line, which is the whole point of
      // "collapse to one row and expand on demand".
      const compact = files.length === 0;
      const host = compact ? state.view.core : state.view.workspace;
      state.view.workspace.replaceChildren();
      state.view.core.replaceChildren();
      state.view.core.hidden = true;
      if (grouped.groups.length === 0 && files.length === 0) {
        state.view.workspace.setAttribute(TURN_HEADER_WORKSPACE_ATTRIBUTE, "empty");
        options.syncNativeDiffVisibility();
        return;
      }
      state.view.workspace.setAttribute(
        TURN_HEADER_WORKSPACE_ATTRIBUTE,
        compact ? "empty" : "files",
      );
      state.view.core.hidden = !compact;
      const chips = renderWorkspaceChips(ownerDocument, grouped.groups, chinese);
      host.append(chips);
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
            onPreview: (file, row, list) => {
              preview.show({
                file,
                row,
                list,
                composerTop: state.composer.getBoundingClientRect().top,
                minTop: state.view.root.getBoundingClientRect().bottom + PREVIEW_GAP,
                chinese,
              });
            },
            onPreviewLeave: () => preview.scheduleHide(),
            onOpen: (file) => {
              preview.hide();
              openConversationFile(ownerDocument, file);
            },
          }),
        );
      }
      fitWorkspaceChips(chips);
      const list = host.querySelector<HTMLElement>(".codexhost-workspace-files-list");
      if (list) {
        const room = Math.max(
          80,
          state.composer.getBoundingClientRect().top - bounds.headerBottom - 24,
        );
        list.style.maxHeight = `min(300px, 42vh, ${Math.round(room)}px)`;
      }
      options.syncNativeDiffVisibility();
    },
    collapse(state) {
      for (const host of [state.view.workspace, state.view.core]) {
        for (const more of host.querySelectorAll(`[${WORKSPACE_MORE_ATTRIBUTE}]`)) {
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
