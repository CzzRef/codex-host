import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  InitializeResponse,
  NewSessionResponse,
  PromptResponse,
} from "@agentclientprotocol/sdk";
import type { HarnessOutput, HarnessSession } from "@codexhost/harness-adapter";
import {
  harnessInspectionSchema,
  harnessPermissionModeIdSchema,
  hostTurnIdSchema,
  nativeCheckpointRefSchema,
} from "@codexhost/shared-contracts";

import { CursorAdapter } from "../src/cursor-adapter.js";
import { cursorModelRef, cursorNativeModelId } from "../src/cursor-models.js";
import type {
  CursorTransport,
  CursorTransportOptions,
  CursorTurnCallbacks,
} from "../src/acp-transport.js";
import type { CursorNativeMessage } from "../src/cursor-history.js";

const adapters: CursorAdapter[] = [];
afterEach(async () => {
  await Promise.all(adapters.splice(0).map((adapter) => adapter.close()));
});

function nativeSession(): NewSessionResponse {
  return {
    sessionId: "native-cursor-session",
    modes: {
      currentModeId: "agent",
      availableModes: [
        { id: "agent", name: "Agent" },
        { id: "ask", name: "Ask" },
      ],
    },
    configOptions: [
      {
        id: "model",
        name: "Model",
        category: "model",
        type: "select",
        currentValue: "default[]",
        options: [
          { value: "default[]", name: "Auto" },
          { value: "gpt-5.4-mini[reasoning=medium]", name: "GPT Mini" },
        ],
      },
      {
        id: "mode",
        name: "Mode",
        category: "mode",
        type: "select",
        currentValue: "agent",
        options: [
          { value: "agent", name: "Agent" },
          { value: "ask", name: "Ask" },
        ],
      },
    ],
  };
}

function fixture() {
  let callbacks: CursorTurnCallbacks | undefined;
  let options: CursorTransportOptions | undefined;
  let finish: (result: PromptResponse) => void = () => {};
  const native = nativeSession();
  const history: CursorNativeMessage[] = [];
  const transport: CursorTransport = {
    inspect: vi.fn(async (): Promise<InitializeResponse> => ({
      protocolVersion: 1,
      agentCapabilities: { loadSession: true },
    })),
    open: vi.fn(async (input) => {
      if (input?.kind === "resume") return { ...native, sessionId: input.sessionId };
      return native;
    }),
    runTurn: vi.fn((_text, handlers) => {
      callbacks = handlers;
      return new Promise<PromptResponse>((resolve) => {
        finish = resolve;
      });
    }),
    configure: vi.fn(async (id, value) => ({
      configOptions: (native.configOptions ?? []).map((option) =>
        option.id === id ? { ...option, currentValue: value } : option,
      ),
    })),
    cancel: vi.fn(async () => {}),
    close: vi.fn(async () => {
      finish({ stopReason: "cancelled" });
    }),
    readHistory: vi.fn(async () => history),
    sessionDirectory: vi.fn((sessionId: string) => `/synthetic/acp-sessions/${sessionId}`),
  };
  const adapter = new CursorAdapter(
    {
      environment: { CODEXHOST_RUNTIME_TOKEN: "synthetic-token" },
      nativeHistorySettleTimeoutMs: 0,
    },
    (input) => {
      options = input;
      return transport;
    },
  );
  adapters.push(adapter);
  return {
    adapter,
    transport,
    get callbacks() {
      if (!callbacks) throw new Error("Test turn has not started");
      return callbacks;
    },
    get options() {
      if (!options) throw new Error("Test transport was not created");
      return options;
    },
    finish: (value: PromptResponse) => finish(value),
    history,
  };
}

