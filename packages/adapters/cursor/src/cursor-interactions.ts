import { randomUUID } from "node:crypto";

import {
  RequestError,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
} from "@agentclientprotocol/sdk";
import {
  validateHostInteractionResponse,
  type HarnessOutput,
  type HarnessResult,
  type HostApprovalInteraction,
  type HostInteraction,
  type HostQuestionInteraction,
  type InteractionRespondAccepted,
  type InteractionRespondCommand,
} from "@codexhost/harness-adapter";
import {
  hostInteractionIdSchema,
  type HostInteractionId,
  type HostTurnId,
} from "@codexhost/shared-contracts";

interface PendingInteraction {
  interaction: HostInteraction;
  respond(command: InteractionRespondCommand): void;
  cancel(): void;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class CursorInteractions {
  readonly #pending = new Map<HostInteractionId, PendingInteraction>();

  constructor(
    readonly turnId: HostTurnId,
    readonly emit: (output: HarnessOutput) => void,
  ) {}

  permission(request: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    if (request.options.length === 0) return Promise.resolve({ outcome: { outcome: "cancelled" } });
    const interaction: HostApprovalInteraction = {
      type: "approval",
      interactionId: hostInteractionIdSchema.parse(randomUUID()),
      turnId: this.turnId,
      title: request.toolCall.title ?? "Cursor requests permission",
      subject: { type: "nativeAction" },
      actions: request.options.map((option) => ({
        id: option.optionId,
        label: option.name,
        effect:
          option.kind === "allow_once"
            ? "allowOnce"
            : option.kind === "allow_always"
              ? "allowAlways"
              : "deny",
      })),
    };
    return new Promise((resolve) => {
      this.#pending.set(interaction.interactionId, {
        interaction,
        respond: (command) => {
          if (command.response.type === "approval")
            resolve({ outcome: { outcome: "selected", optionId: command.response.actionId } });
        },
        cancel: () => resolve({ outcome: { outcome: "cancelled" } }),
      });
      this.emit({ kind: "interaction", interaction });
    });
  }

  extension(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (method === "cursor/ask_question") return this.#question(params);
    if (method === "cursor/create_plan") return this.#plan(params);
    throw new RequestError(-32601, `Unsupported Cursor extension: ${method}`);
  }

  #question(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!Array.isArray(params.questions) || params.questions.length === 0)
      throw new RequestError(-32602, "Cursor question payload is invalid");
    const questions: HostQuestionInteraction["questions"] = params.questions.map((question) => {
      if (
        !record(question) ||
        typeof question.id !== "string" ||
        typeof question.prompt !== "string" ||
        !Array.isArray(question.options)
      )
        throw new RequestError(-32602, "Cursor question payload is invalid");
      return {
        type: "choice",
        id: question.id,
        prompt: question.prompt,
        options: question.options.map((option) => {
          if (!record(option) || typeof option.id !== "string" || typeof option.label !== "string")
            throw new RequestError(-32602, "Cursor question option is invalid");
          return { value: option.id, label: option.label };
        }),
        multiple: question.allowMultiple === true,
        allowOther: false,
        optional: false,
      };
    });
    const interaction: HostQuestionInteraction = {
      type: "question",
      interactionId: hostInteractionIdSchema.parse(randomUUID()),
      turnId: this.turnId,
      ...(typeof params.title === "string" ? { title: params.title } : {}),
      questions,
    };
    return new Promise((resolve) => {
      this.#pending.set(interaction.interactionId, {
        interaction,
        respond: (command) => {
          if (command.response.type !== "question") return;
          resolve(
            command.response.cancelled
              ? { outcome: { outcome: "cancelled" } }
              : {
                  outcome: {
                    outcome: "answered",
                    answers: Object.entries(command.response.answers).map(
                      ([questionId, selectedOptionIds]) => ({ questionId, selectedOptionIds }),
                    ),
                  },
                },
          );
        },
        cancel: () => resolve({ outcome: { outcome: "cancelled" } }),
      });
      this.emit({ kind: "interaction", interaction });
    });
  }

  #plan(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (typeof params.plan !== "string")
      throw new RequestError(-32602, "Cursor plan payload is invalid");
    const interaction: HostApprovalInteraction = {
      type: "approval",
      interactionId: hostInteractionIdSchema.parse(randomUUID()),
      turnId: this.turnId,
      title: typeof params.name === "string" ? params.name : "Approve Cursor plan",
      description: params.plan,
      subject: { type: "nativeAction" },
      actions: [
        { id: "accept", label: "Accept plan", effect: "allowOnce" },
        { id: "reject", label: "Reject plan", effect: "deny" },
      ],
    };
    return new Promise((resolve) => {
      this.#pending.set(interaction.interactionId, {
        interaction,
        respond: (command) => {
          if (command.response.type !== "approval") return;
          resolve(
            command.response.actionId === "accept"
              ? { outcome: { outcome: "accepted" } }
              : { outcome: { outcome: "rejected", reason: "User rejected the plan" } },
          );
        },
        cancel: () => resolve({ outcome: { outcome: "cancelled" } }),
      });
      this.emit({ kind: "interaction", interaction });
    });
  }

  respond(command: InteractionRespondCommand): HarnessResult<InteractionRespondAccepted> {
    const pending = this.#pending.get(command.interactionId);
    if (!pending)
      return {
        ok: false,
        error: {
          code: "invalidState",
          message: "Cursor interaction is no longer pending",
          retryable: false,
        },
      };
    const error = validateHostInteractionResponse(pending.interaction, command.response);
    if (error) return { ok: false, error };
    this.#pending.delete(command.interactionId);
    this.emit({
      kind: "event",
      event: {
        type: "interaction.closed",
        interactionId: command.interactionId,
        turnId: this.turnId,
        reason: "responded",
      },
    });
    pending.respond(command);
    return { ok: true, value: { accepted: true } };
  }

  close(): void {
    for (const [interactionId, pending] of this.#pending) {
      this.emit({
        kind: "event",
        event: {
          type: "interaction.closed",
          interactionId,
          turnId: this.turnId,
          reason: "cancelled",
        },
      });
      pending.cancel();
    }
    this.#pending.clear();
  }
}
