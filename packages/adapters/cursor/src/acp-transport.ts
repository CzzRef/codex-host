import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { promisify } from "node:util";

import {
  ClientSideConnection,
  PROTOCOL_VERSION,
  RequestError,
  ndJsonStream,
  type InitializeResponse,
  type LoadSessionResponse,
  type NewSessionResponse,
  type PromptResponse,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionUpdate,
  type SetSessionConfigOptionResponse,
} from "@agentclientprotocol/sdk";
import { commandInvocation } from "@codexhost/harness-discovery";
import type { HarnessError } from "@codexhost/harness-adapter";

import { CursorExecutableError, resolveCursorExecutable } from "./command.js";
import {
  cursorSessionDirectory,
  locateCursorSession,
  readCursorNativeMessages,
  type CursorNativeMessage,
} from "./cursor-history.js";

const execFileAsync = promisify(execFile);

export interface CursorTransportOptions {
  cwd: string;
  command?: string;
  environment?: NodeJS.ProcessEnv;
  commandTimeoutMs?: number;
  onFault(error: HarnessError): void;
}

export interface CursorTurnCallbacks {
  update(update: SessionUpdate): void;
  permission(request: RequestPermissionRequest): Promise<RequestPermissionResponse>;
  extension(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export type CursorOpenInput = { kind: "create" } | { kind: "resume"; sessionId: string };

export interface CursorTransport {
  inspect(): Promise<InitializeResponse>;
  open(input?: CursorOpenInput): Promise<NewSessionResponse | LoadSessionResponse>;
  runTurn(text: string, callbacks: CursorTurnCallbacks): Promise<PromptResponse>;
  configure(id: "model" | "mode", value: string): Promise<SetSessionConfigOptionResponse>;
  cancel(): Promise<void>;
  close(): Promise<void>;
  readHistory(sessionId: string): Promise<CursorNativeMessage[]>;
  sessionDirectory(sessionId: string): string;
}

export class CursorTransportError extends Error {
  constructor(readonly detail: HarnessError) {
    super(detail.message);
  }
}

export function cursorError(
  error: unknown,
  fallback: HarnessError["code"] = "nativeFailure",
): HarnessError {
  if (error instanceof CursorTransportError) return error.detail;
  if (error instanceof CursorExecutableError)
    return { code: "notInstalled", message: error.message, retryable: false };
  if (error instanceof RequestError) {
    return {
      code:
        error.code === -32602
          ? "invalidRequest"
          : error.code === -32000
            ? "authenticationRequired"
            : fallback,
      message: `Cursor ACP request failed: ${error.message}`,
      retryable: false,
    };
  }
  return { code: fallback, message: "Cursor CLI operation failed", retryable: false };
}

export class CursorAcpTransport implements CursorTransport {
  readonly #options: CursorTransportOptions;
  #child: ChildProcessWithoutNullStreams | undefined;
  #connection: ClientSideConnection | undefined;
  #initialized: InitializeResponse | undefined;
  #sessionId: string | undefined;
  #callbacks: CursorTurnCallbacks | undefined;
  #closed = false;
  #closing: Promise<void> | undefined;
  #failed: CursorTransportError | undefined;
  #rejectFailure: (error: CursorTransportError) => void = () => {};
  readonly #failure = new Promise<never>((_resolve, reject) => {
    this.#rejectFailure = reject;
  });

  constructor(options: CursorTransportOptions) {
    this.#options = options;
    void this.#failure.catch(() => undefined);
  }

  #fault(message: string): void {
    if (this.#closed || this.#failed) return;
    this.#failed = new CursorTransportError({ code: "processExited", message, retryable: true });
    this.#rejectFailure(this.#failed);
    this.#options.onFault(this.#failed.detail);
  }

