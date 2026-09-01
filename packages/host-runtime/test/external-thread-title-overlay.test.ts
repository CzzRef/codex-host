import { describe, expect, it } from "vitest";

import {
  overlayThreadIdFromFilename,
  parseCodexhostTitleOverlay,
  titleOverlayPath,
} from "../src/external-thread-title-overlay.js";

describe("Host title overlay", () => {
  it("parses the sidecar payload used by every extra-process Agent", () => {
    expect(parseCodexhostTitleOverlay({ title: "260901-Host标题Overlay" })).toBe(
      "260901-Host标题Overlay",
    );
    expect(parseCodexhostTitleOverlay({ session_summary: "from-summary" })).toBe("from-summary");
    expect(parseCodexhostTitleOverlay({})).toBeUndefined();
  });

  it("maps overlay filenames to Host Thread ids", () => {
    expect(overlayThreadIdFromFilename("589d6365-9a78-4886-aa3f-e00802091132.json")).toBe(
      "589d6365-9a78-4886-aa3f-e00802091132",
    );
    expect(overlayThreadIdFromFilename("readme.txt")).toBeUndefined();
    expect(titleOverlayPath("/tmp/overlays", "thread-1")).toBe("/tmp/overlays/thread-1.json");
  });
});
