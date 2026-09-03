import { describe, expect, it } from "vitest";

import { rollbackSupportFor, turnActionCopy, turnsAfterKey } from "../src/renderer-turn-actions.js";

describe("Turn action copy and capability bits", () => {
  it("counts later Turns by fuzzy key and words every action honestly", () => {
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
    // Redo is thread-level: only a Host slot enables it, never a local rollback flag.
    expect(turnActionCopy({ chinese: true, rolledBack: true, laterTurns: 0 }).redoDisabled).toBe(
      true,
    );
    expect(
      turnActionCopy({ chinese: true, rolledBack: false, laterTurns: 0, redoAvailable: true }),
    ).toMatchObject({ redoDisabled: false, redoTitle: "恢复刚回滚掉的对话" });
    expect(
      turnActionCopy({ chinese: false, rolledBack: false, laterTurns: 0, redoAvailable: false })
        .redoTitle,
    ).toContain("after a rollback");
    // Edit confirms only when there is something to roll back first.
    expect(turnActionCopy({ chinese: true, rolledBack: false, laterTurns: 0 })).toMatchObject({
      editNeedsConfirm: false,
      editTitle: "这是最后一轮，直接编辑提示",
    });
    expect(
      turnActionCopy({ chinese: false, rolledBack: false, laterTurns: 3 }).editNeedsConfirm,
    ).toBe(true);
    expect(turnActionCopy({ chinese: true, rolledBack: false, laterTurns: 2 }).rollbackLabel).toBe(
      "回滚",
    );
    expect(
      turnActionCopy({ chinese: true, rolledBack: false, laterTurns: 2 }).rollbackConfirmAction,
    ).toBe("确认回滚");
    // Copy never promises to rewrite files; rollback is conversation-only.
    expect(
      turnActionCopy({ chinese: true, rolledBack: false, laterTurns: 2 }).rollbackConfirm,
    ).not.toContain("还原");
    expect(
      turnActionCopy({ chinese: false, rolledBack: false, laterTurns: 2 }).rollbackTitle,
    ).toContain("files are not rewritten");
  });

  it("disables rollback with a reason from the Host bits instead of a late -32076", () => {
    expect(rollbackSupportFor(null)).toBe("full");
    expect(rollbackSupportFor({ lastTurn: true, multiTurn: true })).toBe("full");
    expect(rollbackSupportFor({ lastTurn: true, multiTurn: false })).toBe("lastTurnOnly");
    expect(rollbackSupportFor({ lastTurn: false, multiTurn: false })).toBe("none");
    expect(
      turnActionCopy({
        chinese: true,
        rolledBack: false,
        laterTurns: 2,
        rollbackSupport: "lastTurnOnly",
      }),
    ).toMatchObject({
      rollbackDisabled: true,
      rollbackUnsupported: true,
      editNeedsConfirm: false,
      rollbackTitle: "此线程只能回滚最后一轮，选中轮次之后还有 2 轮",
    });
    expect(
      turnActionCopy({
        chinese: true,
        rolledBack: false,
        laterTurns: 1,
        rollbackSupport: "lastTurnOnly",
      }),
    ).toMatchObject({
      rollbackDisabled: false,
      rollbackUnsupported: false,
      editNeedsConfirm: true,
    });
    expect(
      turnActionCopy({ chinese: false, rolledBack: false, laterTurns: 1, rollbackSupport: "none" }),
    ).toMatchObject({
      rollbackDisabled: true,
      rollbackTitle: "This Thread's Harness does not support rollback",
      editTitle: expect.stringContaining("places this turn's prompt in the Composer"),
    });
  });
});

describe("Turn DOM helpers", () => {
  it("never mistakes a codexhost chip for a native control", async () => {
    const { nativeTurnButton } = await import("../src/renderer-turn-actions.js");
    const button = (label: string, insideOverlay: boolean) => ({
      closest: () => (insideOverlay ? {} : null),
      getAttribute: (name: string) => (name === "aria-label" ? label : null),
      textContent: "",
    });
    const scope = {
      querySelectorAll: () => [button("Redo", true), button("Redo", false)],
    } as unknown as Element;
    const found = nativeTurnButton(scope, /^redo$/i);
    expect(found).not.toBeNull();
    expect(found?.closest("x")).toBeNull();
    const onlyOverlay = { querySelectorAll: () => [button("Redo", true)] } as unknown as Element;
    expect(nativeTurnButton(onlyOverlay, /^redo$/i)).toBeNull();
  });

  it("finds the prompt bubble behind single-child wrappers", async () => {
    const { turnPromptElement } = await import("../src/renderer-turn-actions.js");
    const bubble = { children: [], firstElementChild: null, matches: () => false };
    const wrapper = { children: [bubble], firstElementChild: bubble, matches: () => false };
    const turn = {
      querySelector: () => null,
      firstElementChild: wrapper,
    } as unknown as Element;
    expect(turnPromptElement(turn)).toBe(bubble);
    const marked = { children: [] };
    const markedTurn = {
      querySelector: () => marked,
      firstElementChild: wrapper,
    } as unknown as Element;
    expect(turnPromptElement(markedTurn)).toBe(marked);
  });
});
