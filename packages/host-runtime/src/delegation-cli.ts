import type { Writable } from "node:stream";

import {
  DELEGATION_RUNTIME_ENDPOINT_ENV,
  DELEGATION_RUNTIME_TOKEN_ENV,
  DELEGATION_THREAD_ID_ENV,
  DelegationControlError,
  type DelegationControlErrorCode,
} from "./delegation-types.js";

const DEFAULT_WAIT_TIMEOUT_MS = 30_000;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function normalizeThreadId(value: string): string {
  const prefix = "codex://threads/";
  const normalized = value.startsWith(prefix) ? value.slice(prefix.length) : value;
  if (!normalized || normalized.includes("/") || normalized.includes("?")) {
    throw new DelegationControlError("INVALID_ARGUMENT", "Thread identifier is invalid");
  }
  return normalized;
}

function positiveInteger(value: string | undefined, name: string, maximum?: number): number {
  const number = Number(value);
  if (!value || !Number.isSafeInteger(number) || number <= 0 || (maximum && number > maximum)) {
    throw new DelegationControlError(
      "INVALID_ARGUMENT",
      `${name} must be a positive integer${maximum ? ` no greater than ${maximum}` : ""}`,
    );
  }
  return number;
}

function options(arguments_: readonly string[]): {
  positionals: string[];
  options: Map<string, string>;
} {
  const positionals: string[] = [];
  const parsed = new Map<string, string>();
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (!argument) continue;
    if (!argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }
    if (parsed.has(argument))
      throw new DelegationControlError("INVALID_ARGUMENT", `${argument} may only be provided once`);
    const value = arguments_[index + 1];
    if (!value || value.startsWith("--"))
      throw new DelegationControlError("INVALID_ARGUMENT", `${argument} requires a value`);
    parsed.set(argument, value);
    index += 1;
  }
  return { positionals, options: parsed };
}

function value(parsed: ReturnType<typeof options>, name: string): string | undefined {
  return parsed.options.get(name);
}

function rejectUnknown(parsed: ReturnType<typeof options>, allowed: readonly string[]): void {
  const known = new Set(allowed);
  for (const name of parsed.options.keys()) {
    if (!known.has(name))
      throw new DelegationControlError("INVALID_ARGUMENT", `Unknown option '${name}'`);
  }
}

