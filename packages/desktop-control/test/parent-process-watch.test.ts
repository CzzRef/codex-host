import { describe, expect, it, vi } from "vitest";

import {
  isProcessAlive,
  parentProcessLost,
  watchParentProcess,
} from "../src/parent-process-watch.js";

describe("Desktop Controller parent watch", () => {
  it("treats a replaced or unreachable parent as lost", () => {
    expect(
      parentProcessLost({ initialParentPid: 40, currentParentPid: 40, parentAlive: true }),
    ).toBe(false);
    // POSIX reparents an orphan to PID 1 (or a subreaper) once the Launcher dies.
    expect(
      parentProcessLost({ initialParentPid: 40, currentParentPid: 1, parentAlive: false }),
    ).toBe(true);
    // Windows keeps the stale PPID, so the liveness probe must decide alone.
    expect(
      parentProcessLost({ initialParentPid: 40, currentParentPid: 40, parentAlive: false }),
    ).toBe(true);
  });

  it("counts a foreign-owned parent as alive and a missing one as gone", () => {
    expect(isProcessAlive(40, () => undefined)).toBe(true);
    expect(
      isProcessAlive(40, () => {
        throw Object.assign(new Error("denied"), { code: "EPERM" });
      }),
    ).toBe(true);
    expect(
      isProcessAlive(40, () => {
        throw Object.assign(new Error("gone"), { code: "ESRCH" });
      }),
    ).toBe(false);
  });

  it("fires onLost once when the Launcher disappears, then stops polling", () => {
    vi.useFakeTimers();
    try {
      let parent = 40;
      const alive = new Set([40]);
      const onLost = vi.fn();
      const stop = watchParentProcess({
        onLost,
        intervalMs: 100,
        parentPid: () => parent,
        isAlive: (pid) => alive.has(pid),
      });
      vi.advanceTimersByTime(350);
      expect(onLost).not.toHaveBeenCalled();
      alive.delete(40);
      parent = 1;
      vi.advanceTimersByTime(100);
      expect(onLost).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1_000);
      expect(onLost).toHaveBeenCalledTimes(1);
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops cleanly before the parent is ever lost", () => {
    vi.useFakeTimers();
    try {
      const onLost = vi.fn();
      const stop = watchParentProcess({
        onLost,
        intervalMs: 100,
        parentPid: () => 40,
        isAlive: () => true,
      });
      stop();
      vi.advanceTimersByTime(1_000);
      expect(onLost).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
