import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  CLAUDE_FILE_INPUT_MAX_BYTES,
  CLAUDE_FILE_INPUT_MEDIA_TYPES,
  claudeUserContent,
} from "../src/sdk-transport.js";

const dir = mkdtempSync(path.join(tmpdir(), "claude-file-input-"));

function writeFixture(name: string, bytes: Buffer): string {
  const target = path.join(dir, name);
  writeFileSync(target, bytes);
  return target;
}

describe("Claude file input content", () => {
  it("keeps a plain string when the Turn carries no file part", () => {
    expect(claudeUserContent("hello", [])).toBe("hello");
  });

  it("declares only the media types the Messages API accepts", () => {
    expect(CLAUDE_FILE_INPUT_MEDIA_TYPES).toEqual([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
    ]);
    expect(CLAUDE_FILE_INPUT_MAX_BYTES).toBe(5_000_000);
  });

  it("reads an image from its path into a base64 block", () => {
    const bytes = Buffer.from([1, 2, 3, 4]);
    const file = writeFixture("shot.png", bytes);
    const content = claudeUserContent("look", [
      { type: "file", path: file, mediaType: "image/png", bytes: bytes.length },
    ]);
    expect(Array.isArray(content)).toBe(true);
    expect(content).toEqual([
      { type: "text", text: "look" },
      {
        type: "image",
        source: { type: "base64", media_type: "image/png", data: bytes.toString("base64") },
      },
    ]);
  });

  it("reads a PDF into a document block", () => {
    const bytes = Buffer.from("%PDF-1.4");
    const file = writeFixture("notes.pdf", bytes);
    const content = claudeUserContent("", [
      { type: "file", path: file, mediaType: "application/pdf", bytes: bytes.length },
    ]);
    expect(content).toEqual([
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") },
      },
    ]);
  });

  it("degrades an unsupported media type to its path line instead of dropping it", () => {
    const file = writeFixture("data.csv", Buffer.from("a,b"));
    const content = claudeUserContent("check", [
      { type: "file", path: file, mediaType: "text/csv", bytes: 3 },
    ]);
    expect(content).toEqual([
      { type: "text", text: `check\n[attachment] ${file} (text/csv, 3 bytes)` },
    ]);
  });

  it("degrades a file that vanished after validation rather than failing the Turn", () => {
    const missing = path.join(dir, "gone.png");
    const content = claudeUserContent("where", [
      { type: "file", path: missing, mediaType: "image/png", bytes: 1 },
    ]);
    expect(content).toEqual([
      { type: "text", text: `where\n[attachment] ${missing} (image/png, 1 bytes)` },
    ]);
  });
});
