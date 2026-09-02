import { describe, expect, it, vi } from "vitest";

import type { HarnessOutput, HostUsage } from "@codexhost/harness-adapter";
import {
  harnessPermissionModeIdSchema,
  harnessThinkingOptionIdSchema,
  nativeCheckpointRefSchema,
  nativeSessionRefSchema,
  type HarnessThinkingOptionId,
  type HostTurnId,
} from "@codexhost/shared-contracts";

import {
  OmpAdapter,
  type OmpAdapterDependencies,
  type OmpTurnTransport,
} from "../src/omp-adapter.js";
import type {
  OmpCompactResult,
  OmpRpcSessionOptions,
  OmpSessionHistory,
  OmpSessionState,
  OmpSubagentMessagesResult,
  OmpTurnEvent,
  OmpTurnResult,
} from "../src/omp-rpc-session.js";
import type { OmpNativeModel } from "../src/omp-model-catalog.js";

class FakeOmpTransport implements OmpTurnTransport {
  state: OmpSessionState = {
    sessionId: "omp-parent",
    sessionFile: "/synthetic/omp-parent.jsonl",
    provider: "synthetic",
    modelId: "model",
    thinkingLevel: harnessThinkingOptionIdSchema.parse("high"),
    contextUsage: null,
    availableThinkingLevels: [harnessThinkingOptionIdSchema.parse("high")],
  };
  readonly stderrTail = "";
  history: OmpSessionHistory = { entries: [], leafId: null };
  onEvent: ((event: OmpTurnEvent) => void) | null = null;
  onSubagentEvent: ((event: OmpTurnEvent) => void) | null = null;
  #resolveTurn: ((result: OmpTurnResult) => void) | null = null;

  async start(): Promise<void> {}

  async getAvailableModels(): Promise<OmpNativeModel[]> {
    return [{ provider: "synthetic", id: "model", reasoning: true }];
  }

  async getAvailableThinkingLevels(): Promise<HarnessThinkingOptionId[]> {
    return [harnessThinkingOptionIdSchema.parse("high")];
  }

  async getEntries(): Promise<OmpSessionHistory> {
    return structuredClone(this.history);
  }

  async getSubagentMessages(): Promise<OmpSubagentMessagesResult> {
    return {
      sessionFile: "/synthetic/subagent.jsonl",
      fromByte: 0,
      nextByte: 256,
      reset: false,
      entries: [
        {
          id: "subagent-user-1",
          parentId: null,
          type: "message",
          message: {
            role: "user",
            content: [{ type: "text", text: "Inspect the repository" }],
          },
        },
        {
          id: "subagent-assistant-1",
          parentId: "subagent-user-1",
          type: "message",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "I inspected it." }],
            stopReason: "stop",
          },
        },
      ],
      messages: [],
    };
  }

  async getSessionUsage(): Promise<HostUsage | null> {
    return null;
  }

  async fork(entryId: string): Promise<OmpSessionState> {
    void entryId;
    return this.state;
  }

  async verifySessionCwd(): Promise<void> {}

  async selectModel(): Promise<OmpSessionState> {
    return this.state;
  }

  async selectThinkingOption(): Promise<OmpSessionState> {
    return this.state;
  }

  async compact(): Promise<OmpCompactResult> {
    return { outcome: "succeeded" };
  }

  runTurn(_text: string, onEvent: (event: OmpTurnEvent) => void): Promise<OmpTurnResult> {
    this.onEvent = onEvent;
    return new Promise((resolve) => {
      this.#resolveTurn = resolve;
      queueMicrotask(() => {
        onEvent({
          type: "subagent.started",
          callId: "tool-1",
          nativeSubagentId: "subagent-1",
          description: "Inspect the repository",
          role: "task",
          background: false,
        });
        onEvent({
          type: "subagent.updated",
          callId: "tool-1",
          nativeSubagentId: "subagent-1",
          status: "running",
        });
        onEvent({
          type: "subagent.completed",
          callId: "tool-1",
          nativeSubagentId: "subagent-1",
          isError: false,
          resultSummary: "done",
        });
        this.history = {
          entries: [
            {
              id: "user-1",
              parentId: null,
              type: "message",
              message: { role: "user", content: [{ type: "text", text: "delegate" }] },
            },
            {
              id: "assistant-1",
              parentId: "user-1",
              type: "message",
              message: {
                role: "assistant",
                content: [{ type: "text", text: "done" }],
                stopReason: "stop",
              },
            },
          ],
          leafId: "assistant-1",
        };
        this.#resolveTurn?.({ text: "done", cancelled: false });
      });
    });
  }

  async respondToInteraction(): Promise<void> {}

  readonly steered: string[] = [];
  async steer(text: string): Promise<void> {
    if (!this.onEvent) throw new Error("No active fake OMP Turn to steer");
    this.steered.push(text);
    // OMP reports the delivery as a user message_start → in-turn user event.
    this.onEvent({ type: "user.message", text });
  }

  async abort(): Promise<void> {
    this.#resolveTurn?.({ text: "", cancelled: true });
  }

  async close(): Promise<void> {}
}