  async #request<T>(
    operation: Promise<T>,
    timeoutMs = this.#options.commandTimeoutMs ?? 15_000,
  ): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation,
        this.#failure,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new CursorTransportError({
                  code: "unavailable",
                  message: "Cursor ACP request timed out",
                  retryable: true,
                }),
              ),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      if (error instanceof CursorTransportError && error.detail.code === "unavailable") {
        this.#fault("Cursor ACP request timed out; its owned process was closed");
        await this.close();
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async inspect(): Promise<InitializeResponse> {
    if (this.#initialized) return this.#initialized;
    if (this.#closed)
      throw new CursorTransportError({
        code: "invalidState",
        message: "Cursor transport is closed",
        retryable: false,
      });
    const environment = { ...process.env, ...this.#options.environment };
    const command = resolveCursorExecutable({
      ...(this.#options.command ? { command: this.#options.command } : {}),
      environment,
    });
    // Do not open a browser or create a native session during inspection.
    const status = await execFileAsync(command, ["status"], {
      cwd: this.#options.cwd,
      env: environment,
      timeout: 10_000,
      maxBuffer: 64 * 1024,
    }).catch(() => {
      throw new CursorTransportError({
        code: "authenticationRequired",
        message: "Run cursor-agent login in your terminal first",
        retryable: false,
      });
    });
    if (
      !/logged in/iu.test(status.stdout + status.stderr) ||
      /not logged in/iu.test(status.stdout + status.stderr)
    ) {
      throw new CursorTransportError({
        code: "authenticationRequired",
        message: "Run cursor-agent login in your terminal first",
        retryable: false,
      });
    }
    const invocation = commandInvocation(command, ["acp"], environment, process.platform);
    const child = spawn(invocation.command, invocation.arguments, {
      cwd: this.#options.cwd,
      env: environment,
      stdio: "pipe",
      detached: process.platform !== "win32",
      windowsHide: true,
      windowsVerbatimArguments: invocation.windowsVerbatimArguments,
    });
    this.#child = child;
    child.stderr.resume();
    child.once("error", () => this.#fault("Cursor CLI failed to start"));
    child.once("exit", () => this.#fault("Cursor CLI exited"));
    this.#connection = new ClientSideConnection(
      () => ({
        sessionUpdate: async ({ sessionId, update }) => {
          if (sessionId === this.#sessionId) this.#callbacks?.update(update);
        },
        requestPermission: async (request) =>
          request.sessionId === this.#sessionId && this.#callbacks
            ? this.#callbacks.permission(request)
            : { outcome: { outcome: "cancelled" } },
        extMethod: async (method, params) => {
          if (typeof params.sessionId === "string" && params.sessionId !== this.#sessionId) {
            throw RequestError.invalidParams("Cursor extension belongs to another session");
          }
          if (!this.#callbacks) return { outcome: { outcome: "cancelled" } };
          return this.#callbacks.extension(method.replace(/^_/u, ""), params);
        },
        extNotification: async () => {},
      }),
      ndJsonStream(
        Writable.toWeb(child.stdin),
        Readable.toWeb(child.stdout) as unknown as Parameters<typeof ndJsonStream>[1],
      ),
    );
    this.#connection.signal.addEventListener(
      "abort",
      () => this.#fault("Cursor ACP connection closed"),
      { once: true },
    );
    this.#initialized = await this.#request(
      this.#connection.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientInfo: { name: "codexhost", version: "0.4.0" },
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      }),
    );
    return this.#initialized;
  }

  sessionDirectory(sessionId: string): string {
    return cursorSessionDirectory(sessionId, { ...process.env, ...this.#options.environment });
  }

  async readHistory(sessionId: string): Promise<CursorNativeMessage[]> {
    const environment = { ...process.env, ...this.#options.environment };
    const located = await locateCursorSession(sessionId, environment);
    if (!located) return [];
    return readCursorNativeMessages(located.directory);
  }

  async open(
    input: CursorOpenInput = { kind: "create" },
  ): Promise<NewSessionResponse | LoadSessionResponse> {
    const initialize = await this.inspect();
    const connection = this.#connection;
    if (!connection) throw new Error("Cursor initialization did not establish a connection");
    if (input.kind === "resume") {
      const capabilities = initialize.agentCapabilities;
      try {
        if (capabilities?.loadSession !== false) {
          const loaded = await this.#request(
            connection.loadSession({
              cwd: this.#options.cwd,
              mcpServers: [],
              sessionId: input.sessionId,
            }),
          );
          this.#sessionId = input.sessionId;
          return loaded;
        }
      } catch (error) {
        if (!(error instanceof RequestError) || error.code !== -32601) throw error;
      }
      if (capabilities?.sessionCapabilities?.resume) {
        const resumed = await this.#request(
          connection.resumeSession({
            cwd: this.#options.cwd,
            mcpServers: [],
            sessionId: input.sessionId,
          }),
        );
        this.#sessionId = input.sessionId;
        return resumed;
      }
      throw new CursorTransportError({
        code: "unsupported",
        message: "Cursor ACP does not advertise session load or resume",
        retryable: false,
      });
    }
    // newSession reuses Cursor's local login. authenticate can open a browser and must not run here.
    const response = await this.#request(
      connection.newSession({ cwd: this.#options.cwd, mcpServers: [] }),
    );
    this.#sessionId = response.sessionId;
    return response;
  }

  async runTurn(text: string, callbacks: CursorTurnCallbacks): Promise<PromptResponse> {
    if (!this.#sessionId || !this.#connection || this.#closed)
      throw new CursorTransportError({
        code: "invalidState",
        message: "Cursor session is not open",
        retryable: false,
      });
    this.#callbacks = callbacks;
    try {
      return await this.#request(
        this.#connection.prompt({ sessionId: this.#sessionId, prompt: [{ type: "text", text }] }),
        30 * 60_000,
      );
    } finally {
      this.#callbacks = undefined;
    }
  }

  async configure(id: "model" | "mode", value: string): Promise<SetSessionConfigOptionResponse> {
    if (!this.#connection || !this.#sessionId) throw new Error("Cursor session is not open");
    return this.#request(
      this.#connection.setSessionConfigOption({ sessionId: this.#sessionId, configId: id, value }),
    );
  }

  async cancel(): Promise<void> {
    if (this.#connection && this.#sessionId && !this.#closed) {
      await this.#request(this.#connection.cancel({ sessionId: this.#sessionId }));
    }
  }

  close(): Promise<void> {
    if (this.#closing) return this.#closing;
    this.#closed = true;
    this.#closing = (async () => {
      const child = this.#child;
      if (!child) return;
      const killOwned = (signal: NodeJS.Signals) => {
        try {
          if (process.platform !== "win32" && child.pid) process.kill(-child.pid, signal);
          else child.kill(signal);
        } catch {
          /* The owned process group has already exited. */
        }
      };
      child.stdin.end();
      if (child.exitCode === null && child.signalCode === null) {
        await new Promise<void>((resolve, reject) => {
          let hardTimer: NodeJS.Timeout | undefined;
          const timer = setTimeout(() => {
            killOwned("SIGKILL");
            hardTimer = setTimeout(
              () =>
                reject(
                  new CursorTransportError({
                    code: "processExited",
                    message: "Cursor process cleanup could not be confirmed",
                    retryable: false,
                  }),
                ),
              1_500,
            );
          }, 1_500);
          child.once("exit", () => {
            clearTimeout(timer);
            if (hardTimer) clearTimeout(hardTimer);
            resolve();
          });
          killOwned("SIGTERM");
        });
      }
      child.stdout.destroy();
      child.stderr.destroy();
    })();
    return this.#closing;
  }
}
