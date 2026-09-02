import { describe, expect, it } from "vitest";

import {
  activePiEntries,
  mapPiSnapshot,
  resolvePiForkBoundary,
  resolvePiLastTurnBoundary,
  type PiSessionHistory,
} from "../src/pi-history.js";
import { encodePiModelRef } from "../src/pi-model-catalog.js";

const history: PiSessionHistory = {
  entries: [
    {
      id: "model-1",
      parentId: null,
      type: "model_change",
      provider: "provider-a",
      modelId: "model-a",
    },
    {
      id: "user-1",
      parentId: "model-1",
      type: "message",
      message: { role: "user", content: [{ type: "text", text: "first" }] },
    },
    {
      id: "assistant-1",
      parentId: "user-1",
      type: "message",
      message: {
        role: "assistant",
        stopReason: "toolUse",
        content: [
          { type: "thinking", thinking: "inspect first", thinkingSignature: "ignored" },
          { type: "text", text: "checking" },
          { type: "toolCall", id: "call-1", name: "read", arguments: { path: "a.txt" } },
        ],
      },
    },
    {
      id: "tool-1",
      parentId: "assistant-1",
      type: "message",
      message: {
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "read",
        isError: false,
        content: [{ type: "text", text: "contents" }],
      },
    },
    {
      id: "model-2",
      parentId: "tool-1",
      type: "model_change",
      provider: "provider-b",
      modelId: "model-b",
    },
    {
      id: "user-2",
      parentId: "model-2",
      type: "message",
      message: { role: "user", content: [{ type: "text", text: "second" }] },
    },
    {
      id: "assistant-2",
      parentId: "user-2",
      type: "message",
      message: {
        role: "assistant",
        stopReason: "stop",
        content: [{ type: "text", text: "done" }],
      },
    },
    {
      id: "sibling-user",
      parentId: "user-1",
      type: "message",
      message: { role: "user", content: [{ type: "text", text: "not active" }] },
    },
  ],
  leafId: "assistant-2",
};

const state = {
  sessionId: "pi-session",
  model: { provider: "provider-b", id: "model-b" },
};

