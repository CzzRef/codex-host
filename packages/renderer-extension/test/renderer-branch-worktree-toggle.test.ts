import { describe, expect, it } from "vitest";

import {
  isSwitchBranchButton,
  readBranchWorktreePreference,
  writeBranchWorktreePreference,
} from "../src/renderer-branch-worktree-toggle.js";

describe("official Switch-branch worktree preference", () => {
  it("defaults to creating a worktree and remembers an opt-out", () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };
    expect(readBranchWorktreePreference(adapter)).toBe(true);
    writeBranchWorktreePreference(adapter, false);
    expect(readBranchWorktreePreference(adapter)).toBe(false);
    writeBranchWorktreePreference(adapter, true);
    expect(readBranchWorktreePreference(adapter)).toBe(true);
  });

  it("recognizes official Switch branch buttons", () => {
    const button = {
      getAttribute: (name: string) => (name === "aria-label" ? "Switch branch main" : null),
      textContent: "main",
    } as unknown as Element;
    expect(isSwitchBranchButton(button)).toBe(true);
    expect(
      isSwitchBranchButton({
        getAttribute: () => null,
        textContent: "Send",
      } as unknown as Element),
    ).toBe(false);
  });
});
