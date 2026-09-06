import { describe, expect, it } from "vitest";

import { openCodeParts } from "../src/sdk-transport.js";

describe("OpenCode file input parts", () => {
  it("keeps a lone text part when the Turn carries no file", () => {
    expect(openCodeParts("hello", [])).toEqual([{ type: "text", text: "hello" }]);
  });

  it("converts a Host path into a URL-based file part without reading bytes", () => {
    expect(
      openCodeParts("look", [
        { type: "file", path: "/work/shot.png", mediaType: "image/png", bytes: 4 },
      ]),
    ).toEqual([
      { type: "text", text: "look" },
      {
        type: "file",
        mime: "image/png",
        filename: "shot.png",
        url: "file:///work/shot.png",
      },
    ]);
  });

  it("still reaches the Agent when the Turn is attachments only", () => {
    const parts = openCodeParts("", [
      { type: "file", path: "/work/a.pdf", mediaType: "application/pdf", bytes: 1 },
    ]);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ type: "file", mime: "application/pdf" });
  });
});