export const DELEGATION_HELP = `usage:
  codexhost harness inspect <harness> [--cwd <path>] [--refresh true|false]
  codexhost delegate start --harness <id> --task <text> [--model <opaque-ref>] [--thinking <option-id>] [--permission-mode <mode-id>] [--parent-thread <thread>] [--request-id <id>]
  codexhost thread send <thread> --message <text> [--steer true|false]
  codexhost thread cancel <thread>
  codexhost thread read <thread> [--view result|messages] [--cursor <cursor>] [--limit <n>]
  codexhost thread wait <thread> [--timeout-ms <n>] [--view result|messages] [--cursor <cursor>] [--limit <n>]
  codexhost thread list [--cwd <path>] [--all true|false] [--archived true|false] [--parent <thread>] [--limit <n>] [--cursor <cursor>] [--sort created-asc|created-desc|updated-asc|updated-desc|recency-asc|recency-desc]
  codexhost thread rename [<thread>] --name <title>
  codexhost thread archive [<thread>]
  codexhost thread unarchive [<thread>]
  codexhost thread pin [<thread>]
  codexhost thread unpin [<thread>]

Thread identifiers accept a bare ID or codex://threads/<id>. Output is JSON by default.
harness inspect returns the target Model catalog, default Model, Thinking options, Permission Modes, and configuration capabilities without creating a Thread. Use opaque IDs exactly as returned.
delegate start requires --harness and --task, creates and submits the child Thread, then returns immediately. --model and --thinking select values returned by harness inspect. Omit either option to preserve that target's current default behavior. --permission-mode selects a Permission Mode id from harness inspect permissionModes for the whole child Thread; a child started from the CLI has no Desktop approver, so a protected tool call under the default mode is denied and interrupts the Turn. Harnesses without a Permission Mode catalog, and native Codex, reject the option with INVALID_ARGUMENT. --parent-thread overrides caller inference. Reuse --request-id for idempotent retries; without it, identical recent parent/target/task/configuration requests are deduplicated briefly.
Successful start fields: delegationId, threadId, turnId, harnessId, deepLink, status, next.read, next.wait.
thread send starts a new Turn in an idle writable Thread and returns immediately. It fails with THREAD_BUSY instead of queueing or starting a concurrent Turn. --steer true injects the message into the running Turn through the Harness's native steer (same Host Turn, delivered at its next safe gap) and returns that Turn; a Harness without native steer still fails with THREAD_BUSY.
thread cancel requests cancellation of the current Turn while preserving the Thread. An idle Thread returns cancelled=false.
thread read is non-blocking. Its default result view returns threadId, harnessId, status, latest turn, visible progress, result.availability/result.text, and nextCursor.
thread read --view messages additionally returns paginated user/Agent-visible messages. The default page is 25 and --limit is capped at 100; --cursor and --limit require the messages view. Tool calls, tool output, file activity, reasoning summaries, hidden reasoning, and private Harness transcripts are never returned.
thread wait defaults to 30000 ms and waits only until the Thread reaches a terminal state or the bounded timeout expires. A timeout is a successful running checkpoint with timedOut=true; the child keeps running.
thread list defaults to the caller cwd, limit 25, created-desc; limit is capped at 100. --all true lists every extra process regardless of cwd. --archived true lists archived Threads instead of live ones; external rows always carry archived. --parent uses Delegation lineage, not Codex Subagent relationships.
thread rename persists the Host Thread title and emits the same thread/name/updated notification Desktop uses, so Codex sidebar updates without a restart. Omit <thread> to use CODEXHOST_THREAD_ID. A Desktop hand-set title is not overwritten.
thread archive persists the Host archive state for an extra process and emits the same thread/archived notification a Desktop archive does, so the row leaves the sidebar and the live thread list at once; thread unarchive reverses it with thread/unarchived. Neither stops a running Turn. Omit <thread> to use CODEXHOST_THREAD_ID. Native Codex Threads are not accepted; archive them in Desktop.
thread pin moves an extra process into the Desktop Pinned section exactly like a sidebar pin (the Host persists pinned and the section); thread unpin moves it back out. thread list reports the state as pinned on external rows. Codex publishes no section notification, so the Desktop sidebar reflects a CLI pin on its next thread/list, not the same frame. Omit <thread> to use CODEXHOST_THREAD_ID. Native Codex Threads are not accepted; pin them in Desktop or through the app-server.
read and wait are non-consuming: they do not start a Turn, send input, wake an Agent, mark messages read, or inject a result into the parent Session.
Native Codex as caller requires a session sandbox that permits local Runtime connections; otherwise RUNTIME_UNREACHABLE is returned. Native Codex as a target uses brokered official requests and is unaffected.

Errors are JSON: {"error":{"code":"...","message":"...","details":{...}}}.
INVALID_ARGUMENT: fix the named argument or incompatible option combination.
HARNESS_NOT_FOUND: choose a Harness ID listed in error.details.validHarnessIds.
THREAD_NOT_FOUND: verify the bare ID or codex:// deep link.
THREAD_BUSY: wait for or cancel the active Turn before sending another message, or resend with --steer true when the Harness supports native steer.
PARENT_THREAD_AMBIGUOUS: pass --parent-thread explicitly.
RUNTIME_UNREACHABLE: run inside the Host-provided environment and, for native Codex, allow local Runtime connections; codexhost never falls back to PATH or another Runtime.
DELEGATION_FAILED: the target Session or initial task delivery failed and no successful child was published.
INTERNAL_ERROR: retry after checking the Host Runtime diagnostics.
`;

