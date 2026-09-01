import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { locateGrokNativeSession } from "../src/acp-transport.js";
import {
  GROK_CODEXHOST_TITLE_OVERLAY_FILE,
  parseGrokCodexhostTitleOverlay,
  parseGrokSummaryTitle,
  resolveGrokNativeTitle,
} from "../src/grok-title-overlay.js";

describe("Grok CodexHost title overlay", () => {
  it("prefers the sidecar overlay over a later Grok summary flush", () => {
    expect(
      resolveGrokNativeTitle({
        summary: {
          session_summary: "260901-Grok中途Steer插入",
          title_is_manual: true,
        },
        overlay: {
          title: "260901-Grok标题Host复用",
          title_is_manual: true,
        },
      }),
    ).toEqual({ text: "260901-Grok标题Host复用", source: "user" });
  });

  it("falls back to summary.json when no overlay exists", () => {
    expect(parseGrokCodexhostTitleOverlay(undefined)).toBeUndefined();
    expect(
      parseGrokSummaryTitle({
        session_summary: "260901-Grok中途Steer插入",
        title_is_manual: true,
      }),
    ).toEqual({ text: "260901-Grok中途Steer插入", source: "user" });
  });

  it("locates the overlay title even when summary.json was overwritten", async () => {
    const grokHome = await mkdtemp(path.join(os.tmpdir(), "codexhost-grok-title-"));
    const sessionId = "01a0title-0000-7000-8000-000000000001";
    const cwd = "/source/project";
    const sessionDir = path.join(grokHome, "sessions", encodeURIComponent(cwd), sessionId);
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      path.join(sessionDir, "summary.json"),
      JSON.stringify({
        info: { id: sessionId, cwd },
        session_summary: "stale in-memory title",
        title_is_manual: true,
      }),
    );
    await writeFile(
      path.join(sessionDir, GROK_CODEXHOST_TITLE_OVERLAY_FILE),
      JSON.stringify({
        title: "260901-Grok标题Host复用",
        title_is_manual: true,
      }),
    );
    await expect(
      locateGrokNativeSession({ environment: { GROK_HOME: grokHome } }, sessionId),
    ).resolves.toEqual({
      cwd: path.resolve(cwd),
      title: { text: "260901-Grok标题Host复用", source: "user" },
    });
  });
});