async function open(f: ReturnType<typeof fixture>): Promise<HarnessSession> {
  const result = await f.adapter.open({
    kind: "create",
    cwd: "/synthetic",
    environment: { CODEXHOST_THREAD_ID: "parent" },
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function observe(session: HarnessSession) {
  const outputs: HarnessOutput[] = [];
  const done = (async () => {
    for await (const output of session.outputs) outputs.push(output);
  })();
  return { outputs, done };
}

const turnId = hostTurnIdSchema.parse("turn-1");

describe("Cursor native-history Adapter", () => {
  it("inspects without creating a native session and does not invent a model catalog", async () => {
    const f = fixture();
    const inspection = await f.adapter.inspect({ cwd: "/synthetic" });
    expect(harnessInspectionSchema.safeParse(inspection).success).toBe(true);
    expect(inspection).toMatchObject({
      status: "ready",
      catalog: { models: [] },
      capabilities: {
        configuration: { selectModel: false },
        history: { transcript: "native", fork: false },
      },
    });
    expect(f.transport.open).not.toHaveBeenCalled();
    expect(f.transport.close).toHaveBeenCalledOnce();
  });

  it("keeps the real session ID, reads native snapshots, and resumes the same session", async () => {
    const f = fixture();
    const session = await open(f);
    expect(session.initialState.nativeRef).toMatchObject({
      nativeSessionId: "native-cursor-session",
      harnessId: "cursor",
      locator: { protocol: "cursor-acp", transcript: "native" },
    });
    expect(f.options.environment).toMatchObject({
      CODEXHOST_RUNTIME_TOKEN: "synthetic-token",
      CODEXHOST_THREAD_ID: "parent",
    });
    f.history.push(
      { blobId: "user-1", role: "user", text: "hello" },
      { blobId: "asst-1", role: "assistant", text: "ok", nativeId: "native-turn-1" },
    );
    expect(await session.readSnapshot()).toMatchObject({
      ok: true,
      value: {
        turns: [
          {
            nativeTurnRef: { nativeTurnKey: "native-turn-1" },
            input: [{ type: "text", text: "hello" }],
            outcome: { status: "succeeded" },
          },
        ],
      },
    });
    const nativeRef = session.initialState.nativeRef;
    if (!nativeRef) throw new Error("Test session has no native identity");
    const resumed = await f.adapter.open({
      kind: "resume",
      cwd: "/synthetic",
      nativeRef,
    });
    expect(resumed).toMatchObject({ ok: true });
    expect(f.transport.open).toHaveBeenCalledWith({
      kind: "resume",
      sessionId: "native-cursor-session",
    });
    expect(
      await f.adapter.open({
        kind: "create",
        cwd: "/synthetic",
        executionPolicy: "unattended-full-access",
      }),
    ).toMatchObject({ ok: false, error: { code: "unsupported" } });
    expect(
      await f.adapter.open({
        kind: "fork",
        cwd: "/synthetic",
        sourceRef: nativeRef,
        checkpoint: nativeCheckpointRefSchema.parse({
          harnessId: "cursor",
          nativeSessionId: nativeRef.nativeSessionId,
          checkpointId: "1",
          formatVersion: 1,
        }),
      }),
    ).toMatchObject({ ok: false, error: { code: "unsupported" } });
  });

  it("finishes text and tools before a single successful terminal with a native Turn identity", async () => {
    const f = fixture();
    const session = await open(f);
    const observed = observe(session);
    expect(
      await session.execute({
        type: "turn.start",
        turnId,
        input: [{ type: "text", text: "synthetic" }],
      }),
    ).toEqual({ ok: true, value: { turnId } });
    const second = await session.execute({
      type: "turn.start",
      turnId: hostTurnIdSchema.parse("rejected"),
      input: [{ type: "text", text: "must not run" }],
    });
    expect(second).toMatchObject({ ok: false, error: { code: "sessionBusy" } });
    f.callbacks.update({
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "Hello" },
    });
    f.callbacks.update({
      sessionUpdate: "tool_call",
      toolCallId: "tool-1",
      title: "Read file",
      kind: "read",
      status: "in_progress",
    });
    f.callbacks.update({
      sessionUpdate: "tool_call_update",
      toolCallId: "tool-1",
      status: "completed",
      content: [{ type: "content", content: { type: "text", text: "fixture" } }],
    });
    f.callbacks.update({
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "Done" },
    });
    f.history.push(
      { blobId: "user-1", role: "user", text: "synthetic" },
      { blobId: "asst-1", role: "assistant", text: "HelloDone", nativeId: "native-turn-1" },
    );
    f.finish({ stopReason: "end_turn" });
    await vi.waitFor(() =>
      expect(observed.outputs.at(-1)).toMatchObject({
        kind: "event",
        event: { type: "turn.completed", outcome: { status: "succeeded" } },
      }),
    );
    const events = observed.outputs.flatMap((output) =>
      output.kind === "event" ? [output.event] : [],
    );
    expect(events.filter((event) => event.type === "turn.started")).toHaveLength(1);
    expect(events.filter((event) => event.type === "item.completed")).toHaveLength(3);
    expect(events.at(-1)).toMatchObject({
      type: "turn.completed",
      nativeTurnRef: { nativeTurnKey: "native-turn-1" },
    });
    await session.close();
    await observed.done;
  });

  it("steers by interrupting the prompt and re-prompting the same session inside one Turn", async () => {
    const f = fixture();
    const session = await open(f);
    expect(session.capabilities.turns).toEqual({ steer: true });
    const observed = observe(session);
    await session.execute({ type: "turn.start", turnId, input: [{ type: "text", text: "first" }] });
    f.callbacks.update({
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "partial" },
    });

    await expect(
      session.execute({ type: "turn.steer", turnId, input: [{ type: "text", text: "second" }] }),
    ).resolves.toEqual({ ok: true, value: { accepted: true } });
    expect(f.transport.cancel).toHaveBeenCalledOnce();
    expect(f.transport.runTurn).toHaveBeenCalledTimes(1);

    // The interrupted prompt settles as cancelled; the steer re-prompts the
    // same session instead of finishing the Host Turn.
    f.finish({ stopReason: "cancelled" });
    await vi.waitFor(() => expect(f.transport.runTurn).toHaveBeenCalledTimes(2));
    expect(vi.mocked(f.transport.runTurn).mock.calls[1]?.[0]).toBe("second");
    // The re-prompt is surfaced as an in-turn user item before it streams.
    expect(
      observed.outputs.some(
        (output) =>
          output.kind === "event" &&
          output.event.type === "item.completed" &&
          output.event.snapshot.item.type === "userMessage" &&
          output.event.snapshot.item.text === "second",
      ),
    ).toBe(true);
    expect(
      observed.outputs.some(
        (output) => output.kind === "event" && output.event.type === "turn.completed",
      ),
    ).toBe(false);

    f.callbacks.update({
      sessionUpdate: "agent_message_chunk",
      content: { type: "text", text: "answer" },
    });
    f.finish({ stopReason: "end_turn" });
    await f.adapter.close();
    await observed.done;
    const completed = observed.outputs.find(
      (output) => output.kind === "event" && output.event.type === "turn.completed",
    );
    expect(completed).toMatchObject({
      event: { type: "turn.completed", turnId, outcome: { status: "succeeded" } },
    });
  });

  it("uses the native terminal result when cancellation races with normal completion", async () => {
    const f = fixture();
    const session = await open(f);
    const observed = observe(session);
    await session.execute({
      type: "turn.start",
      turnId,
      input: [{ type: "text", text: "synthetic" }],
    });
    expect(await session.execute({ type: "turn.cancel", turnId })).toEqual({
      ok: true,
      value: { cancellationRequested: true },
    });
    expect(f.transport.cancel).toHaveBeenCalledOnce();
    f.finish({ stopReason: "end_turn" });
    await vi.waitFor(() =>
      expect(observed.outputs.at(-1)).toMatchObject({
        event: { type: "turn.completed", outcome: { status: "succeeded" } },
      }),
    );
  });

  it("closes a pending permission before fault and stream termination without approving it", async () => {
    const f = fixture();
    const session = await open(f);
    const observed = observe(session);
    await session.execute({
      type: "turn.start",
      turnId,
      input: [{ type: "text", text: "synthetic" }],
    });
    const permission = f.callbacks.permission({
      sessionId: "native-cursor-session",
      toolCall: { toolCallId: "t1", title: "Write file" },
      options: [{ optionId: "allow", name: "Allow once", kind: "allow_once" }],
    });
    f.options.onFault({ code: "processExited", message: "synthetic EOF", retryable: true });
    expect(await permission).toEqual({ outcome: { outcome: "cancelled" } });
    await observed.done;
    const types = observed.outputs.flatMap((output) =>
      output.kind === "event" ? [output.event.type] : ["interaction"],
    );
    expect(types).toEqual([
      "turn.started",
      "interaction",
      "interaction.closed",
      "turn.completed",
      "session.faulted",
    ]);
  });

  it("encodes native Cursor IDs losslessly and confirms model/mode changes", async () => {
    const f = fixture();
    const session = await open(f);
    const nativeId = "gpt-5.4-mini[reasoning=medium]";
    const model = cursorModelRef(nativeId);
    expect(cursorNativeModelId(model)).toBe(nativeId);
    expect(model.id).not.toMatch(/[\[\],=]/u);
    expect(await session.execute({ type: "model.select", model })).toEqual({
      ok: true,
      value: { completed: true },
    });
    expect(f.transport.configure).toHaveBeenCalledWith("model", nativeId);
    expect(
      await session.execute({
        type: "permissionMode.select",
        permissionModeId: harnessPermissionModeIdSchema.parse("ask"),
      }),
    ).toEqual({ ok: true, value: { completed: true } });
    const inspection = await f.adapter.inspect();
    expect(inspection).toMatchObject({
      status: "ready",
      catalog: { models: expect.any(Array) },
      capabilities: { configuration: { selectModel: true } },
    });
  });
});
