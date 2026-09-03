import { describe, expect, it } from "vitest";

import {
  hostThreadIdSchema,
  threadWorkspaceInspectParamsSchema,
  threadWorkspaceSnapshotSchema,
} from "@codexhost/shared-contracts";

const threadId = hostThreadIdSchema.parse("thread-workspace");

function repository(overrides: Record<string, unknown> = {}) {
  return {
    root: "/workspace/app",
    name: "app",
    kind: "primary" as const,
    branch: "main",
    headSha: "abc1234",
    isWorktree: false,
    worktreeName: null,
    primaryRoot: "/workspace/app",
    addedLines: 0,
    deletedLines: 0,
    dirty: false,
    ...overrides,
  };
}

describe("thread workspace snapshot", () => {
  it("accepts an empty snapshot when cwd is unknown", () => {
    expect(
      threadWorkspaceSnapshotSchema.parse({
        threadId,
        cwd: null,
        repositories: [],
      }),
    ).toEqual({ threadId, cwd: null, repositories: [] });
  });

  it("accepts a primary repository plus a submodule list", () => {
    const snapshot = threadWorkspaceSnapshotSchema.parse({
      threadId,
      cwd: "/workspace/app",
      repositories: [
        repository(),
        repository({
          root: "/workspace/app/vendor",
          name: "vendor",
          kind: "submodule",
          branch: "lib",
          addedLines: 4,
          deletedLines: 1,
          dirty: true,
        }),
      ],
    });
    expect(snapshot.repositories.map((entry) => entry.kind)).toEqual(["primary", "submodule"]);
    expect(snapshot.repositories[1]?.dirty).toBe(true);
  });

  it("accepts sibling worktrees and additional repository roots", () => {
    const snapshot = threadWorkspaceSnapshotSchema.parse({
      threadId,
      cwd: "/workspace/app-feature",
      repositories: [
        repository({
          root: "/workspace/app-feature",
          name: "app-feature",
          branch: "feature",
          isWorktree: true,
          worktreeName: "app-feature",
          primaryRoot: "/workspace/app",
        }),
        repository({
          root: "/workspace/app",
          name: "app",
          kind: "worktree",
          branch: "main",
          isWorktree: false,
          worktreeName: null,
          primaryRoot: "/workspace/app",
        }),
        repository({
          root: "/workspace/other",
          name: "other",
          kind: "additional",
          branch: "dev",
        }),
      ],
    });
    expect(snapshot.repositories.map((entry) => entry.kind)).toEqual([
      "primary",
      "worktree",
      "additional",
    ]);
  });

  it("accepts a linked worktree identity", () => {
    expect(
      threadWorkspaceSnapshotSchema.parse({
        threadId,
        cwd: "/workspace/app-feature",
        repositories: [
          repository({
            root: "/workspace/app-feature",
            name: "app-feature",
            branch: "feature",
            isWorktree: true,
            worktreeName: "app-feature",
            primaryRoot: "/workspace/app",
          }),
        ],
      }),
    ).toMatchObject({
      repositories: [
        { isWorktree: true, worktreeName: "app-feature", primaryRoot: "/workspace/app" },
      ],
    });
  });

  it("accepts external roots resolved from extra conversation paths", () => {
    expect(
      threadWorkspaceInspectParamsSchema.parse({
        threadId,
        extraPaths: ["/notes/CodeNote/README.md"],
      }),
    ).toEqual({ threadId, extraPaths: ["/notes/CodeNote/README.md"] });
    expect(threadWorkspaceInspectParamsSchema.parse({ threadId })).toEqual({ threadId });
    expect(() =>
      threadWorkspaceInspectParamsSchema.parse({ threadId, extraPaths: [" "] }),
    ).toThrow();
    const snapshot = threadWorkspaceSnapshotSchema.parse({
      threadId,
      cwd: "/workspace/app",
      repositories: [
        repository(),
        repository({
          root: "/notes/CodeNote",
          name: "CodeNote",
          kind: "external",
          branch: "main",
          primaryRoot: "/notes/CodeNote",
        }),
      ],
    });
    expect(snapshot.repositories[1]?.kind).toBe("external");
  });

  it("rejects a worktree without a name and a list without a primary root", () => {
    expect(() =>
      threadWorkspaceSnapshotSchema.parse({
        threadId,
        cwd: "/workspace/app",
        repositories: [repository({ isWorktree: true, worktreeName: null })],
      }),
    ).toThrow();
    expect(() =>
      threadWorkspaceSnapshotSchema.parse({
        threadId,
        cwd: "/workspace/app",
        repositories: [repository({ kind: "submodule" })],
      }),
    ).toThrow();
  });
});