/** Holds the Turn open so a steer can arrive mid-Turn, then persists one User Entry per steer. */
class SteerableOmpTransport extends FakeOmpTransport {
  #resolveHeld: ((result: OmpTurnResult) => void) | null = null;
  #promptText = "";
  /** Persist steers the way live Pi-family agents do after a tool-less assistant turn. */
  steerAfterStop = false;

  override runTurn(text: string, onEvent: (event: OmpTurnEvent) => void): Promise<OmpTurnResult> {
    this.onEvent = onEvent;
    this.#promptText = text;
    return new Promise((resolve) => {
      this.#resolveHeld = resolve;
    });
  }

  succeed(answer: string): void {
    const entries = historyTurn({
      userId: "user-1",
      parentId: null,
      assistantId: "assistant-1",
      text: this.#promptText,
    });
    let leafId = "assistant-1";
    // OMP (Pi RPC family) delivers a steer after the assistant's tool calls
    // (`stopReason: "toolUse"` + tool results); history folds it into the Turn.
    this.steered.splice(0).forEach((steerText, offset) => {
      const assistant = entries.at(-1) as {
        timestamp?: string;
        message: { stopReason?: string; content: unknown[] };
      };
      const ordinal = offset + 2;
      if (this.steerAfterStop) {
        // Tool-less delivery: the assistant keeps stopReason "stop" and the
        // steer's message.timestamp (queued while streaming) precedes the
        // assistant Entry timestamp.
        const persistedAt = Date.now();
        assistant.timestamp = new Date(persistedAt).toISOString();
        const [steerUser, steerAssistant] = historyTurn({
          userId: `user-${ordinal}`,
          parentId: leafId,
          assistantId: `assistant-${ordinal}`,
          text: steerText,
        }) as Array<{ timestamp?: string; message: { timestamp?: number } }>;
        if (!steerUser || !steerAssistant) throw new Error("historyTurn shape changed");
        steerUser.timestamp = new Date(persistedAt + 200).toISOString();
        steerUser.message.timestamp = persistedAt - 2_000;
        steerAssistant.timestamp = new Date(persistedAt + 1_500).toISOString();
        entries.push(
          steerUser as OmpSessionHistory["entries"][number],
          steerAssistant as OmpSessionHistory["entries"][number],
        );
        leafId = `assistant-${ordinal}`;
        return;
      }
      assistant.message.stopReason = "toolUse";
      assistant.message.content = [
        ...assistant.message.content,
        { type: "toolCall", id: `call-${offset}`, name: "read", arguments: {} },
      ];
      entries.push(
        {
          id: `tool-${ordinal}`,
          parentId: leafId,
          type: "message",
          message: {
            role: "toolResult",
            toolCallId: `call-${offset}`,
            toolName: "read",
            isError: false,
            content: [{ type: "text", text: "contents" }],
          },
        },
        ...historyTurn({
          userId: `user-${ordinal}`,
          parentId: `tool-${ordinal}`,
          assistantId: `assistant-${ordinal}`,
          text: steerText,
        }),
      );
      leafId = `assistant-${ordinal}`;
    });
    this.history = { entries, leafId };
    this.#resolveHeld?.({ text: answer, cancelled: false });
    this.#resolveHeld = null;
    this.onEvent = null;
  }
}

