import { describe, expect, it, vi } from "vitest";
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  assertDesktopStopped,
  assertSourceLauncherInstalled,
  parseDesktopInspection,
  sourceLauncherContents,
} from "./cli.mjs";

describe("Source launcher safety", () => {
  it("refuses running Desktop after only a read-only inspect command", () => {
    const run = vi.fn(() => ({
      status: 0,
      stdout:
        "desktop_executable=/Applications/ChatGPT.app/Contents/MacOS/ChatGPT\ndesktop_process_ids=12,34\n",
    }));
    expect(() => assertDesktopStopped("/synthetic/codexhost", run)).toThrow(
      "Nothing was stopped or restarted",
    );
    expect(run.mock.calls.map((args) => args.slice(0, 2))).toEqual([
      ["/synthetic/codexhost", ["inspect"]],
    ]);
  });

  it("fails closed when installation/process ownership cannot be inspected", () => {
    expect(() =>
      assertDesktopStopped("/synthetic/codexhost", () => ({ status: 1, stdout: "" })),
    ).toThrow("no launch was attempted");
    expect(() => parseDesktopInspection("desktop_process_ids=\n")).toThrow();
    expect(() =>
      parseDesktopInspection("desktop_executable=/synthetic\ndesktop_process_ids=oops\n"),
    ).toThrow();
  });

  it("recognizes stopped Desktop without launching it", () => {
    expect(
      parseDesktopInspection("desktop_executable=/synthetic\ndesktop_process_ids=\n").processIds,
    ).toEqual([]);
  });

  it("requires an executable wrapper for this checkout before any launch", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "codexhost-source-wrapper-"));
    const destination = path.join(directory, "codexhost");
    const link = path.join(directory, "alias");
    try {
      expect(() => assertSourceLauncherInstalled(destination)).toThrow("before launch");
      writeFileSync(destination, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
      expect(() => assertSourceLauncherInstalled(destination)).toThrow("before launch");
      writeFileSync(destination, sourceLauncherContents());
      expect(() => assertSourceLauncherInstalled(destination)).not.toThrow();
      symlinkSync(destination, link);
      expect(() => assertSourceLauncherInstalled(link)).toThrow("before launch");
      if (process.platform !== "win32") {
        chmodSync(destination, 0o644);
        expect(() => assertSourceLauncherInstalled(destination)).toThrow("before launch");
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
