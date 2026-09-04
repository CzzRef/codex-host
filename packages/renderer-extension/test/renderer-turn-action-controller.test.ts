import { describe, expect, it, vi } from "vitest";

import type { RendererModelClient } from "../src/renderer-model-client.js";
import { createTurnActionController } from "../src/renderer-turn-action-controller.js";

type FakeButton = { clicked: number; click(): void };

function fakeButton(label: string): FakeButton & Record<string, unknown> {
  const button = {
    clicked: 0,
    click() {
      button.clicked += 1;
    },
    closest: () => null,
    getAttribute: (name: string) => (name === "aria-label" ? label : null),
    textContent: "",
  };
  return button;
}

function fakeTurn(prompt: string, buttons: unknown[] = []): Element {
  const promptNode = { textContent: prompt };
  return {
    querySelectorAll: () => buttons,
    querySelector: () => null,
    cloneNode: () => ({
      querySelectorAll: () => [],
      querySelector: () => promptNode,
      firstElementChild: null,
      textContent: prompt,
    }),
  } as unknown as Element;
}

function harness(input: {
  inspection?: Record<string, unknown>;
  redo?: boolean;
  keys: string[];
  pencil?: FakeButton;
}) {
  const calls: Array<{ method: string; params: unknown }> = [];
  const inspection = input.inspection ?? {
    owner: "external",
    historyRedoAvailable: false,
    rollback: { lastTurn: true, multiTurn: true },
  };
  const client = {
    inspectThread: vi.fn(async (params: unknown) => {
      calls.push({ method: "inspect", params });
      return inspection;
    }),
    rollbackThread: vi.fn(async (params: unknown) => {
      calls.push({ method: "rollback", params });
    }),
    ...(input.redo === false
      ? {}
      : {
          redoThread: vi.fn(async (params: unknown) => {
            calls.push({ method: "redo", params });
          }),
        }),
  } as unknown as RendererModelClient;
  const notices: string[] = [];
  const officialRedo = fakeButton("Redo");
  let changes = 0;
  const controller = createTurnActionController({
    getClient: () => client,
    orderedTurnKeys: () => input.keys,
    composerEditor: () => null,
    nativeRedoButton: () => officialRedo as unknown as HTMLButtonElement,
    chinese: () => false,
    notify: (text) => notices.push(text),
    onChange: () => {
      changes += 1;
    },
  });
  return { controller, calls, notices, officialRedo, client, changes: () => changes };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("Turn action controller", () => {
  it("rolls back by the count of later Turns and keeps the Redo slot until inspect answers", async () => {
    const h = harness({ keys: ["a", "b", "c"] });
    h.controller.setCurrent({ threadId: "thread-1", turnKey: "b", turn: fakeTurn("second") });
    await flush();
    expect(h.calls.map((call) => call.method)).toEqual(["inspect"]);
    h.controller.activate("rollback");
    expect(h.controller.view({ chinese: false, blocked: null }).confirming).toBe("rollback");
    h.controller.confirm();
    await flush();
    expect(h.calls).toContainEqual({
      method: "rollback",
      params: { threadId: "thread-1", numTurns: 1 },
    });
    const view = h.controller.view({ chinese: false, blocked: null });
    expect(view.confirming).toBeNull();
    expect(view.copy.rollbackDisabled).toBe(true);
    expect(view.copy.editTitle).toContain("Already rolled back");
    expect(h.notices.at(-1)).toContain("Rolled back to this turn");
    // The rollback re-inspects the Thread for the authoritative Redo slot.
    expect(h.calls.filter((call) => call.method === "inspect")).toHaveLength(2);
  });

  it("inspects once per Thread while the current Turn follows the viewport", async () => {
    const h = harness({ keys: ["a", "b", "c"] });
    h.controller.setCurrent({ threadId: "thread-1", turnKey: "a", turn: fakeTurn("first") });
    h.controller.setCurrent({ threadId: "thread-1", turnKey: "b", turn: fakeTurn("second") });
    await flush();
    h.controller.setCurrent({ threadId: "thread-1", turnKey: "c", turn: fakeTurn("third") });
    await flush();
    expect(h.calls.filter((call) => call.method === "inspect")).toHaveLength(1);
    // A different Thread starts over.
    h.controller.setCurrent({ threadId: "thread-2", turnKey: "a", turn: fakeTurn("first") });
    await flush();
    expect(h.calls.filter((call) => call.method === "inspect")).toHaveLength(2);
    const fresh = h.controller.view({ chinese: false, blocked: null }).copy;
    expect(fresh.redoDisabled).toBe(true);
    expect(fresh.editTitle).not.toContain("Already rolled back");
  });

  it("falls back to Desktop's own Redo only for Threads Codex owns", async () => {
    const official = harness({
      keys: ["a", "b"],
      inspection: { owner: "codex", locked: true },
      redo: false,
    });
    official.controller.setCurrent({ threadId: "thread-1", turnKey: "a", turn: fakeTurn("first") });
    await flush();
    official.controller.activate("rollback");
    official.controller.confirm();
    await flush();
    expect(official.controller.view({ chinese: false, blocked: null }).copy.redoDisabled).toBe(
      false,
    );
    official.controller.activate("redo");
    official.controller.confirm();
    await flush();
    expect(official.officialRedo.clicked).toBe(1);
    expect(official.notices.at(-1)).toContain("requested official Redo");

    // An external Thread with a Host Redo slot but no Host redo method: no official click.
    const external = harness({
      keys: ["a", "b"],
      redo: false,
      inspection: {
        owner: "external",
        historyRedoAvailable: true,
        rollback: { lastTurn: true, multiTurn: true },
      },
    });
    external.controller.setCurrent({ threadId: "thread-1", turnKey: "a", turn: fakeTurn("first") });
    await flush();
    external.controller.activate("rollback");
    external.controller.confirm();
    await flush();
    external.controller.activate("redo");
    external.controller.confirm();
    await flush();
    expect(external.officialRedo.clicked).toBe(0);
    expect(external.notices.at(-1)).toContain("no dropped turns");
  });

  it("confirms Edit only when a rollback runs first, then prefers the native pencil", async () => {
    const pencil = fakeButton("Edit message");
    const h = harness({ keys: ["a", "b", "c"] });
    h.controller.setCurrent({
      threadId: "thread-1",
      turnKey: "a",
      turn: fakeTurn("first", [pencil]),
    });
    await flush();
    h.controller.activate("edit");
    expect(h.controller.view({ chinese: false, blocked: null }).confirming).toBe("edit");
    h.controller.confirm();
    await flush();
    expect(h.calls).toContainEqual({
      method: "rollback",
      params: { threadId: "thread-1", numTurns: 2 },
    });
    expect(pencil.clicked).toBe(1);
    expect(h.notices).toContainEqual(expect.stringContaining("you can edit and resend"));
    // Last Turn: Edit runs immediately with no confirmation.
    const last = harness({ keys: ["a"] });
    const lastPencil = fakeButton("Edit message");
    last.controller.setCurrent({
      threadId: "thread-1",
      turnKey: "a",
      turn: fakeTurn("only", [lastPencil]),
    });
    last.controller.activate("edit");
    expect(lastPencil.clicked).toBe(1);
    expect(last.calls.some((call) => call.method === "rollback")).toBe(false);
  });

  it("counts later Turns from the Host's Turn ids when the DOM window is shorter", async () => {
    const { laterTurnCount } = await import("../src/renderer-turn-action-controller.js");
    expect(
      laterTurnCount({
        currentKey: "history-content:turn:b",
        domKeys: ["history-content:turn:a", "history-content:turn:b", "history-content:turn:c"],
        hostTurnIds: ["a", "b", "c", "d", "e"],
      }),
    ).toBe(3);
    expect(
      laterTurnCount({
        currentKey: "history-content:turn:b",
        domKeys: ["history-content:turn:a", "history-content:turn:b", "history-content:turn:c"],
        hostTurnIds: null,
      }),
    ).toBe(1);
    // A key the Host does not know falls back to the DOM count.
    expect(
      laterTurnCount({
        currentKey: "history-content:turn:z",
        domKeys: ["history-content:turn:z", "history-content:turn:c"],
        hostTurnIds: ["a", "b"],
      }),
    ).toBe(1);
    const h = harness({
      keys: ["a", "b", "c"],
      inspection: {
        owner: "external",
        historyRedoAvailable: false,
        rollback: { lastTurn: true, multiTurn: true },
        turnIds: ["a", "b", "c", "d", "e"],
      },
    });
    h.controller.setCurrent({ threadId: "thread-1", turnKey: "c", turn: fakeTurn("third") });
    await flush();
    h.controller.activate("rollback");
    h.controller.confirm();
    await flush();
    expect(h.calls).toContainEqual({
      method: "rollback",
      params: { threadId: "thread-1", numTurns: 2 },
    });
    // The label follows the Host list too: a windowed DOM would say 3/3 here.
    expect(h.controller.hostTurnPosition("c")).toEqual({ index: 2, count: 5 });
    expect(h.controller.hostTurnPosition("history-content:turn:d")).toEqual({
      index: 3,
      count: 5,
    });
    expect(h.controller.hostTurnPosition("nope")).toBeNull();
  });

  it("has no Host position for an official Thread", async () => {
    const h = harness({
      keys: ["a", "b"],
      inspection: { owner: "official", historyRedoAvailable: false },
    });
    h.controller.setCurrent({ threadId: "thread-1", turnKey: "a", turn: fakeTurn("first") });
    await flush();
    expect(h.controller.hostTurnPosition("a")).toBeNull();
  });

  it("drops a pending confirmation when the viewport moves to another Turn", () => {
    const h = harness({ keys: ["a", "b", "c"] });
    h.controller.setCurrent({ threadId: "thread-1", turnKey: "a", turn: fakeTurn("first") });
    h.controller.activate("rollback");
    expect(h.controller.view({ chinese: false, blocked: null }).confirming).toBe("rollback");
    h.controller.setCurrent({ threadId: "thread-1", turnKey: "b", turn: fakeTurn("second") });
    expect(h.controller.view({ chinese: false, blocked: null }).confirming).toBeNull();
    // Blocked views keep the reason, whatever the Turn says.
    expect(h.controller.view({ chinese: true, blocked: "busy" }).blocked).toBe("busy");
  });
});
