import { PassThrough } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { DELEGATION_HELP, runDelegationCli } from "../src/delegation-cli.js";
import {
  DELEGATION_RUNTIME_ENDPOINT_ENV,
  DELEGATION_RUNTIME_TOKEN_ENV,
  DELEGATION_THREAD_ID_ENV,
} from "../src/delegation-types.js";

function outputText(stream: PassThrough): string {
  return stream.read()?.toString() ?? "";
}

function successfulFetch(body: unknown): typeof fetch {
  return vi.fn(
    async () => new Response(JSON.stringify(body), { status: 200 }),
  ) as unknown as typeof fetch;
}

describe("delegation CLI", () => {
  it("prints the authoritative help", async () => {
    const output = new PassThrough();
    await expect(runDelegationCli({ arguments: ["delegate", "--help"], output })).resolves.toBe(0);
    expect(outputText(output)).toBe(DELEGATION_HELP);
  });

  it("inspects Harness configuration through the Runtime", async () => {
    const fetchImpl = successfulFetch({ harnessId: "pi", inspection: { status: "ready" } });
    const output = new PassThrough();
    await expect(
      runDelegationCli({
        arguments: ["harness", "inspect", "pi", "--cwd", "/synthetic", "--refresh", "true"],
        environment: {
          [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
          [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
        },
        output,
        fetchImpl,
      }),
    ).resolves.toBe(0);
    const firstCall = vi.mocked(fetchImpl).mock.calls[0];
    if (!firstCall) throw new Error("Runtime fetch was not called");
    expect(String(firstCall[0])).toContain("/v1/harness/inspect");
    expect(JSON.parse(String(firstCall[1]?.body))).toEqual({
      harnessId: "pi",
      cwd: "/synthetic",
      refresh: true,
    });
  });

  it("normalizes deep links and sends delegate start as JSON", async () => {
    const fetchImpl = successfulFetch({ threadId: "child-1" });
    const output = new PassThrough();
    const environment = {
      [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
      [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
    };
    await expect(
      runDelegationCli({
        arguments: [
          "delegate",
          "start",
          "--harness",
          "claude-code",
          "--task",
          "review auth",
          "--model",
          "model-ref",
          "--thinking",
          "high",
          "--permission-mode",
          "acceptEdits",
          "--parent-thread",
          "codex://threads/parent-1",
          "--request-id",
          "request-1",
        ],
        environment,
        output,
        fetchImpl,
      }),
    ).resolves.toBe(0);
    const firstCall = vi.mocked(fetchImpl).mock.calls[0];
    if (!firstCall) throw new Error("Runtime fetch was not called");
    const [, init] = firstCall;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      harnessId: "claude-code",
      task: "review auth",
      parentThreadId: "parent-1",
      requestId: "request-1",
      model: { id: "model-ref" },
      thinkingOptionId: "high",
      permissionModeId: "acceptEdits",
    });
    expect(JSON.parse(outputText(output))).toEqual({ threadId: "child-1" });
  });

  it("uses the Host-provided current Thread when --parent-thread is omitted", async () => {
    const fetchImpl = successfulFetch({ threadId: "child-1" });
    await expect(
      runDelegationCli({
        arguments: ["delegate", "start", "--harness", "pi", "--task", "review"],
        environment: {
          [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
          [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
          [DELEGATION_THREAD_ID_ENV]: "parent-from-environment",
        },
        output: new PassThrough(),
        fetchImpl,
      }),
    ).resolves.toBe(0);
    const call = vi.mocked(fetchImpl).mock.calls[0];
    if (!call) throw new Error("Runtime fetch was not called");
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({
      parentThreadId: "parent-from-environment",
    });
  });

  it("sends follow-up messages and cancellation requests using deep links", async () => {
    const fetchImpl = successfulFetch({ ok: true });
    const environment = {
      [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
      [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
    };
    await expect(
      runDelegationCli({
        arguments: ["thread", "send", "codex://threads/child-1", "--message", "continue"],
        environment,
        output: new PassThrough(),
        fetchImpl,
      }),
    ).resolves.toBe(0);
    await expect(
      runDelegationCli({
        arguments: ["thread", "cancel", "codex://threads/child-1"],
        environment,
        output: new PassThrough(),
        fetchImpl,
      }),
    ).resolves.toBe(0);
    const sendCall = vi.mocked(fetchImpl).mock.calls[0];
    const cancelCall = vi.mocked(fetchImpl).mock.calls[1];
    if (!sendCall || !cancelCall) throw new Error("Expected send and cancel Runtime calls");
    expect(String(sendCall[0])).toContain("/v1/thread/send");
    expect(JSON.parse(String(sendCall[1]?.body))).toEqual({
      threadId: "child-1",
      message: "continue",
    });
    expect(String(cancelCall[0])).toContain("/v1/thread/cancel");
    expect(JSON.parse(String(cancelCall[1]?.body))).toEqual({ threadId: "child-1" });
  });

  it("passes --steer true through to the Runtime send and rejects other values", async () => {
    const fetchImpl = successfulFetch({ ok: true });
    const environment = {
      [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
      [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
    };
    await expect(
      runDelegationCli({
        arguments: ["thread", "send", "child-1", "--message", "now do this", "--steer", "true"],
        environment,
        output: new PassThrough(),
        fetchImpl,
      }),
    ).resolves.toBe(0);
    const sendCall = vi.mocked(fetchImpl).mock.calls[0];
    if (!sendCall) throw new Error("Expected a send Runtime call");
    expect(JSON.parse(String(sendCall[1]?.body))).toEqual({
      threadId: "child-1",
      message: "now do this",
      steer: true,
    });
    const errorOutput = new PassThrough();
    await expect(
      runDelegationCli({
        arguments: ["thread", "send", "child-1", "--message", "x", "--steer", "maybe"],
        environment,
        output: errorOutput,
        fetchImpl,
      }),
    ).resolves.not.toBe(0);
    expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
  });

  it("rejects message cursors on the default result view", async () => {
    const diagnosticOutput = new PassThrough();
    await expect(
      runDelegationCli({
        arguments: ["thread", "read", "thread-1", "--cursor", "cursor-1"],
        environment: {},
        diagnosticOutput,
      }),
    ).resolves.toBe(1);
    expect(JSON.parse(outputText(diagnosticOutput))).toMatchObject({
      error: { code: "INVALID_ARGUMENT" },
    });
  });

  it("applies wait and list defaults", async () => {
    const fetchImpl = successfulFetch({ ok: true });
    const environment = {
      [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
      [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
    };
    await runDelegationCli({
      arguments: ["thread", "wait", "thread-1"],
      environment,
      output: new PassThrough(),
      fetchImpl,
    });
    await runDelegationCli({
      arguments: ["thread", "list"],
      environment,
      output: new PassThrough(),
      fetchImpl,
    });
    const waitCall = vi.mocked(fetchImpl).mock.calls[0];
    const listCall = vi.mocked(fetchImpl).mock.calls[1];
    if (!waitCall || !listCall) throw new Error("Expected wait and list Runtime calls");
    expect(JSON.parse(String(waitCall[1]?.body))).toMatchObject({
      threadId: "thread-1",
      view: "result",
      timeoutMs: 30_000,
    });
    expect(JSON.parse(String(listCall[1]?.body))).toMatchObject({
      limit: 25,
      sort: "created-desc",
    });
  });

  it.each([
    ["invalid view", ["thread", "read", "thread-1", "--view", "raw"]],
    ["invalid timeout", ["thread", "wait", "thread-1", "--timeout-ms", "0"]],
    [
      "invalid message limit",
      ["thread", "read", "thread-1", "--view", "messages", "--limit", "101"],
    ],
    ["missing send message", ["thread", "send", "thread-1"]],
    ["cancel option", ["thread", "cancel", "thread-1", "--message", "no"]],
    ["invalid list limit", ["thread", "list", "--limit", "101"]],
    ["invalid sort", ["thread", "list", "--sort", "newest"]],
    ["invalid all flag", ["thread", "list", "--all", "yes"]],
    ["invalid archived flag", ["thread", "list", "--archived", "yes"]],
    ["all true with cwd", ["thread", "list", "--all", "true", "--cwd", "/synthetic"]],
  ])("rejects %s before contacting Runtime", async (_name, arguments_) => {
    const diagnosticOutput = new PassThrough();
    const fetchImpl = successfulFetch({ ok: true });
    await expect(
      runDelegationCli({ arguments: arguments_, environment: {}, diagnosticOutput, fetchImpl }),
    ).resolves.toBe(1);
    expect(JSON.parse(outputText(diagnosticOutput))).toMatchObject({
      error: { code: "INVALID_ARGUMENT" },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("requests archived Threads when --archived true", async () => {
    const fetchImpl = successfulFetch({ threads: [], nextCursor: null });
    const output = new PassThrough();
    await expect(
      runDelegationCli({
        arguments: ["thread", "list", "--all", "true", "--archived", "true"],
        environment: {
          [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
          [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
        },
        output,
        fetchImpl,
      }),
    ).resolves.toBe(0);
    const firstCall = vi.mocked(fetchImpl).mock.calls[0];
    if (!firstCall) throw new Error("Runtime fetch was not called");
    expect(JSON.parse(String(firstCall[1]?.body))).toEqual({
      archived: true,
      limit: 25,
      sort: "created-desc",
    });
  });

  it("keeps the live listing when --archived false", async () => {
    const fetchImpl = successfulFetch({ threads: [], nextCursor: null });
    const output = new PassThrough();
    await expect(
      runDelegationCli({
        arguments: ["thread", "list", "--all", "true", "--archived", "false"],
        environment: {
          [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
          [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
        },
        output,
        fetchImpl,
      }),
    ).resolves.toBe(0);
    const firstCall = vi.mocked(fetchImpl).mock.calls[0];
    if (!firstCall) throw new Error("Runtime fetch was not called");
    expect(JSON.parse(String(firstCall[1]?.body))).toEqual({
      limit: 25,
      sort: "created-desc",
    });
  });

  it("lists every extra process when --all true omits cwd", async () => {
    const fetchImpl = successfulFetch({ threads: [], nextCursor: null });
    const output = new PassThrough();
    await expect(
      runDelegationCli({
        arguments: ["thread", "list", "--all", "true", "--limit", "50", "--sort", "recency-desc"],
        environment: {
          [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
          [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
        },
        output,
        fetchImpl,
      }),
    ).resolves.toBe(0);
    const firstCall = vi.mocked(fetchImpl).mock.calls[0];
    if (!firstCall) throw new Error("Runtime fetch was not called");
    expect(String(firstCall[0])).toContain("/v1/thread/list");
    expect(JSON.parse(String(firstCall[1]?.body))).toEqual({
      limit: 50,
      sort: "recency-desc",
    });
  });

  it("keeps the caller cwd when --all is false", async () => {
    const fetchImpl = successfulFetch({ threads: [], nextCursor: null });
    const output = new PassThrough();
    await expect(
      runDelegationCli({
        arguments: ["thread", "list", "--all", "false"],
        environment: {
          [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
          [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
        },
        output,
        fetchImpl,
      }),
    ).resolves.toBe(0);
    const firstCall = vi.mocked(fetchImpl).mock.calls[0];
    if (!firstCall) throw new Error("Runtime fetch was not called");
    expect(JSON.parse(String(firstCall[1]?.body))).toEqual({
      cwd: process.cwd(),
      limit: 25,
      sort: "created-desc",
    });
  });

  it("renames the current extra process through the Runtime", async () => {
    const fetchImpl = successfulFetch({ threadId: "thread-1", title: "260901-CodexHost完成态" });
    const output = new PassThrough();
    await expect(
      runDelegationCli({
        arguments: ["thread", "rename", "--name", "260901-CodexHost完成态"],
        environment: {
          [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
          [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
          [DELEGATION_THREAD_ID_ENV]: "thread-1",
        },
        output,
        fetchImpl,
      }),
    ).resolves.toBe(0);
    const firstCall = vi.mocked(fetchImpl).mock.calls[0];
    if (!firstCall) throw new Error("Runtime fetch was not called");
    expect(String(firstCall[0])).toContain("/v1/thread/rename");
    expect(JSON.parse(String(firstCall[1]?.body))).toEqual({
      threadId: "thread-1",
      name: "260901-CodexHost完成态",
    });
    expect(JSON.parse(outputText(output))).toEqual({
      threadId: "thread-1",
      title: "260901-CodexHost完成态",
    });
  });

  it("pins and unpins an extra process through the Runtime", async () => {
    const cases = [
      { arguments: ["thread", "pin"], threadId: "thread-1", pinned: true },
      { arguments: ["thread", "unpin"], threadId: "thread-1", pinned: false },
      { arguments: ["thread", "pin", "codex://threads/thread-2"], threadId: "thread-2", pinned: true },
    ];
    for (const testCase of cases) {
      const fetchImpl = successfulFetch({ threadId: testCase.threadId, pinned: testCase.pinned });
      const output = new PassThrough();
      await expect(
        runDelegationCli({
          arguments: testCase.arguments,
          environment: {
            [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
            [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
            [DELEGATION_THREAD_ID_ENV]: "thread-1",
          },
          output,
          fetchImpl,
        }),
      ).resolves.toBe(0);
      const firstCall = vi.mocked(fetchImpl).mock.calls[0];
      if (!firstCall) throw new Error("Runtime fetch was not called");
      expect(String(firstCall[0])).toContain("/v1/thread/pin");
      expect(JSON.parse(String(firstCall[1]?.body))).toEqual({
        threadId: testCase.threadId,
        pinned: testCase.pinned,
      });
      expect(JSON.parse(outputText(output))).toEqual({
        threadId: testCase.threadId,
        pinned: testCase.pinned,
      });
    }
  });

  it("archives and unarchives an extra process through the Runtime", async () => {
    const cases = [
      { arguments: ["thread", "archive"], threadId: "thread-1", archived: true },
      { arguments: ["thread", "unarchive"], threadId: "thread-1", archived: false },
      {
        arguments: ["thread", "archive", "codex://threads/thread-2"],
        threadId: "thread-2",
        archived: true,
      },
    ];
    for (const testCase of cases) {
      const fetchImpl = successfulFetch({
        threadId: testCase.threadId,
        archived: testCase.archived,
      });
      const output = new PassThrough();
      await expect(
        runDelegationCli({
          arguments: testCase.arguments,
          environment: {
            [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
            [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
            [DELEGATION_THREAD_ID_ENV]: "thread-1",
          },
          output,
          fetchImpl,
        }),
      ).resolves.toBe(0);
      const firstCall = vi.mocked(fetchImpl).mock.calls[0];
      if (!firstCall) throw new Error("Runtime fetch was not called");
      expect(String(firstCall[0])).toContain("/v1/thread/archive");
      expect(JSON.parse(String(firstCall[1]?.body))).toEqual({
        threadId: testCase.threadId,
        archived: testCase.archived,
      });
      expect(JSON.parse(outputText(output))).toEqual({
        threadId: testCase.threadId,
        archived: testCase.archived,
      });
    }
  });

  it("rejects thread archive without a Thread identifier before contacting the Runtime", async () => {
    const fetchImpl = successfulFetch({});
    const diagnosticOutput = new PassThrough();
    await expect(
      runDelegationCli({
        arguments: ["thread", "archive"],
        environment: {
          [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
          [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
        },
        output: new PassThrough(),
        diagnosticOutput,
        fetchImpl,
      }),
    ).resolves.toBe(1);
    expect(vi.mocked(fetchImpl)).not.toHaveBeenCalled();
    expect(JSON.parse(outputText(diagnosticOutput))).toMatchObject({
      error: { code: "INVALID_ARGUMENT" },
    });
  });

  it("preserves structured Runtime errors", async () => {
    const diagnosticOutput = new PassThrough();
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "THREAD_NOT_FOUND",
              message: "Thread was not found",
              details: { thread: "missing" },
            },
          }),
          { status: 400 },
        ),
    ) as unknown as typeof fetch;
    await expect(
      runDelegationCli({
        arguments: ["thread", "read", "missing"],
        environment: {
          [DELEGATION_RUNTIME_ENDPOINT_ENV]: "http://127.0.0.1:4321",
          [DELEGATION_RUNTIME_TOKEN_ENV]: "token",
        },
        diagnosticOutput,
        fetchImpl,
      }),
    ).resolves.toBe(1);
    expect(JSON.parse(outputText(diagnosticOutput))).toEqual({
      error: {
        code: "THREAD_NOT_FOUND",
        message: "Thread was not found",
        details: { thread: "missing" },
      },
    });
  });

  it("fails with structured Runtime errors and does not discover a fallback", async () => {
    const diagnosticOutput = new PassThrough();
    await expect(
      runDelegationCli({
        arguments: ["thread", "read", "thread-1"],
        environment: { PATH: "/synthetic" },
        diagnosticOutput,
      }),
    ).resolves.toBe(1);
    expect(JSON.parse(outputText(diagnosticOutput))).toMatchObject({
      error: { code: "RUNTIME_UNREACHABLE" },
    });
  });
});
