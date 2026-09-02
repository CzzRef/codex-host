import { describe, expect, it } from "vitest";

import {
  conversationFilesFromNotification,
  diffLineStats,
  diffPreview,
  filesForTurnSelection,
  mergeConversationFiles,
  reviewPathMatches,
  turnKeyMatches,
} from "../src/renderer-conversation-files.js";
import {
  isNativeWorkspaceDiffControl,
  repositoryDisplayName,
  threadIdForComposer,
  worktreeLabel,
} from "../src/renderer-workspace-bar.js";
import {
  overlayTopAboveComposer,
  rectsOverlap,
  turnActionOrigin,
} from "../src/renderer-overlay-layout.js";
import { turnActionCopy, turnsAfterKey } from "../src/renderer-turn-actions.js";

function element(attributes: Record<string, string>, children: Element[] = []): Element {
  return {
    children,
    hasAttribute(name: string) {
      return Object.prototype.hasOwnProperty.call(attributes, name);
    },
    getAttribute(name: string) {
      return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null;
    },
  } as unknown as Element;
}

describe("Renderer workspace bar helpers", () => {
  it("reads the Composer portal Thread ID", () => {
    const portal = element({
      "data-above-composer-portal": "true",
      "data-above-composer-conversation-id": "thread-workspace",
    });
    const composer = element({}, [portal]);
    expect(threadIdForComposer(composer)).toBe("thread-workspace");
  });

  it("hides without a Composer Thread identity", () => {
    const portal = element({ "data-above-composer-portal": "true" });
    const composer = element({}, [portal]);
    expect(threadIdForComposer(composer)).toBeNull();
  });

  it("labels a linked worktree in English and Chinese", () => {
    const repository = {
      root: "/workspace/app-feature",
      name: "app-feature",
      kind: "primary" as const,
      branch: "feature",
      headSha: "abc1234",
      isWorktree: true,
      worktreeName: "app-feature",
      primaryRoot: "/workspace/app",
      addedLines: 1,
      deletedLines: 0,
      dirty: true,
    };
    expect(repositoryDisplayName(repository)).toBe("app");
    expect(worktreeLabel(repository, false)).toBe("wt app-feature");
    expect(worktreeLabel(repository, true)).toBe("工作树 app-feature");
    expect(worktreeLabel({ ...repository, isWorktree: false, worktreeName: null }, false)).toBe("");
    expect(worktreeLabel({ ...repository, kind: "worktree", worktreeName: "feature" }, false)).toBe(
      "",
    );
  });

  it("recognizes the official Changes and Review controls", () => {
    expect(
      isNativeWorkspaceDiffControl(
        element({
          "data-slot": "thread-summary-panel-item-button",
        }),
      ),
    ).toBe(false);
    const changes = element({ "data-slot": "thread-summary-panel-item-button" });
    Object.defineProperty(changes, "textContent", { value: "Changes +344 -37" });
    expect(isNativeWorkspaceDiffControl(changes)).toBe(true);
    expect(isNativeWorkspaceDiffControl(element({ "data-tab-id": "diff" }))).toBe(true);
    expect(isNativeWorkspaceDiffControl(element({ "aria-label": "Open review tab" }))).toBe(true);
    expect(
      isNativeWorkspaceDiffControl(element({ "data-slot": "thread-summary-panel-item-button" })),
    ).toBe(false);
  });
});

describe("conversation file-change notifications", () => {
  it("counts added and deleted lines and merges by path", () => {
    expect(diffLineStats("--- a/x\n+++ b/x\n@@\n-old\n+new\n+newer\n")).toEqual({
      addedLines: 2,
      deletedLines: 1,
    });
    const parsed = conversationFilesFromNotification({
      method: "item/fileChange/patchUpdated",
      params: {
        threadId: "thread-workspace",
        changes: [{ path: "src/a.ts", diff: "+one\n-two\n" }],
      },
    });
    expect(parsed?.turnId).toBeNull();
    expect(parsed?.files).toEqual([
      { path: "src/a.ts", addedLines: 1, deletedLines: 1, preview: "+one\n-two" },
    ]);
    expect(turnKeyMatches("history-content:turn:abc", "abc")).toBe(true);
    expect(turnKeyMatches("history-content:tail:0:local:abc", "local:abc")).toBe(true);
    expect(turnKeyMatches("turn-a", "turn-b")).toBe(false);
    const byTurn = new Map([["abc", parsed?.files ?? []]]);
    expect(
      filesForTurnSelection(byTurn, "history-content:turn:abc")?.map((file) => file.path),
    ).toEqual(["src/a.ts"]);
    expect(filesForTurnSelection(byTurn, null)).toBeNull();
    expect(filesForTurnSelection(byTurn, "missing")).toEqual([]);
    expect(turnsAfterKey(["a", "b", "c"], "b")).toBe(1);
    expect(turnsAfterKey(["history-content:turn:abc"], "abc")).toBe(0);
    expect(turnActionCopy({ chinese: true, rolledBack: false, laterTurns: 2 }).editTitle).toContain(
      "先回滚",
    );
    expect(
      turnActionCopy({ chinese: true, rolledBack: false, laterTurns: 2 }).editConfirm,
    ).toContain("确定继续");
    expect(turnActionCopy({ chinese: true, rolledBack: true, laterTurns: 0 }).editTitle).toContain(
      "已回滚",
    );
    expect(turnActionCopy({ chinese: false, rolledBack: true, laterTurns: 0 }).redoLabel).toBe(
      "Redo",
    );
    expect(turnActionCopy({ chinese: true, rolledBack: false, laterTurns: 2 }).rollbackLabel).toBe(
      "回滚",
    );
    expect(
      turnActionCopy({ chinese: true, rolledBack: false, laterTurns: 2 }).rollbackConfirmAction,
    ).toBe("确认回滚");
    expect(overlayTopAboveComposer(400, 80, 8)).toBe(312);
    expect(
      turnActionOrigin({
        turn: { left: 40, top: 80, right: 520 },
        size: { width: 180, height: 32 },
        composerTop: 640,
        viewportWidth: 900,
      }),
    ).toEqual({ left: 332, top: 88 });
    expect(
      turnActionOrigin({
        turn: { left: 40, top: 80, right: 520 },
        size: { width: 180, height: 32 },
        composerTop: 640,
        viewportWidth: 900,
        avoid: { left: 400, top: 80, right: 520, bottom: 110 },
      }),
    ).toEqual({ left: 212, top: 88 });
    expect(
      rectsOverlap(
        { left: 0, top: 0, width: 10, height: 10 },
        { left: 8, top: 8, width: 10, height: 10 },
      ),
    ).toBe(true);
    expect(
      rectsOverlap(
        { left: 0, top: 0, width: 10, height: 10 },
        { left: 20, top: 20, width: 10, height: 10 },
      ),
    ).toBe(false);
    expect(diffPreview("diff --git a/x b/x\n+keep\n")).toBe("+keep");
    expect(reviewPathMatches("/workspace/app/src/a.ts", "src/a.ts")).toBe(true);
    expect(reviewPathMatches("/workspace/app/src/a.ts", "src/b.ts")).toBe(false);
    expect(
      mergeConversationFiles(parsed?.files ?? [], [
        { path: "src/b.ts", addedLines: 3, deletedLines: 0, preview: "" },
      ]).map((file) => file.path),
    ).toEqual(["src/a.ts", "src/b.ts"]);
  });
});
