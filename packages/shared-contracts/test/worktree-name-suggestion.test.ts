import { describe, expect, it } from "vitest";

import {
  WORKSPACE_WORKTREE_NAME_PATTERN,
  suggestWorkspaceWorktreeName,
} from "../src/workspace-worktree.js";

// 2026-09-05 10:16 UTC = 18:16 GMT+8.
const now = new Date("2026-09-05T10:16:00.000Z");

describe("worktree name suggestion", () => {
  it("derives the functional core from what the user already typed", () => {
    expect(suggestWorkspaceWorktreeName({ hint: "Fix the draft worktree picker", now })).toBe(
      "260905-fix-the-draft-worktree-picke",
    );
    expect(suggestWorkspaceWorktreeName({ hint: "  Add   Cursor bypass!  ", now })).toBe(
      "260905-add-cursor-bypass",
    );
  });

  it("falls back to the GMT+8 time when the prompt has no ASCII words", () => {
    // A Chinese prompt cannot produce a readable slug; the time still says when.
    expect(suggestWorkspaceWorktreeName({ hint: "核验一下当前有没有新建新分支", now })).toBe(
      "260905-wt-1816",
    );
    expect(suggestWorkspaceWorktreeName({ now })).toBe("260905-wt-1816");
  });

  it("keeps the Host's date prefix when it sent one", () => {
    expect(suggestWorkspaceWorktreeName({ hint: "cursor bypass", prefix: "260101-", now })).toBe(
      "260101-cursor-bypass",
    );
    // A malformed prefix is ignored rather than trusted.
    expect(suggestWorkspaceWorktreeName({ hint: "cursor bypass", prefix: "nope", now })).toBe(
      "260905-cursor-bypass",
    );
  });

  it("disambiguates against worktrees that already exist", () => {
    const taken = ["260905-cursor-bypass", "260905-cursor-bypass-2"];
    expect(suggestWorkspaceWorktreeName({ hint: "cursor bypass", taken, now })).toBe(
      "260905-cursor-bypass-3",
    );
  });

  it("always produces a name the Host will accept", () => {
    for (const hint of ["", "!!!", "a", "核验", "Fix the draft worktree picker", "UPPER CASE"]) {
      expect(suggestWorkspaceWorktreeName({ hint, now })).toMatch(WORKSPACE_WORKTREE_NAME_PATTERN);
    }
  });
});
