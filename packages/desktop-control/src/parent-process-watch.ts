/**
 * Parent-death watchdog for the Desktop Controller.
 *
 * The Launcher spawns the Controller and normally stops it when the managed
 * Desktop exits. When the Launcher itself dies first (a hard kill, a crash, a
 * signal it could not handle) nothing reaps the Controller and it lingers with
 * a dead Inspector endpoint. The Controller therefore watches its parent and
 * shuts itself down as soon as the parent is gone, whatever took it down.
 */

export interface ParentProcessObservation {
  /** Parent PID captured when the watch started. */
  initialParentPid: number;
  /** Parent PID reported now; POSIX reparents an orphan to PID 1 or a subreaper. */
  currentParentPid: number;
  /** Whether the initial parent still exists (signal 0 probe). */
  parentAlive: boolean;
}

/** The parent is lost once it has been replaced or can no longer be signalled. */
export function parentProcessLost(observation: ParentProcessObservation): boolean {
  return observation.currentParentPid !== observation.initialParentPid || !observation.parentAlive;
}

/**
 * Signal-0 liveness probe. `EPERM` means the process exists but belongs to
 * another user, which still counts as alive; only `ESRCH` (or any other
 * failure) reports it gone.
 */
export function isProcessAlive(
  pid: number,
  kill: (pid: number, signal: 0) => unknown = (target, signal) => process.kill(target, signal),
): boolean {
  try {
    kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException | null)?.code === "EPERM";
  }
}

export interface WatchParentProcessOptions {
  onLost(): void;
  intervalMs?: number;
  parentPid?(): number;
  isAlive?(pid: number): boolean;
  setInterval?(callback: () => void, ms: number): NodeJS.Timeout;
  clearInterval?(timer: NodeJS.Timeout): void;
}

export const PARENT_WATCH_INTERVAL_MS = 1_000;

/**
 * Polls the parent process and calls `onLost` exactly once when it is gone.
 * Returns a function that stops the watch. The timer is unref'd so the watch
 * never keeps an otherwise finished Controller alive.
 */
export function watchParentProcess(options: WatchParentProcessOptions): () => void {
  const parentPid = options.parentPid ?? (() => process.ppid);
  const isAlive = options.isAlive ?? isProcessAlive;
  const schedule = options.setInterval ?? setInterval;
  const cancel = options.clearInterval ?? clearInterval;
  const initialParentPid = parentPid();
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    if (timer !== null) cancel(timer);
    timer = null;
  };
  timer = schedule(() => {
    if (stopped) return;
    const lost = parentProcessLost({
      initialParentPid,
      currentParentPid: parentPid(),
      parentAlive: isAlive(initialParentPid),
    });
    if (!lost) return;
    stop();
    options.onLost();
  }, options.intervalMs ?? PARENT_WATCH_INTERVAL_MS);
  timer.unref?.();
  return stop;
}