class RestartableOmpTransport extends FakeOmpTransport {
  closed = false;
  startError: Error | null = null;

  override async start(): Promise<void> {
    if (this.startError) throw this.startError;
  }

  override async close(): Promise<void> {
    this.closed = true;
  }
}

function historyTurn(input: {
  assistantId: string;
  parentId: string | null;
  text: string;
  userId: string;
}): OmpSessionHistory["entries"] {
  return [
    {
      id: input.userId,
      parentId: input.parentId,
      type: "message",
      message: { role: "user", content: [{ type: "text", text: input.text }] },
    },
    {
      id: input.assistantId,
      parentId: input.userId,
      type: "message",
      message: {
        role: "assistant",
        content: [{ type: "text", text: `${input.text} response` }],
        stopReason: "stop",
      },
    },
  ];
}

describe("OMP Adapter Session environment", () => {
  it("uses the czz-dev write default without changing ordinary create semantics", async () => {
    const transport = new FakeOmpTransport();
    const createTransport = vi.fn(() => transport);
    const adapter = new OmpAdapter({}, { createTransport });
    const opened = await adapter.open({
      kind: "create",
      cwd: "/synthetic",
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    await opened.value.execute({
      type: "turn.start",
      turnId: "permission-turn" as HostTurnId,
      input: [{ type: "text", text: "task" }],
    });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ permissionMode: "write" }),
    );
    await adapter.close();
  });

  it("keeps a steer delivered after a tool-less assistant message inside the Host Turn", async () => {
    const transport = new SteerableOmpTransport();
    transport.steerAfterStop = true;
    const adapter = new OmpAdapter({}, { createTransport: () => transport });
    const opened = await adapter.open({ kind: "create", cwd: "/synthetic" });
    if (!opened.ok) throw new Error(opened.error.message);
    const session = opened.value;
    const iterator = session.outputs[Symbol.asyncIterator]();
    const turnId = "steer-after-stop" as HostTurnId;

    await expect(
      session.execute({ type: "turn.start", turnId, input: [{ type: "text", text: "first" }] }),
    ).resolves.toEqual({ ok: true, value: { turnId } });
    for (let step = 0; step < 4; step += 1) {
      const next = await iterator.next();
      if (next.done) throw new Error("Output stream ended");
      if (next.value.kind === "event" && next.value.event.type === "item.started") break;
    }
    await expect(
      session.execute({ type: "turn.steer", turnId, input: [{ type: "text", text: "second" }] }),
    ).resolves.toEqual({ ok: true, value: { accepted: true } });

    transport.succeed("done");
    let completed: HarnessOutput | null = null;
    for (let step = 0; step < 12 && !completed; step += 1) {
      const next = await iterator.next();
      if (next.done) throw new Error("Output stream ended");
      if (next.value.kind === "event" && next.value.event.type === "turn.completed") {
        completed = next.value;
      }
    }
    expect(completed).toMatchObject({
      event: {
        type: "turn.completed",
        outcome: { status: "succeeded" },
        nativeTurnRef: { nativeTurnKey: "user-1" },
      },
    });
    const snapshot = await session.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.error.message);
    expect(snapshot.value.turns).toHaveLength(1);
    expect(snapshot.value.turns[0]?.items.map(({ item }) => item.type)).toEqual([
      "agentMessage",
      "userMessage",
      "agentMessage",
    ]);
    await adapter.close();
  });

  it("steers the active Turn natively and keeps the prompt Entry as the Host Turn identity", async () => {
    const transport = new SteerableOmpTransport();
    const adapter = new OmpAdapter({}, { createTransport: () => transport });
    const opened = await adapter.open({ kind: "create", cwd: "/synthetic" });
    if (!opened.ok) throw new Error(opened.error.message);
    const session = opened.value;
    expect(session.capabilities.turns).toEqual({ steer: true });
    const iterator = session.outputs[Symbol.asyncIterator]();
    const turnId = "steer-turn" as HostTurnId;

    await expect(
      session.execute({ type: "turn.start", turnId, input: [{ type: "text", text: "first" }] }),
    ).resolves.toEqual({ ok: true, value: { turnId } });
    for (let step = 0; step < 4; step += 1) {
      const next = await iterator.next();
      if (next.done) throw new Error("Output stream ended");
      if (next.value.kind === "event" && next.value.event.type === "item.started") break;
    }
    await expect(
      session.execute({ type: "turn.steer", turnId, input: [{ type: "text", text: "second" }] }),
    ).resolves.toEqual({ ok: true, value: { accepted: true } });
    expect(transport.steered).toEqual(["second"]);
    // The delivered steer is an in-turn user item, live.
    let liveUserItem: HarnessOutput | null = null;
    for (let step = 0; step < 8 && !liveUserItem; step += 1) {
      const next = await iterator.next();
      if (next.done) throw new Error("Output stream ended");
      if (
        next.value.kind === "event" &&
        next.value.event.type === "item.completed" &&
        next.value.event.snapshot.item.type === "userMessage"
      ) {
        liveUserItem = next.value;
      }
    }
    expect(liveUserItem).toMatchObject({
      event: { snapshot: { item: { type: "userMessage", text: "second" } } },
    });

    transport.succeed("done");
    let completed: HarnessOutput | null = null;
    for (let step = 0; step < 8 && !completed; step += 1) {
      const next = await iterator.next();
      if (next.done) throw new Error("Output stream ended");
      if (next.value.kind === "event" && next.value.event.type === "turn.completed") {
        completed = next.value;
      }
    }
    // The steer persisted a second User Entry, but history folds it into the
    // prompt's Turn: one Host Turn, identity and checkpoint on the prompt.
    expect(completed).toMatchObject({
      event: {
        type: "turn.completed",
        outcome: { status: "succeeded" },
        nativeTurnRef: { nativeTurnKey: "user-1" },
      },
    });
    const snapshot = await session.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.error.message);
    expect(snapshot.value.turns).toHaveLength(1);
    expect(
      snapshot.value.turns[0]?.items.map(({ item }) => [
        item.type,
        "text" in item ? item.text : "",
      ]),
    ).toEqual([
      ["agentMessage", "first response"],
      ["toolExecution", ""],
      ["userMessage", "second"],
      ["agentMessage", "second response"],
    ]);
    await adapter.close();
  });

  it("defers a cold OMP Permission Mode selection until startup", async () => {
    const transport = new RestartableOmpTransport();
    const createTransport = vi.fn(() => transport);
    const adapter = new OmpAdapter({}, { createTransport });
    const opened = await adapter.open({
      kind: "create",
      cwd: "/synthetic",
      permissionModeId: harnessPermissionModeIdSchema.parse("always-ask"),
    });
    if (!opened.ok) throw new Error(opened.error.message);

    await expect(
      opened.value.execute({
        type: "permissionMode.select",
        permissionModeId: harnessPermissionModeIdSchema.parse("write"),
      }),
    ).resolves.toEqual({ ok: true, value: { completed: true } });
    expect(createTransport).not.toHaveBeenCalled();
    await expect(opened.value.readSnapshot()).resolves.toMatchObject({
      ok: true,
      value: { state: { effectivePermissionModeId: "write" } },
    });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ permissionMode: "write" }),
    );
    await adapter.close();
  });

  it("advertises OMP Permission Modes and restarts a persisted Session to switch mode", async () => {
    const inspection = new RestartableOmpTransport();
    const initial = new RestartableOmpTransport();
    initial.state = {
      ...initial.state,
      sessionId: "omp-permission-session",
      sessionFile: "/synthetic/omp-permission-session.jsonl",
    };
    const replacement = new RestartableOmpTransport();
    replacement.state = { ...initial.state };
    const createTransport = vi
      .fn()
      .mockImplementationOnce(() => inspection)
      .mockImplementationOnce(() => initial)
      .mockImplementationOnce(() => replacement);
    const adapter = new OmpAdapter({}, { createTransport });

    await expect(adapter.inspect({ cwd: "/synthetic" })).resolves.toMatchObject({
      status: "ready",
      permissionModes: {
        defaultModeId: "write",
        modes: expect.arrayContaining([
          expect.objectContaining({ id: "always-ask" }),
          expect.objectContaining({ id: "write" }),
          expect.objectContaining({ id: "yolo", dangerous: true }),
        ]),
      },
      capabilities: { configuration: { selectPermissionMode: true } },
    });
    const opened = await adapter.open({
      kind: "create",
      cwd: "/synthetic",
      permissionModeId: harnessPermissionModeIdSchema.parse("write"),
    });
    if (!opened.ok) throw new Error(opened.error.message);
    await opened.value.readSnapshot();
    await expect(
      opened.value.execute({
        type: "permissionMode.select",
        permissionModeId: harnessPermissionModeIdSchema.parse("yolo"),
      }),
    ).resolves.toEqual({ ok: true, value: { completed: true } });
    expect(initial.closed).toBe(true);
    expect(createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionFile: "/synthetic/omp-permission-session.jsonl",
        permissionMode: "yolo",
      }),
    );
    await expect(opened.value.readSnapshot()).resolves.toMatchObject({
      ok: true,
      value: { state: { effectivePermissionModeId: "yolo" } },
    });
    await adapter.close();
  });

  it("recovers the previous OMP Permission Mode when restart fails", async () => {
    const initial = new RestartableOmpTransport();
    initial.state = {
      ...initial.state,
      sessionId: "omp-permission-recovery",
      sessionFile: "/synthetic/omp-permission-recovery.jsonl",
    };
    const failedReplacement = new RestartableOmpTransport();
    failedReplacement.state = { ...initial.state };
    failedReplacement.startError = new Error("synthetic permission restart failure");
    const recovery = new RestartableOmpTransport();
    recovery.state = { ...initial.state };
    const createTransport = vi
      .fn()
      .mockImplementationOnce(() => initial)
      .mockImplementationOnce(() => failedReplacement)
      .mockImplementationOnce(() => recovery);
    const adapter = new OmpAdapter({}, { createTransport });
    const opened = await adapter.open({
      kind: "create",
      cwd: "/synthetic",
      permissionModeId: harnessPermissionModeIdSchema.parse("write"),
    });
    if (!opened.ok) throw new Error(opened.error.message);
    await opened.value.readSnapshot();
    await expect(
      opened.value.execute({
        type: "permissionMode.select",
        permissionModeId: harnessPermissionModeIdSchema.parse("yolo"),
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "nativeFailure", message: "synthetic permission restart failure" },
    });
    expect(createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ permissionMode: "write" }),
    );
    await expect(opened.value.readSnapshot()).resolves.toMatchObject({
      ok: true,
      value: { state: { effectivePermissionModeId: "write" } },
    });
    await adapter.close();
  });

  it("passes per-Session delegation environment to the native transport", async () => {
    const transport = new FakeOmpTransport();
    const createTransport = vi.fn(() => transport);
    const adapter = new OmpAdapter({}, { createTransport });
    const opened = await adapter.open({
      kind: "create",
      cwd: "/synthetic",
      environment: {
        CODEXHOST_CLI_PATH: "/opt/codexhost",
        CODEXHOST_RUNTIME_ENDPOINT: "http://127.0.0.1:43123",
        CODEXHOST_RUNTIME_TOKEN: "token",
        CODEXHOST_THREAD_ID: "thread-1",
      },
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    await opened.value.execute({
      type: "turn.start",
      turnId: "environment-turn" as HostTurnId,
      input: [{ type: "text", text: "task" }],
    });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: expect.objectContaining({
          CODEXHOST_CLI_PATH: "/opt/codexhost",
          CODEXHOST_RUNTIME_ENDPOINT: "http://127.0.0.1:43123",
          CODEXHOST_RUNTIME_TOKEN: "token",
          CODEXHOST_THREAD_ID: "thread-1",
        }),
      }),
    );
    await adapter.close();
  });
});

