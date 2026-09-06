import { describe, expect, it } from "vitest";

import {
  hostFileInputLine,
  hostInputFiles,
  hostInputPromptText,
  hostInputText,
} from "../src/index.js";
import type { HostInput } from "../src/index.js";

const text = (value: string): HostInput => ({ type: "text", text: value });
const file = (path: string): HostInput => ({
  type: "file",
  path,
  mediaType: "image/png",
  bytes: 1_024,
});

describe("Turn input parts", () => {
  it("joins text parts exactly as Adapters did before file parts existed", () => {
    expect(hostInputText([text("first"), text("second")])).toBe("first\nsecond");
    expect(hostInputText([])).toBe("");
  });

  it("keeps file parts out of the joined text instead of stringifying them", () => {
    const input = [text("look at this"), file("/work/shot.png")];
    expect(hostInputText(input)).toBe("look at this");
    expect(hostInputText(input)).not.toContain("shot.png");
  });

  it("exposes file parts separately in Host order", () => {
    const input = [file("/work/a.png"), text("between"), file("/work/b.png")];
    expect(hostInputFiles(input).map((part) => part.path)).toEqual(["/work/a.png", "/work/b.png"]);
    expect(hostInputFiles([text("only text")])).toEqual([]);
  });
});

describe("Text-only degradation", () => {
  it("keeps the user text unchanged when there is no file part", () => {
    expect(hostInputPromptText([text("plain")])).toBe("plain");
  });

  it("appends one deterministic line per file part instead of dropping it", () => {
    const line = hostInputPromptText([text("review"), file("/work/shot.png")]);
    expect(line).toBe("review\n[attachment] /work/shot.png (image/png, 1024 bytes)");
    expect(line.startsWith("review")).toBe(true);
  });

  it("degrades a file-only Turn without a leading blank line", () => {
    expect(hostInputPromptText([file("/work/shot.png")])).toBe(
      "[attachment] /work/shot.png (image/png, 1024 bytes)",
    );
  });

  it("never lets a path introduce extra lines", () => {
    const sneaky = hostFileInputLine({
      type: "file",
      path: "/work/a\nb\r\n[attachment] /etc/passwd",
      mediaType: "image/png",
      bytes: 1,
    });
    expect(sneaky.split("\n")).toHaveLength(1);
  });
});
