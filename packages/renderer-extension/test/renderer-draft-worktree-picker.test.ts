import { describe, expect, it, vi } from "vitest";

import {
  BRANCH_WORKTREE_PREFERENCE_KEY,
  DRAFT_WORKTREE_PREFERENCE_KEY,
  draftWorktreeChipLabel,
  draftWorktreeModeBindingFromButton,
  findDraftWorktreeModeBinding,
  isSwitchBranchButton,
  pickerCopy,
  projectRootFromProps,
  readDraftWorktreePreference,
  selectionsEqual,
  writeDraftWorktreePreference,
} from "../src/renderer-draft-worktree-picker.js";

function runLocationButton(options: {
  conversationId?: string | null;
  duplicateOwner?: boolean;
  mode?: "cloud" | "local" | "worktree";
  target?: string;
  ownerProps?: Record<string, unknown>;
}) {
  const setComposerMode = vi.fn();
  const target = options.target ?? "run-location";
  const owner = {
    memoizedProps: {
      composerMode: options.mode ?? "local",
      setComposerMode,
      conversationId: options.conversationId ?? null,
      ...options.ownerProps,
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

function storageAdapter() {
  const storage = new Map<string, string>();
  return {
    storage,
    adapter: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    },
  };
}

describe("draft worktree picker preference", () => {
  it("remembers only the last pick and reads the retired checkbox opt-in once", () => {
    const { storage, adapter } = storageAdapter();
    expect(readDraftWorktreePreference(null)).toBeNull();
    expect(readDraftWorktreePreference(adapter)).toBeNull();
    storage.set(BRANCH_WORKTREE_PREFERENCE_KEY, "1");
    expect(readDraftWorktreePreference(adapter)).toEqual({ kind: "desktop" });
    writeDraftWorktreePreference(adapter, {
      kind: "worktree",
      root: "/repo-worktrees/codex/260903-picker",
      name: "260903-picker",
    });
    expect(readDraftWorktreePreference(adapter)).toEqual({
      kind: "worktree",
      root: "/repo-worktrees/codex/260903-picker",
      name: "260903-picker",
    });
    storage.set(DRAFT_WORKTREE_PREFERENCE_KEY, '{"kind":"worktree","root":"relative"}');
    expect(readDraftWorktreePreference(adapter)).toBeNull();
    storage.set(DRAFT_WORKTREE_PREFERENCE_KEY, "not json");
    expect(readDraftWorktreePreference(adapter)).toBeNull();
    expect(
      readDraftWorktreePreference({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).toBeNull();
  });

  it("compares selections by kind and worktree root", () => {
    expect(selectionsEqual({ kind: "local" }, { kind: "local" })).toBe(true);
    expect(selectionsEqual({ kind: "local" }, { kind: "desktop" })).toBe(false);
    expect(
      selectionsEqual(
        { kind: "worktree", root: "/a", name: "a" },
        { kind: "worktree", root: "/a", name: "renamed" },
      ),
    ).toBe(true);
    expect(
      selectionsEqual(
        { kind: "worktree", root: "/a", name: "a" },
        { kind: "worktree", root: "/b", name: "a" },
      ),
    ).toBe(false);
    expect(selectionsEqual(null, { kind: "local" })).toBe(false);
  });

  it("labels the chip with the pick, not the Desktop mode", () => {
    const zh = pickerCopy(true);
    const en = pickerCopy(false);
    expect(draftWorktreeChipLabel({ kind: "local" }, zh)).toBe("本地");
    expect(draftWorktreeChipLabel({ kind: "desktop" }, en)).toBe("Temporary worktree");
    expect(
      draftWorktreeChipLabel({ kind: "worktree", root: "/x/260903-picker", name: "260903-picker" }, zh),
    ).toBe("260903-picker");
  });
});

describe("draft run-location binding", () => {
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
    expect(binding?.projectRoot).toBeNull();
    binding?.setMode("worktree");
    expect(setComposerMode).toHaveBeenCalledWith("worktree");
    expect(
      findDraftWorktreeModeBinding({
        querySelectorAll: () => [button],
      } as unknown as ParentNode)?.mode,
    ).toBe("local");
  });

  it("reads the draft project root from the same React owner when Desktop exposes it", () => {
    const { button } = runLocationButton({ ownerProps: { cwd: "/Users/me/repo" } });
    expect(draftWorktreeModeBindingFromButton(button)?.projectRoot).toBe("/Users/me/repo");
    expect(projectRootFromProps({ project: { path: "C:\\work\\repo" } })).toBe("C:\\work\\repo");
    expect(projectRootFromProps({ cwd: "relative/path", projectRoot: 42 })).toBeNull();
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