describe("OMP Adapter inspection", () => {
  it("reports a missing executable as not installed", async () => {
    const transport = new FakeOmpTransport();
    vi.spyOn(transport, "start").mockRejectedValueOnce(
      Object.assign(new Error("spawn omp ENOENT"), { code: "ENOENT" }),
    );
    const close = vi.spyOn(transport, "close");
    const adapter = new OmpAdapter({}, { createTransport: () => transport });

    await expect(adapter.inspect({ cwd: "/synthetic" })).resolves.toMatchObject({
      status: "notInstalled",
      error: { code: "notInstalled", retryable: false, stage: "startup" },
    });
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("OMP Adapter Fork", () => {
  it("forks the requested completed prefix from the next OMP User Entry", async () => {
    const firstTurn = historyTurn({
      userId: "source-user-1",
      assistantId: "source-assistant-1",
      parentId: null,
      text: "first",
    });
    const secondTurn = historyTurn({
      userId: "source-user-2",
      assistantId: "source-assistant-2",
      parentId: "source-assistant-1",
      text: "second",
    });
    const transport = new FakeOmpTransport();
    transport.state = {
      ...transport.state,
      sessionId: "fork-startup",
      sessionFile: "/synthetic/fork-startup.jsonl",
    };
    transport.history = {
      entries: [...firstTurn, ...secondTurn],
      leafId: "source-assistant-2",
    };
    const fork = vi.fn(async (entryId: string) => {
      expect(entryId).toBe("source-user-2");
      transport.state = {
        ...transport.state,
        sessionId: "fork-derived",
        sessionFile: "/synthetic/fork-derived.jsonl",
      };
      transport.history = { entries: firstTurn, leafId: "source-assistant-1" };
      return transport.state;
    });
    transport.fork = fork;
    const verifySessionCwd = vi.fn(async () => undefined);
    transport.verifySessionCwd = verifySessionCwd;
    const createTransport = vi.fn(() => transport);
    const adapter = new OmpAdapter({}, { createTransport });
    const sourceRef = nativeSessionRefSchema.parse({
      harnessId: "omp",
      nativeSessionId: "source-session",
      locator: { sessionFile: "/synthetic/source-session.jsonl" },
      formatVersion: 1,
    });
    const checkpoint = nativeCheckpointRefSchema.parse({
      harnessId: "omp",
      nativeSessionId: "source-session",
      checkpointId: "source-user-1",
      formatVersion: 1,
    });

    const opened = await adapter.open({
      kind: "fork",
      cwd: "/synthetic",
      sourceRef,
      checkpoint,
    });

    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        forkSessionFile: "/synthetic/source-session.jsonl",
        permissionMode: "write",
      }),
    );
    expect(fork).toHaveBeenCalledTimes(1);
    expect(verifySessionCwd).toHaveBeenCalledWith("/synthetic");
    expect(opened.value.initialState.nativeRef).toMatchObject({
      nativeSessionId: "fork-derived",
      locator: { sessionFile: "/synthetic/fork-derived.jsonl" },
    });
    await expect(opened.value.readSnapshot()).resolves.toMatchObject({
      ok: true,
      value: {
        turns: [
          {
            nativeTurnRef: { nativeSessionId: "fork-derived", nativeTurnKey: "source-user-1" },
            checkpoint: { nativeSessionId: "fork-derived", checkpointId: "source-user-1" },
          },
        ],
      },
    });
    await opened.value.close();
    await adapter.close();
  });
});

function outputs(session: { outputs: AsyncIterable<HarnessOutput> }): HarnessOutput[] {
  const values: HarnessOutput[] = [];
  void (async () => {
    for await (const output of session.outputs) values.push(output);
  })();
  return values;
}

describe("OMP Adapter Subagents", () => {
  it("projects native Subagent lifecycle into a Host delegation Item", async () => {
    const transport = new FakeOmpTransport();
    const dependencies: OmpAdapterDependencies = {
      createTransport: (options: OmpRpcSessionOptions) => {
        transport.onSubagentEvent = options.onSubagentEvent ?? null;
        return transport;
      },
    };
    const adapter = new OmpAdapter({}, dependencies);
    const opened = await adapter.open({ kind: "create", cwd: "/synthetic" });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.capabilities.subagents).toEqual({ observe: true, readTranscript: true });
    const observed = outputs(opened.value);
    const accepted = await opened.value.execute({
      type: "turn.start",
      turnId: "turn-1" as HostTurnId,
      input: [{ type: "text", text: "delegate" }],
    });
    expect(accepted).toEqual({ ok: true, value: { turnId: "turn-1" } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const events = observed
      .filter(
        (output): output is Extract<HarnessOutput, { kind: "event" }> => output.kind === "event",
      )
      .map((output) => output.event);
    const started = events.find(
      (event) => event.type === "item.started" && event.item.type === "subagentDelegation",
    );
    expect(started).toMatchObject({
      item: {
        type: "subagentDelegation",
        operation: "spawn",
        subagents: [{ nativeSubagentId: "subagent-1", status: "running" }],
      },
    });
    const completed = events.find(
      (event) =>
        event.type === "item.completed" && event.snapshot.item.type === "subagentDelegation",
    );
    expect(completed).toMatchObject({
      type: "item.completed",
      snapshot: {
        item: {
          type: "subagentDelegation",
          subagents: [{ nativeSubagentId: "subagent-1", status: "completed" }],
        },
      },
    });
    expect(
      events
        .filter((event) => event.type === "subagent.state.changed")
        .map((event) => event.status),
    ).toEqual(["running", "running", "completed"]);
    transport.onSubagentEvent?.({
      type: "subagent.transcript.changed",
      callId: "tool-1",
      nativeSubagentId: "subagent-1",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const laterEvents = observed
      .filter(
        (output): output is Extract<HarnessOutput, { kind: "event" }> => output.kind === "event",
      )
      .map((output) => output.event);
    expect(laterEvents).toContainEqual({
      type: "subagent.transcript.changed",
      nativeSubagentId: "subagent-1",
    });
    await opened.value.close();
    await adapter.close();
  });

  it("exposes only OMP compact as a Harness command", async () => {
    const transport = new FakeOmpTransport();
    const dependencies: OmpAdapterDependencies = {
      createTransport: () => transport,
    };
    const adapter = new OmpAdapter({}, dependencies);
    const opened = await adapter.open({ kind: "create", cwd: "/synthetic" });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const commands = opened.value.commands;
    if (!commands) throw new Error("OMP Session did not expose commands");
    await expect(commands.list()).resolves.toEqual({
      ok: true,
      value: {
        commands: [
          {
            id: "omp.compact",
            invocation: "/compact",
            label: "Compact context",
            description: "Compact the current conversation context",
            argumentMode: "text",
          },
        ],
      },
    });
    await opened.value.close();
    await adapter.close();
  });

  it("reads a stable OMP Subagent transcript as a Child Host Thread", async () => {
    const transport = new FakeOmpTransport();
    const dependencies: OmpAdapterDependencies = {
      createTransport: () => transport,
    };
    const adapter = new OmpAdapter({}, dependencies);
    const parent = nativeSessionRefSchema.parse({
      harnessId: "omp",
      nativeSessionId: "omp-parent",
      locator: { sessionFile: "/synthetic/omp-parent.jsonl" },
      formatVersion: 1,
    });
    const result = await adapter.subagents.readSnapshot({
      parent,
      nativeSubagentId: "subagent-1",
      cwd: "/synthetic",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.turns).toHaveLength(1);
      expect(result.value.turns[0]?.input).toEqual([
        { type: "text", text: "Inspect the repository" },
      ]);
      expect(result.value.turns[0]?.items).toContainEqual({
        item: expect.objectContaining({ type: "agentMessage", text: "I inspected it." }),
        outcome: { status: "succeeded" },
      });
    }
    await adapter.close();
  });

  it("materializes a background Subagent that starts after the parent Turn is idle", async () => {
    const transport = new FakeOmpTransport();
    const dependencies: OmpAdapterDependencies = {
      createTransport: (options: OmpRpcSessionOptions) => {
        transport.onSubagentEvent = options.onSubagentEvent ?? null;
        return transport;
      },
    };
    const adapter = new OmpAdapter({}, dependencies);
    const opened = await adapter.open({ kind: "create", cwd: "/synthetic" });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const observed = outputs(opened.value);
    await opened.value.execute({
      type: "turn.start",
      turnId: "turn-parent" as HostTurnId,
      input: [{ type: "text", text: "start background work" }],
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    transport.onSubagentEvent?.({
      type: "subagent.started",
      callId: "background-tool",
      nativeSubagentId: "background-subagent",
      description: "Continue the long task",
      role: "task",
      background: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const startedEvents = observed
      .filter(
        (output): output is Extract<HarnessOutput, { kind: "event" }> => output.kind === "event",
      )
      .map((output) => output.event);
    const autonomous = startedEvents.find((event) => event.type === "turn.autonomous.started");
    expect(autonomous).toMatchObject({ type: "turn.autonomous.started" });
    expect(startedEvents).toContainEqual(
      expect.objectContaining({
        type: "item.started",
        item: expect.objectContaining({
          type: "subagentDelegation",
          subagents: [
            expect.objectContaining({
              nativeSubagentId: "background-subagent",
              status: "running",
              background: true,
            }),
          ],
        }),
      }),
    );

    transport.onSubagentEvent?.({
      type: "subagent.completed",
      callId: "background-tool",
      nativeSubagentId: "background-subagent",
      isError: false,
      resultSummary: "finished in background",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const completedEvents = observed
      .filter(
        (output): output is Extract<HarnessOutput, { kind: "event" }> => output.kind === "event",
      )
      .map((output) => output.event);
    expect(completedEvents).toContainEqual(
      expect.objectContaining({
        type: "item.completed",
        snapshot: expect.objectContaining({
          item: expect.objectContaining({
            type: "subagentDelegation",
            subagents: [expect.objectContaining({ status: "completed" })],
          }),
        }),
      }),
    );
    expect(completedEvents.some((event) => event.type === "turn.completed")).toBe(true);
    await opened.value.close();
    await adapter.close();
  });

  it("keeps an autonomous Turn open until all background Subagents settle", async () => {
    const transport = new FakeOmpTransport();
    const dependencies: OmpAdapterDependencies = {
      createTransport: (options: OmpRpcSessionOptions) => {
        transport.onSubagentEvent = options.onSubagentEvent ?? null;
        return transport;
      },
    };
    const adapter = new OmpAdapter({}, dependencies);
    const opened = await adapter.open({ kind: "create", cwd: "/synthetic" });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const observed = outputs(opened.value);
    await opened.value.execute({
      type: "turn.start",
      turnId: "turn-background-parent" as HostTurnId,
      input: [{ type: "text", text: "prime background subscription" }],
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    transport.onSubagentEvent?.({
      type: "subagent.started",
      callId: "background-tool-1",
      nativeSubagentId: "background-subagent-1",
      description: "First background task",
      background: true,
    });
    transport.onSubagentEvent?.({
      type: "subagent.started",
      callId: "background-tool-2",
      nativeSubagentId: "background-subagent-2",
      description: "Second background task",
      background: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    transport.onSubagentEvent?.({
      type: "subagent.completed",
      callId: "background-tool-1",
      nativeSubagentId: "background-subagent-1",
      isError: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const afterFirst = observed
      .filter(
        (output): output is Extract<HarnessOutput, { kind: "event" }> => output.kind === "event",
      )
      .map((output) => output.event);
    const autonomousTurnIds = afterFirst
      .filter(
        (event): event is Extract<typeof event, { type: "turn.autonomous.started" }> =>
          event.type === "turn.autonomous.started",
      )
      .map((event) => event.turnId);
    expect(
      afterFirst.filter(
        (event) => event.type === "turn.completed" && autonomousTurnIds.includes(event.turnId),
      ),
    ).toHaveLength(0);
    transport.onSubagentEvent?.({
      type: "subagent.completed",
      callId: "background-tool-2",
      nativeSubagentId: "background-subagent-2",
      isError: true,
      resultSummary: "failed",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const completed = observed
      .filter(
        (output): output is Extract<HarnessOutput, { kind: "event" }> => output.kind === "event",
      )
      .map((output) => output.event)
      .filter(
        (event) => event.type === "turn.completed" && autonomousTurnIds.includes(event.turnId),
      );
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({ outcome: { status: "failed" } });
    await opened.value.close();
    await adapter.close();
  });
});