async function requestRuntime(input: {
  environment: NodeJS.ProcessEnv;
  path: string;
  body: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}): Promise<unknown> {
  const endpoint = input.environment[DELEGATION_RUNTIME_ENDPOINT_ENV];
  const token = input.environment[DELEGATION_RUNTIME_TOKEN_ENV];
  if (!endpoint || !token) {
    throw new DelegationControlError(
      "RUNTIME_UNREACHABLE",
      `${DELEGATION_RUNTIME_ENDPOINT_ENV} and ${DELEGATION_RUNTIME_TOKEN_ENV} are required`,
    );
  }
  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(new URL(input.path, endpoint), {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(input.body),
    });
  } catch (error) {
    throw new DelegationControlError(
      "RUNTIME_UNREACHABLE",
      "Host Runtime could not be reached. If this command runs inside native Codex, use a session sandbox that permits local Runtime connections or run the command explicitly outside the sandbox.",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
  const body = (await response.json()) as {
    error?: { code?: unknown; message?: unknown; details?: unknown };
  };
  if (!response.ok || body.error) {
    const code = typeof body.error?.code === "string" ? body.error.code : "INTERNAL_ERROR";
    const message =
      typeof body.error?.message === "string" ? body.error.message : "Runtime request failed";
    throw new DelegationControlError(
      code as DelegationControlErrorCode,
      message,
      body.error?.details as Record<string, unknown> | undefined,
    );
  }
  return body;
}

function writeJson(output: Writable, value: unknown): void {
  output.write(`${JSON.stringify(value, null, 2)}\n`);
}

export async function runDelegationCli(input: {
  arguments: string[];
  environment?: NodeJS.ProcessEnv;
  output?: Writable;
  diagnosticOutput?: Writable;
  fetchImpl?: typeof fetch;
}): Promise<number> {
  const output = input.output ?? process.stdout;
  const diagnosticOutput = input.diagnosticOutput ?? process.stderr;
  const environment = input.environment ?? process.env;
  try {
    const [group, command, ...rest] = input.arguments;
    if (
      (group === "delegate" && (!command || command === "--help" || command === "help")) ||
      group === "--help" ||
      group === "-h"
    ) {
      output.write(DELEGATION_HELP);
      return 0;
    }
    if (group === "harness" && command === "inspect") {
      const parsed = options(rest);
      rejectUnknown(parsed, ["--cwd", "--refresh"]);
      if (parsed.positionals.length !== 1) {
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          "harness inspect requires one Harness identifier",
        );
      }
      const harnessId = parsed.positionals[0];
      if (!harnessId) {
        throw new DelegationControlError("INVALID_ARGUMENT", "Harness identifier is required");
      }
      const refresh = value(parsed, "--refresh");
      if (refresh !== undefined && refresh !== "true" && refresh !== "false") {
        throw new DelegationControlError("INVALID_ARGUMENT", "--refresh must be true or false");
      }
      writeJson(
        output,
        await requestRuntime({
          environment,
          path: "/v1/harness/inspect",
          body: {
            harnessId,
            ...(value(parsed, "--cwd") ? { cwd: value(parsed, "--cwd") } : {}),
            ...(refresh !== undefined ? { refresh: refresh === "true" } : {}),
          },
          ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
        }),
      );
      return 0;
    }
    if (group === "delegate" && command === "start") {
      const parsed = options(rest);
      rejectUnknown(parsed, [
        "--harness",
        "--task",
        "--model",
        "--thinking",
        "--permission-mode",
        "--parent-thread",
        "--request-id",
      ]);
      if (parsed.positionals.length > 0)
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          "delegate start accepts no positional arguments",
        );
      const harnessId = value(parsed, "--harness");
      const task = value(parsed, "--task");
      if (!harnessId || !task)
        throw new DelegationControlError("INVALID_ARGUMENT", "--harness and --task are required");
      const parentThread =
        value(parsed, "--parent-thread") ?? environment[DELEGATION_THREAD_ID_ENV];
      writeJson(
        output,
        await requestRuntime({
          environment,
          path: "/v1/delegate/start",
          body: {
            harnessId,
            task,
            cwd: process.cwd(),
            ...(value(parsed, "--model") ? { model: { id: value(parsed, "--model") } } : {}),
            ...(value(parsed, "--thinking")
              ? { thinkingOptionId: value(parsed, "--thinking") }
              : {}),
            ...(value(parsed, "--permission-mode")
              ? { permissionModeId: value(parsed, "--permission-mode") }
              : {}),
            ...(parentThread ? { parentThreadId: normalizeThreadId(parentThread) } : {}),
            ...(value(parsed, "--request-id") ? { requestId: value(parsed, "--request-id") } : {}),
          },
          ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
        }),
      );
      return 0;
    }
    if (group === "thread" && command === "send") {
      const parsed = options(rest);
      rejectUnknown(parsed, ["--message", "--steer"]);
      if (parsed.positionals.length !== 1) {
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          "thread send requires one Thread identifier",
        );
      }
      const threadId = parsed.positionals[0];
      const message = value(parsed, "--message");
      if (!threadId || !message?.trim()) {
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          "Thread identifier and --message are required",
        );
      }
      const steerValue = value(parsed, "--steer");
      if (steerValue !== undefined && steerValue !== "true" && steerValue !== "false") {
        throw new DelegationControlError("INVALID_ARGUMENT", "--steer must be true or false");
      }
      writeJson(
        output,
        await requestRuntime({
          environment,
          path: "/v1/thread/send",
          body: {
            threadId: normalizeThreadId(threadId),
            message,
            ...(steerValue === "true" ? { steer: true } : {}),
          },
          ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
        }),
      );
      return 0;
    }
    if (group === "thread" && command === "cancel") {
      const parsed = options(rest);
      rejectUnknown(parsed, []);
      if (parsed.positionals.length !== 1) {
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          "thread cancel requires one Thread identifier",
        );
      }
      const threadId = parsed.positionals[0];
      if (!threadId) {
        throw new DelegationControlError("INVALID_ARGUMENT", "Thread identifier is required");
      }
      writeJson(
        output,
        await requestRuntime({
          environment,
          path: "/v1/thread/cancel",
          body: { threadId: normalizeThreadId(threadId) },
          ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
        }),
      );
      return 0;
    }
    if (group === "thread" && (command === "read" || command === "wait")) {
      const parsed = options(rest);
      rejectUnknown(parsed, ["--view", "--cursor", "--limit", "--timeout-ms"]);
      if (parsed.positionals.length !== 1)
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          `thread ${command} requires one Thread identifier`,
        );
      const view = value(parsed, "--view") ?? "result";
      if (view !== "result" && view !== "messages")
        throw new DelegationControlError("INVALID_ARGUMENT", "--view must be result or messages");
      if (view === "result" && (value(parsed, "--cursor") || value(parsed, "--limit")))
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          "--cursor and --limit require --view messages",
        );
      if (command === "read" && value(parsed, "--timeout-ms"))
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          "--timeout-ms is valid only for thread wait",
        );
      const threadId = parsed.positionals[0];
      if (!threadId)
        throw new DelegationControlError("INVALID_ARGUMENT", "Thread identifier is required");
      const body = {
        threadId: normalizeThreadId(threadId),
        view,
        ...(value(parsed, "--cursor") ? { cursor: value(parsed, "--cursor") } : {}),
        ...(value(parsed, "--limit")
          ? { limit: positiveInteger(value(parsed, "--limit"), "--limit", MAX_LIMIT) }
          : {}),
        ...(command === "wait"
          ? {
              timeoutMs: value(parsed, "--timeout-ms")
                ? positiveInteger(value(parsed, "--timeout-ms"), "--timeout-ms")
                : DEFAULT_WAIT_TIMEOUT_MS,
            }
          : {}),
      };
      writeJson(
        output,
        await requestRuntime({
          environment,
          path: command === "read" ? "/v1/thread/read" : "/v1/thread/wait",
          body,
          ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
        }),
      );
      return 0;
    }
    if (group === "thread" && command === "rename") {
      const parsed = options(rest);
      rejectUnknown(parsed, ["--name"]);
      const name = value(parsed, "--name");
      if (!name) {
        throw new DelegationControlError("INVALID_ARGUMENT", "thread rename requires --name");
      }
      const positional = parsed.positionals[0];
      const threadId = positional || environment[DELEGATION_THREAD_ID_ENV];
      if (!threadId) {
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          "thread rename requires a Thread identifier or CODEXHOST_THREAD_ID",
        );
      }
      if (parsed.positionals.length > 1) {
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          "thread rename accepts at most one Thread identifier",
        );
      }
      writeJson(
        output,
        await requestRuntime({
          environment,
          path: "/v1/thread/rename",
          body: { threadId: normalizeThreadId(threadId), name },
          ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
        }),
      );
      return 0;
    }
    if (group === "thread" && (command === "archive" || command === "unarchive")) {
      const parsed = options(rest);
      rejectUnknown(parsed, []);
      const positional = parsed.positionals[0];
      const threadId = positional || environment[DELEGATION_THREAD_ID_ENV];
      if (!threadId) {
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          `thread ${command} requires a Thread identifier or CODEXHOST_THREAD_ID`,
        );
      }
      if (parsed.positionals.length > 1) {
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          `thread ${command} accepts at most one Thread identifier`,
        );
      }
      writeJson(
        output,
        await requestRuntime({
          environment,
          path: "/v1/thread/archive",
          body: { threadId: normalizeThreadId(threadId), archived: command === "archive" },
          ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
        }),
      );
      return 0;
    }
    if (group === "thread" && (command === "pin" || command === "unpin")) {
      const parsed = options(rest);
      rejectUnknown(parsed, []);
      const positional = parsed.positionals[0];
      const threadId = positional || environment[DELEGATION_THREAD_ID_ENV];
      if (!threadId) {
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          `thread ${command} requires a Thread identifier or CODEXHOST_THREAD_ID`,
        );
      }
      if (parsed.positionals.length > 1) {
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          `thread ${command} accepts at most one Thread identifier`,
        );
      }
      writeJson(
        output,
        await requestRuntime({
          environment,
          path: "/v1/thread/pin",
          body: { threadId: normalizeThreadId(threadId), pinned: command === "pin" },
          ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
        }),
      );
      return 0;
    }
    if (group === "thread" && command === "list") {
      const parsed = options(rest);
      rejectUnknown(parsed, [
        "--cwd",
        "--all",
        "--archived",
        "--parent",
        "--limit",
        "--cursor",
        "--sort",
      ]);
      if (parsed.positionals.length > 0)
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          "thread list accepts no positional arguments",
        );
      const sort = value(parsed, "--sort") ?? "created-desc";
      if (
        !new Set([
          "created-asc",
          "created-desc",
          "updated-asc",
          "updated-desc",
          "recency-asc",
          "recency-desc",
        ]).has(sort)
      )
        throw new DelegationControlError("INVALID_ARGUMENT", "--sort is invalid");
      const parentThread = value(parsed, "--parent");
      const all = value(parsed, "--all");
      if (all !== undefined && all !== "true" && all !== "false") {
        throw new DelegationControlError("INVALID_ARGUMENT", "--all must be true or false");
      }
      if (all === "true" && value(parsed, "--cwd")) {
        throw new DelegationControlError(
          "INVALID_ARGUMENT",
          "--all true cannot be combined with --cwd",
        );
      }
      const archived = value(parsed, "--archived");
      if (archived !== undefined && archived !== "true" && archived !== "false") {
        throw new DelegationControlError("INVALID_ARGUMENT", "--archived must be true or false");
      }
      writeJson(
        output,
        await requestRuntime({
          environment,
          path: "/v1/thread/list",
          body: {
            ...(all === "true" ? {} : { cwd: value(parsed, "--cwd") ?? process.cwd() }),
            ...(archived === "true" ? { archived: true } : {}),
            ...(parentThread ? { parentThreadId: normalizeThreadId(parentThread) } : {}),
            limit: value(parsed, "--limit")
              ? positiveInteger(value(parsed, "--limit"), "--limit", MAX_LIMIT)
              : DEFAULT_LIMIT,
            ...(value(parsed, "--cursor") ? { cursor: value(parsed, "--cursor") } : {}),
            sort,
          },
          ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
        }),
      );
      return 0;
    }
    throw new DelegationControlError(
      "INVALID_ARGUMENT",
      "Unknown delegation command. Run 'codexhost delegate --help'.",
    );
  } catch (error) {
    const normalized =
      error instanceof DelegationControlError
        ? error
        : new DelegationControlError(
            "INTERNAL_ERROR",
            error instanceof Error ? error.message : String(error),
          );
    writeJson(diagnosticOutput, {
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details ? { details: normalized.details } : {}),
      },
    });
    return 1;
  }
}
