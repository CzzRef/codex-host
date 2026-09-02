import { randomUUID } from "node:crypto";
import { createPatch } from "diff";

import type {
  SessionUpdate,
  ToolCall,
  ToolCallContent,
  ToolCallUpdate,
} from "@agentclientprotocol/sdk";
import type {
  HarnessOutput,
  HostAgentMessageItem,
  HostCommandExecutionItem,
  HostEvent,
  HostItem,
  HostItemOutcome,
  HostReasoningItem,
  HostToolExecutionItem,
  TurnOutcome,
} from "@codexhost/harness-adapter";
import { hostItemIdSchema, jsonValueSchema, type HostTurnId } from "@codexhost/shared-contracts";

import { CursorInteractions } from "./cursor-interactions.js";

type ToolItem = HostCommandExecutionItem | HostToolExecutionItem;
interface ActiveTool {
  item: ToolItem;
  content: ToolCallContent[];
}
const OUTPUT_LIMIT = 64_000;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function outputText(value: unknown): string {
  if (value === undefined || value === null) return "";
  return (typeof value === "string" ? value : JSON.stringify(value)).slice(0, OUTPUT_LIMIT);
}

export class CursorTurn {
  readonly interactions: CursorInteractions;
  readonly #tools = new Map<string, ActiveTool>();
  readonly #completedTools = new Set<string>();
  #text: HostAgentMessageItem | HostReasoningItem | undefined;
  #finished = false;
  cancellationRequested = false;
  /** Steer text waiting for the interrupted prompt to settle before it is re-prompted. */
  pendingSteer: string | undefined;

  constructor(
    readonly turnId: HostTurnId,
    readonly emit: (output: HarnessOutput) => void,
  ) {
    this.interactions = new CursorInteractions(turnId, emit);
  }

  #event(event: HostEvent): void {
    this.emit({ kind: "event", event });
  }

  #complete(item: HostItem, outcome: HostItemOutcome): void {
    this.#event({
      type: "item.completed",
      turnId: this.turnId,
      snapshot: { item: structuredClone(item), outcome },
    });
  }

  #closeText(outcome: HostItemOutcome = { status: "succeeded" }): void {
    if (!this.#text) return;
    this.#complete(this.#text, outcome);
    this.#text = undefined;
  }

  update(update: SessionUpdate): void {
    if (this.#finished) return;
    if (
      update.sessionUpdate === "agent_message_chunk" ||
      update.sessionUpdate === "agent_thought_chunk"
    ) {
      if (update.content.type !== "text") return;
      const type = update.sessionUpdate === "agent_message_chunk" ? "agentMessage" : "reasoning";
      if (this.#text?.type !== type) this.#closeText();
      const item: HostAgentMessageItem | HostReasoningItem = this.#text ?? {
        type,
        itemId: hostItemIdSchema.parse(randomUUID()),
        text: "",
      };
      if (!this.#text) {
        this.#event({ type: "item.started", turnId: this.turnId, item: { ...item } });
      }
      this.#text = item;
      item.text += update.content.text;
      this.#event({
        type: "item.updated",
        turnId: this.turnId,
        itemId: item.itemId,
        update: { type: "text.append", text: update.content.text },
      });
    } else if (
      update.sessionUpdate === "tool_call" ||
      update.sessionUpdate === "tool_call_update"
    ) {
      this.#closeText();
      this.#tool(update);
    }
  }

  #tool(update: ToolCall | ToolCallUpdate): void {
    if (this.#completedTools.has(update.toolCallId)) return;
    let active = this.#tools.get(update.toolCallId);
    if (!active) {
      const input = jsonValueSchema.safeParse(update.rawInput);
      const command =
        record(update.rawInput) && typeof update.rawInput.command === "string"
          ? update.rawInput.command
          : undefined;
      const itemId = hostItemIdSchema.parse(randomUUID());
      const item: ToolItem =
        update.kind === "execute" && command
          ? { type: "commandExecution", itemId, command }
          : {
              type: "toolExecution",
              itemId,
              toolName: update.name ?? update.title ?? "Cursor tool",
              arguments: input.success ? input.data : {},
            };
      active = { item, content: [] };
      this.#tools.set(update.toolCallId, active);
      this.#event({ type: "item.started", turnId: this.turnId, item: structuredClone(item) });
    }
    if (update.content) active.content = update.content;
    const contentText = active.content
      .flatMap((part) =>
        part.type === "content" && part.content.type === "text" ? [part.content.text] : [],
      )
      .join("\n");
    const text = (contentText || outputText(update.rawOutput)).slice(0, OUTPUT_LIMIT);
    if (text) {
      if (active.item.type === "commandExecution") {
        active.item.output = text;
      } else {
        active.item.output = {
          content: [{ type: "text", text }],
          ...(text.length >= OUTPUT_LIMIT ? { truncated: true } : {}),
        };
        this.#event({
          type: "item.updated",
          turnId: this.turnId,
          itemId: active.item.itemId,
          update: { type: "output.replace", output: active.item.output },
        });
      }
    }
    if (update.status !== "completed" && update.status !== "failed") return;
    const outcome: HostItemOutcome =
      update.status === "completed"
        ? { status: "succeeded" }
        : {
            status: "failed",
            error: { code: "nativeFailure", message: "Cursor tool failed", retryable: false },
          };
    this.#complete(active.item, outcome);
    if (update.status === "completed") {
      const changes = active.content.flatMap((part) =>
        part.type === "diff"
          ? [
              {
                path: part.path,
                kind: part.oldText == null ? ("add" as const) : ("update" as const),
                unifiedDiff: createPatch(part.path, part.oldText ?? "", part.newText),
              },
            ]
          : [],
      );
      if (changes.length > 0) {
        const item: HostItem = {
          type: "fileChange",
          itemId: hostItemIdSchema.parse(randomUUID()),
          changes,
        };
        this.#event({ type: "item.started", turnId: this.turnId, item });
        this.#complete(item, { status: "succeeded" });
      }
    }
    this.#tools.delete(update.toolCallId);
    this.#completedTools.add(update.toolCallId);
  }

  finish(outcome: TurnOutcome): void {
    if (this.#finished) return;
    this.#finished = true;
    this.interactions.close();
    this.#closeText(outcome);
    for (const active of this.#tools.values()) {
      this.#complete(
        active.item,
        outcome.status === "succeeded"
          ? {
              status: "failed",
              error: {
                code: "protocolError",
                message: "Cursor ended its turn without a terminal tool result",
                retryable: false,
              },
            }
          : outcome,
      );
    }
    this.#tools.clear();
    // ACP supplies no durable native message ID. Do not manufacture a NativeTurnRef.
    this.#event({ type: "turn.completed", turnId: this.turnId, outcome });
  }
}
