import { describe, expect, it } from "vitest";

import { brokerHostCommandSchema } from "../src/validation.js";

const turnId = "turn-file-input";

describe("Broker Turn input validation", () => {
  it("accepts a text-only Turn exactly as before", () => {
    const parsed = brokerHostCommandSchema.safeParse({
      type: "turn.start",
      turnId,
      input: [{ type: "text", text: "hello" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a Turn carrying a file part referenced by path", () => {
    const parsed = brokerHostCommandSchema.safeParse({
      type: "turn.start",
      turnId,
      input: [
        { type: "text", text: "review this" },
        { type: "file", path: "/work/shot.png", mediaType: "image/png", bytes: 2_048 },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a file part on a steered Turn", () => {
    const parsed = brokerHostCommandSchema.safeParse({
      type: "turn.steer",
      turnId,
      input: [{ type: "file", path: "/work/notes.pdf", mediaType: "application/pdf", bytes: 10 }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects inlined bytes rather than silently ignoring them", () => {
    const parsed = brokerHostCommandSchema.safeParse({
      type: "turn.start",
      turnId,
      input: [
        {
          type: "file",
          path: "/work/shot.png",
          mediaType: "image/png",
          bytes: 2_048,
          base64Data: "AAAA",
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a file part missing its media type or size", () => {
    for (const part of [
      { type: "file", path: "/work/shot.png", bytes: 1 },
      { type: "file", path: "/work/shot.png", mediaType: "image/png" },
      { type: "file", path: "", mediaType: "image/png", bytes: 1 },
      { type: "file", path: "/work/shot.png", mediaType: "image/png", bytes: -1 },
    ]) {
      expect(
        brokerHostCommandSchema.safeParse({ type: "turn.start", turnId, input: [part] }).success,
      ).toBe(false);
    }
  });

  it("rejects an unknown input part type", () => {
    const parsed = brokerHostCommandSchema.safeParse({
      type: "turn.start",
      turnId,
      input: [{ type: "image", mimeType: "image/png", base64Data: "AAAA" }],
    });
    expect(parsed.success).toBe(false);
  });
});
