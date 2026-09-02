import { describe, expect, it, vi } from "vitest";

import {
  BRANCH_WORKTREE_PREFERENCE_KEY,
  draftWorktreeModeBindingFromButton,
  findDraftWorktreeModeBinding,
  isSwitchBranchButton,
  readBranchWorktreePreference,
  writeBranchWorktreePreference,
} from "../src/renderer-branch-worktree-toggle.js";

function runLocationButton(options: {
  conversationId?: string | null;
  duplicateOwner?: boolean;
  mode?: "cloud" | "local" | "worktree";
  target?: string;
}) {
  const setComposerMode = vi.fn();
  const target = options.target ?? "run-location";
  const owner = {
    memoizedProps: {
      composerMode: options.mode ?? "local",
      setComposerMode,
      conversationId: options.conversationId ?? null,
    },
    return: null,
  };
  const duplicate = options.duplicateOwner
    ? {
        memoizedProps: {
          composerMode: "local",
          setComposerMode: vi.fn(),
          conversationId: null,
        },
        return: owner,
      }
    : owner;
  const fiber = {
    memoizedProps: {
      "data-composer-navigation-target": target,
      "aria-haspopup": "menu",
    },
    return: duplicate,
  };
  const button = {
    matches(selector: string) {
      return selector.includes('button[aria-haspopup="menu"]') && target === "run-location";
    },
  } as unknown as Element;
  Object.defineProperty(button, "__reactFiber$test", { value: fiber });
  return { button, setComposerMode };
}

describe("official Switch-branch worktree preference", () => {
  it("defaults to Local and remembers only an explicit opt-in", () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };
    expect(readBranchWorktreePreference(null)).toBe(false);
    expect(readBranchWorktreePreference(adapter)).toBe(false);
    storage.set("codexhost.switch-branch-worktree", "1");
    expect(readBranchWorktreePreference(adapter)).toBe(false);
    writeBranchWorktreePreference(adapter, true);
    expect(readBranchWorktreePreference(adapter)).toBe(true);
    writeBranchWorktreePreference(adapter, false);
    expect(readBranchWorktreePreference(adapter)).toBe(false);
    storage.set(BRANCH_WORKTREE_PREFERENCE_KEY, "yes");
    expect(readBranchWorktreePreference(adapter)).toBe(false);
    expect(
      readBranchWorktreePreference({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).toBe(false);
  });

  it("recognizes only semantic Switch branch labels, not descendant text", () => {
    const button = {
      getAttribute: (name: string) => (name === "aria-label" ? "Switch branch main" : null),
      textContent: "main",
    } as unknown as Element;
    expect(isSwitchBranchButton(button)).toBe(true);
    expect(
      isSwitchBranchButton({
        getAttribute: () => null,
        textContent: "terminal output mentioning Switch branch",
      } as unknown as Element),
    ).toBe(false);
  });

  it("binds a new-chat run-location control to the official Composer mode setter", () => {
    const { button, setComposerMode } = runLocationButton({ mode: "local" });
    const binding = draftWorktreeModeBindingFromButton(button);
    expect(binding?.mode).toBe("local");
    binding?.setMode("worktree");
    expect(setComposerMode).toHaveBeenCalledWith("worktree");
    expect(
      findDraftWorktreeModeBinding({
        querySelectorAll: () => [button],
      } as unknown as ParentNode)?.mode,
    ).toBe("local");
  });

  it("fails closed for an existing Thread, unsupported mode, or ambiguous owner", () => {
    expect(
      draftWorktreeModeBindingFromButton(runLocationButton({ conversationId: "thread-1" }).button),
    ).toBeNull();
    expect(
      draftWorktreeModeBindingFromButton(runLocationButton({ mode: "cloud" }).button),
    ).toBeNull();
    expect(
      draftWorktreeModeBindingFromButton(runLocationButton({ duplicateOwner: true }).button),
    ).toBeNull();
    expect(
      draftWorktreeModeBindingFromButton(runLocationButton({ target: "reasoning" }).button),
    ).toBeNull();
  });
});
