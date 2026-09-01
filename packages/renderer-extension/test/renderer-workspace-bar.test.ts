import { describe, expect, it } from "vitest";

import {
  conversationFilesFromNotification,
  diffLineStats,
  mergeConversationFiles,
} from "../src/renderer-conversation-files.js";
import { threadIdForComposer, worktreeLabel } from "../src/renderer-workspace-bar.js";

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
    expect(worktreeLabel(repository, false)).toBe("wt app-feature");
    expect(worktreeLabel(repository, true)).toBe("工作树 app-feature");
    expect(worktreeLabel({ ...repository, isWorktree: false, worktreeName: null }, false)).toBe("");
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
    expect(parsed?.files).toEqual([{ path: "src/a.ts", addedLines: 1, deletedLines: 1 }]);
    expect(
      mergeConversationFiles(parsed?.files ?? [], [
        { path: "src/b.ts", addedLines: 3, deletedLines: 0 },
      ]).map((file) => file.path),
    ).toEqual(["src/a.ts", "src/b.ts"]);
  });
});