describe("Pi active-branch history", () => {
  it("walks only the parent chain ending at leafId", () => {
    expect(activePiEntries(history).map(({ id }) => id)).toEqual([
      "model-1",
      "user-1",
      "assistant-1",
      "tool-1",
      "model-2",
      "user-2",
      "assistant-2",
    ]);
  });

  it("projects deterministic Turns, Items, terminal identity, and Checkpoints", () => {
    const snapshot = mapPiSnapshot(history, state);

    expect(snapshot.turns).toHaveLength(2);
    expect(snapshot.turns[0]).toMatchObject({
      nativeTurnRef: {
        harnessId: "pi",
        nativeSessionId: "pi-session",
        nativeTurnKey: "user-1",
      },
      checkpoint: { checkpointId: "user-1" },
      input: [{ type: "text", text: "first" }],
      model: encodePiModelRef({ provider: "provider-a", id: "model-a" }),
      outcome: { status: "succeeded" },
      items: [
        {
          item: {
            type: "reasoning",
            itemId: "pi-item-v1-assistant-1-reasoning-0",
            text: "inspect first",
          },
        },
        { item: { type: "agentMessage", text: "checking" } },
        {
          item: {
            type: "toolExecution",
            toolName: "read",
            arguments: { path: "a.txt" },
            output: { content: [{ type: "text", text: "contents" }] },
          },
          outcome: { status: "succeeded" },
        },
      ],
    });
    expect(snapshot.turns[1]).toMatchObject({
      nativeTurnRef: { nativeTurnKey: "user-2" },
      checkpoint: { checkpointId: "user-2" },
      model: encodePiModelRef({ provider: "provider-b", id: "model-b" }),
      items: [{ item: { type: "agentMessage", text: "done" } }],
    });
    expect(mapPiSnapshot(history, state)).toEqual(snapshot);
  });

  it("replays interleaved Assistant messages and Tools in native order", () => {
    const ids = ["user", "assistant-1", "tool-1", "assistant-2", "tool-2", "assistant-3"];
    const messages = [
      { role: "user", content: [{ type: "text", text: "work" }] },
      {
        role: "assistant",
        content: [
          { type: "text", text: "first" },
          { type: "toolCall", id: "call-1", name: "read", arguments: {} },
        ],
      },
      {
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "read",
        isError: false,
        content: [{ type: "text", text: "one" }],
      },
      {
        role: "assistant",
        content: [
          { type: "text", text: "second" },
          { type: "toolCall", id: "call-2", name: "read", arguments: {} },
        ],
      },
      {
        role: "toolResult",
        toolCallId: "call-2",
        toolName: "read",
        isError: false,
        content: [{ type: "text", text: "two" }],
      },
      { role: "assistant", stopReason: "stop", content: [{ type: "text", text: "third" }] },
    ];
    const boundaryHistory: PiSessionHistory = {
      entries: messages.map((message, index) => ({
        id: ids[index] as string,
        parentId: ids[index - 1] ?? null,
        type: "message",
        message,
      })),
      leafId: ids.at(-1) as string,
    };

    const items = mapPiSnapshot(boundaryHistory, state).turns[0]?.items ?? [];
    expect(
      items.map(({ item }) =>
        item.type === "agentMessage" ? `agent:${item.text}` : `tool:${item.type}`,
      ),
    ).toEqual([
      "agent:first",
      "tool:toolExecution",
      "agent:second",
      "tool:toolExecution",
      "agent:third",
    ]);
    expect(items.map(({ item }) => item.itemId)).toEqual([
      "pi-item-v1-assistant-1-assistant-0",
      "pi-item-v1-assistant-1-tool-1",
      "pi-item-v1-assistant-2-assistant-0",
      "pi-item-v1-assistant-2-tool-1",
      "pi-item-v1-assistant-3-assistant-0",
    ]);
  });

  it("does not infer success from reasoning-only history", () => {
    const reasoningOnly: PiSessionHistory = {
      entries: [
        {
          id: "reasoning-user",
          parentId: null,
          type: "message",
          message: { role: "user", content: [{ type: "text", text: "question" }] },
        },
        {
          id: "reasoning-assistant",
          parentId: "reasoning-user",
          type: "message",
          message: {
            role: "assistant",
            content: [{ type: "thinking", thinking: "visible but not terminal" }],
          },
        },
      ],
      leafId: "reasoning-assistant",
    };

    const turn = mapPiSnapshot(reasoningOnly, state).turns[0];
    expect(turn).toMatchObject({
      outcome: { status: "unknown" },
      items: [{ item: { type: "reasoning", text: "visible but not terminal" } }],
    });
  });

  it("folds a delivered steer into its Turn and keeps Fork boundaries on prompts", () => {
    const steered: PiSessionHistory = {
      entries: [
        {
          id: "user-1",
          parentId: null,
          type: "message",
          message: { role: "user", content: [{ type: "text", text: "first" }] },
        },
        {
          id: "assistant-1",
          parentId: "user-1",
          type: "message",
          message: {
            role: "assistant",
            stopReason: "toolUse",
            content: [
              { type: "text", text: "checking" },
              { type: "toolCall", id: "call-1", name: "read", arguments: { path: "a.txt" } },
            ],
          },
        },
        {
          id: "tool-1",
          parentId: "assistant-1",
          type: "message",
          message: {
            role: "toolResult",
            toolCallId: "call-1",
            toolName: "read",
            isError: false,
            content: [{ type: "text", text: "contents" }],
          },
        },
        // Pi delivers the queued steer after the tool calls, before the next
        // model call: a user message following a toolUse stop.
        {
          id: "user-steer",
          parentId: "tool-1",
          type: "message",
          message: { role: "user", content: [{ type: "text", text: "actually check tests" }] },
        },
        {
          id: "assistant-2",
          parentId: "user-steer",
          type: "message",
          message: {
            role: "assistant",
            stopReason: "stop",
            content: [{ type: "text", text: "done" }],
          },
        },
        {
          id: "user-2",
          parentId: "assistant-2",
          type: "message",
          message: { role: "user", content: [{ type: "text", text: "next" }] },
        },
        {
          id: "assistant-3",
          parentId: "user-2",
          type: "message",
          message: {
            role: "assistant",
            stopReason: "stop",
            content: [{ type: "text", text: "ok" }],
          },
        },
      ],
      leafId: "assistant-3",
    };
    const snapshot = mapPiSnapshot(steered, { sessionId: "session-1", model: null });

    expect(snapshot.turns).toHaveLength(2);
    expect(snapshot.turns[0]).toMatchObject({
      nativeTurnRef: { nativeTurnKey: "user-1" },
      checkpoint: { checkpointId: "user-1" },
      input: [{ text: "first" }],
      outcome: { status: "succeeded" },
    });
    expect(
      snapshot.turns[0]?.items.map(({ item }) => [item.type, "text" in item ? item.text : ""]),
    ).toEqual([
      ["agentMessage", "checking"],
      ["toolExecution", ""],
      ["userMessage", "actually check tests"],
      ["agentMessage", "done"],
    ]);
    expect(snapshot.turns[1]).toMatchObject({ nativeTurnRef: { nativeTurnKey: "user-2" } });
    // Fork / rollback boundaries skip the folded steer entry.
    expect(resolvePiForkBoundary(steered, "user-1")).toEqual({
      targetTurnIndex: 0,
      nextUserEntryId: "user-2",
    });
    expect(resolvePiLastTurnBoundary(steered)).toEqual({
      lastUserEntryId: "user-2",
      sourceTurnCount: 2,
    });
  });

  it("folds a steer delivered after a tool-less assistant message by its queued timestamp", () => {
    // Live Pi 0.84.4: the steer is queued while the assistant streams, so its
    // message.timestamp precedes the assistant Entry's timestamp even though
    // that assistant stopped with "stop" and made no tool call.
    const steered: PiSessionHistory = {
      entries: [
        {
          id: "user-1",
          parentId: null,
          type: "message",
          timestamp: "2026-09-02T10:18:58.312Z",
          message: {
            role: "user",
            content: [{ type: "text", text: "count" }],
            timestamp: 1788344338312,
          },
        },
        {
          id: "assistant-1",
          parentId: "user-1",
          type: "message",
          timestamp: "2026-09-02T10:19:01.900Z",
          message: {
            role: "assistant",
            stopReason: "stop",
            content: [{ type: "text", text: "1 2 3" }],
          },
        },
        {
          id: "user-steer",
          parentId: "assistant-1",
          type: "message",
          timestamp: "2026-09-02T10:19:02.066Z",
          message: {
            role: "user",
            content: [{ type: "text", text: "stop" }],
            timestamp: 1788344340312,
          },
        },
        {
          id: "assistant-2",
          parentId: "user-steer",
          type: "message",
          timestamp: "2026-09-02T10:19:03.500Z",
          message: {
            role: "assistant",
            stopReason: "stop",
            content: [{ type: "text", text: "INTERJECTED" }],
          },
        },
        // A fresh prompt is created after the previous assistant Entry.
        {
          id: "user-2",
          parentId: "assistant-2",
          type: "message",
          timestamp: "2026-09-02T10:20:00.000Z",
          message: {
            role: "user",
            content: [{ type: "text", text: "next" }],
            timestamp: 1788344399900,
          },
        },
        {
          id: "assistant-3",
          parentId: "user-2",
          type: "message",
          timestamp: "2026-09-02T10:20:02.000Z",
          message: {
            role: "assistant",
            stopReason: "stop",
            content: [{ type: "text", text: "ok" }],
          },
        },
      ],
      leafId: "assistant-3",
    };
    const snapshot = mapPiSnapshot(steered, { sessionId: "session-1", model: null });
    expect(snapshot.turns).toHaveLength(2);
    expect(snapshot.turns[0]).toMatchObject({ nativeTurnRef: { nativeTurnKey: "user-1" } });
    expect(
      snapshot.turns[0]?.items.map(({ item }) => [item.type, "text" in item ? item.text : ""]),
    ).toEqual([
      ["agentMessage", "1 2 3"],
      ["userMessage", "stop"],
      ["agentMessage", "INTERJECTED"],
    ]);
    expect(snapshot.turns[1]).toMatchObject({ nativeTurnRef: { nativeTurnKey: "user-2" } });
    expect(resolvePiLastTurnBoundary(steered)).toEqual({
      lastUserEntryId: "user-2",
      sourceTurnCount: 2,
    });
  });

  it("resolves middle and terminal logical Fork boundaries", () => {
    expect(resolvePiForkBoundary(history, "user-1")).toEqual({
      targetTurnIndex: 0,
      nextUserEntryId: "user-2",
    });
    expect(resolvePiForkBoundary(history, "user-2")).toEqual({
      targetTurnIndex: 1,
      nextUserEntryId: null,
    });
    expect(() => resolvePiForkBoundary(history, "sibling-user")).toThrow(
      "not on the active branch",
    );
  });

  it("rejects broken active-branch identity", () => {
    expect(() => activePiEntries({ entries: history.entries, leafId: "missing" })).toThrow(
      "missing Entry",
    );
  });
});
