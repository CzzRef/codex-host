import { describe, expect, it } from "vitest";

import { hostInputFiles, hostInputText } from "../src/index.js";
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
