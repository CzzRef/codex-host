import { describe, expect, it } from "vitest";
import type { HarnessOutput, HostInteraction } from "@codexhost/harness-adapter";
import { hostTurnIdSchema } from "@codexhost/shared-contracts";
import { CursorInteractions } from "../src/cursor-interactions.js";

function fixture() {
  const outputs: HarnessOutput[] = [];
  const interactions = new CursorInteractions(hostTurnIdSchema.parse("turn"), (output) =>
    outputs.push(output),
  );
  const last = (): HostInteraction => {
    const output = outputs.findLast((item) => item.kind === "interaction");
    if (output?.kind !== "interaction") throw new Error("Missing interaction");
    return output.interaction;
  };
  return { outputs, interactions, last };
}

describe("Cursor blocking extensions", () => {
  it("validates choice IDs before answering Cursor and rejects duplicate responses", async () => {
    const f = fixture();
    const pending = f.interactions.extension("cursor/ask_question", {
      toolCallId: "t",
      questions: [
        { id: "q", prompt: "Choose", options: [{ id: "a", label: "A" }], allowMultiple: false },
      ],
    });
    const interactionId = f.last().interactionId;
    expect(
      f.interactions.respond({
        type: "interaction.respond",
        interactionId,
        response: { type: "question", answers: { q: ["unknown"] } },
      }),
    ).toMatchObject({ ok: false });
    const command = {
      type: "interaction.respond" as const,
      interactionId,
      response: { type: "question" as const, answers: { q: ["a"] } },
    };
    expect(f.interactions.respond(command)).toEqual({ ok: true, value: { accepted: true } });
    expect(await pending).toEqual({
      outcome: { outcome: "answered", answers: [{ questionId: "q", selectedOptionIds: ["a"] }] },
    });
    expect(f.interactions.respond(command)).toMatchObject({ ok: false });
  });

  it("does not accept plans or permissions when a turn is cancelled", async () => {
    const f = fixture();
    const plan = f.interactions.extension("cursor/create_plan", {
      toolCallId: "p",
      name: "Plan",
      plan: "Change fixture",
    });
    expect(f.last()).toMatchObject({ type: "approval", description: "Change fixture" });
    f.interactions.close();
    expect(await plan).toEqual({ outcome: { outcome: "cancelled" } });
    expect(f.outputs.at(-1)).toMatchObject({
      event: { type: "interaction.closed", reason: "cancelled" },
    });
  });

  it("maps a user rejection to the native option without silently permitting it", async () => {
    const f = fixture();
    const permission = f.interactions.permission({
      sessionId: "native",
      toolCall: { toolCallId: "t", title: "Run command" },
      options: [
        { optionId: "yes", name: "Allow", kind: "allow_once" },
        { optionId: "no", name: "Deny", kind: "reject_once" },
      ],
    });
    f.interactions.respond({
      type: "interaction.respond",
      interactionId: f.last().interactionId,
      response: { type: "approval", actionId: "no" },
    });
    expect(await permission).toEqual({ outcome: { outcome: "selected", optionId: "no" } });
  });
});
