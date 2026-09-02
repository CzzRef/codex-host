import { execFile } from "node:child_process";
import { watch, type FSWatcher } from "node:fs";
import { realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";
import { promisify } from "node:util";

import {
  THREAD_WORKSPACE_REPOSITORY_MAX_LENGTH,
  type ThreadWorkspaceRepository,
} from "@codexhost/shared-contracts";

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 8_000;
const WATCH_DEBOUNCE_MS = 200;

export interface GitWorkspaceInspection {
  cwd: string;
  repositories: ThreadWorkspaceRepository[];
  watchPaths: string[];
}

export interface ThreadWorkspaceWatch {
  track(threadId: string, inspection: GitWorkspaceInspection): void;
  dispose(): void;
}

const gitEnv: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_OPTIONAL_LOCKS: "0",
  GIT_TERMINAL_PROMPT: "0",
  LC_ALL: "C",
};

async function git(cwd: string, args: readonly string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], {
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: 1_048_576,
      env: gitEnv,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

function asDirectory(path: string): string {
  return normalize(path).replace(/[/\\]+$/u, "");
}

async function realDirectory(path: string): Promise<string> {
  try {
    return asDirectory(await realpath(path));
  } catch {
    return asDirectory(path);
  }
}

function parseNumstat(output: string | null): { addedLines: number; deletedLines: number } {
  let addedLines = 0;
  let deletedLines = 0;
  if (!output) return { addedLines, deletedLines };
  for (const line of output.split("\n")) {
    const match = /^(\d+|-)\t(\d+|-)\t/u.exec(line);
    if (!match) continue;
    if (match[1] !== "-") addedLines += Number(match[1]);
    if (match[2] !== "-") deletedLines += Number(match[2]);
  }
  return { addedLines, deletedLines };
}

function parseWorktreePaths(output: string | null): string[] {
  if (!output) return [];
  const paths: string[] = [];
  for (const line of output.split("\n")) {
    const match = /^worktree (.+)$/u.exec(line);
    if (match?.[1]) paths.push(match[1].trim());
  }
  return [...new Set(paths)];
}

function parseSubmodulePaths(output: string | null): string[] {
  if (!output) return [];
  const paths: string[] = [];
  for (const line of output.split("\n")) {
    const staged = /^160000 [0-9a-f]{7,40} \d+\t(.+)$/u.exec(line);
    if (staged?.[1]) {
      paths.push(staged[1]);
      continue;
    }
    const status = /^[ \-+U][0-9a-f]{7,40} (\S+)/u.exec(line);
    if (status?.[1]) paths.push(status[1]);
  }
  return [...new Set(paths)];
}

async function describeRepository(
  root: string,
  kind: ThreadWorkspaceRepository["kind"],
): Promise<{ repository: ThreadWorkspaceRepository; watchPaths: string[] } | null> {
  const toplevel = await git(root, ["rev-parse", "--show-toplevel"]);
  if (!toplevel) return null;
  const resolvedRoot = await realDirectory(toplevel);
  const gitDirRaw = await git(resolvedRoot, ["rev-parse", "--absolute-git-dir"]);
  const commonDirRaw = await git(resolvedRoot, ["rev-parse", "--git-common-dir"]);
  const branchName = await git(resolvedRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const headSha = await git(resolvedRoot, ["rev-parse", "--short", "HEAD"]);
  if (!gitDirRaw || !headSha) return null;
  const gitDir = await realDirectory(
    isAbsolute(gitDirRaw) ? gitDirRaw : resolve(resolvedRoot, gitDirRaw),
  );
  const commonDir = await realDirectory(
    commonDirRaw
      ? isAbsolute(commonDirRaw)
        ? commonDirRaw
        : resolve(resolvedRoot, commonDirRaw)
      : gitDir,
  );
  const expectedGitDir = await realDirectory(join(resolvedRoot, ".git"));
  const isWorktree = gitDir !== expectedGitDir;
  const primaryRoot =
    basename(commonDir) === ".git" ? await realDirectory(dirname(commonDir)) : resolvedRoot;
  const dirtyOutput = await git(resolvedRoot, [
    "status",
    "--porcelain",
    "--untracked-files=normal",
  ]);
  const stats = parseNumstat(await git(resolvedRoot, ["diff", "--numstat", "HEAD"]));
  const watchPaths = [...new Set([gitDir, join(gitDir, "HEAD"), join(commonDir, "HEAD")])];
  return {
    repository: {
      root: resolvedRoot,
      name: basename(resolvedRoot),
      kind,
      branch: branchName && branchName !== "HEAD" ? branchName : null,
      headSha,
      isWorktree,
      worktreeName: isWorktree ? basename(resolvedRoot) : null,
      primaryRoot,
      addedLines: stats.addedLines,
      deletedLines: stats.deletedLines,
      dirty: Boolean(dirtyOutput),
    },
    watchPaths,
  };
}

async function pushRepository(
  repositories: ThreadWorkspaceRepository[],
  watchPaths: Set<string>,
  root: string,
  kind: ThreadWorkspaceRepository["kind"],
): Promise<void> {
  if (repositories.length >= THREAD_WORKSPACE_REPOSITORY_MAX_LENGTH) return;
  const described = await describeRepository(root, kind);
  if (!described) return;
  if (repositories.some((repository) => repository.root === described.repository.root)) return;
  repositories.push(described.repository);
  for (const path of described.watchPaths) watchPaths.add(path);
}

export async function inspectGitWorkspace(
  cwd: string,
  extraRoots: readonly string[] = [],
): Promise<GitWorkspaceInspection> {
  const resolvedCwd = await realDirectory(cwd);
  const toplevel = await git(resolvedCwd, ["rev-parse", "--show-toplevel"]);
  if (!toplevel) {
    return { cwd: resolvedCwd, repositories: [], watchPaths: [] };
  }
  const primary = await describeRepository(toplevel, "primary");
  if (!primary) return { cwd: resolvedCwd, repositories: [], watchPaths: [] };
  const repositories: ThreadWorkspaceRepository[] = [primary.repository];
  const watchPaths = new Set(primary.watchPaths);
  const submoduleOutput =
    (await git(primary.repository.root, ["ls-files", "--stage"])) ??
    (await git(primary.repository.root, ["submodule", "status", "--recursive"]));
  for (const relativePath of parseSubmodulePaths(submoduleOutput)) {
    const submoduleRoot = resolve(primary.repository.root, relativePath);
    if (!submoduleRoot.startsWith(`${primary.repository.root}${sep}`)) continue;
    await pushRepository(repositories, watchPaths, submoduleRoot, "submodule");
  }
  const worktreeOutput = await git(primary.repository.root, ["worktree", "list", "--porcelain"]);
  for (const worktreeRoot of parseWorktreePaths(worktreeOutput)) {
    await pushRepository(repositories, watchPaths, worktreeRoot, "worktree");
  }
  for (const extraRoot of extraRoots) {
    if (typeof extraRoot !== "string" || extraRoot.trim().length === 0) continue;
    await pushRepository(repositories, watchPaths, extraRoot, "additional");
  }
  return { cwd: resolvedCwd, repositories, watchPaths: [...watchPaths] };
}

export function createThreadWorkspaceWatch(
  notify: (threadId: string) => void,
): ThreadWorkspaceWatch {
  const threadsByCwd = new Map<string, Set<string>>();
  const cwdByThread = new Map<string, string>();
  const watchersByCwd = new Map<string, FSWatcher[]>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let disposed = false;

  const emit = (cwd: string): void => {
    const existing = timers.get(cwd);
    if (existing) clearTimeout(existing);
    timers.set(
      cwd,
      setTimeout(() => {
        timers.delete(cwd);
        for (const threadId of threadsByCwd.get(cwd) ?? []) notify(threadId);
      }, WATCH_DEBOUNCE_MS),
    );
  };

  const unwatch = (cwd: string): void => {
    for (const watcher of watchersByCwd.get(cwd) ?? []) watcher.close();
    watchersByCwd.delete(cwd);
    const timer = timers.get(cwd);
    if (timer) clearTimeout(timer);
    timers.delete(cwd);
  };

  const watchCwd = (cwd: string, paths: readonly string[]): void => {
    unwatch(cwd);
    const watchers: FSWatcher[] = [];
    for (const path of paths) {
      try {
        const watcher = watch(path, { persistent: false }, () => emit(cwd));
        watcher.on("error", () => undefined);
        watchers.push(watcher);
      } catch {
        // Missing Git identity files are skipped; the next inspect recreates them.
      }
    }
    watchersByCwd.set(cwd, watchers);
  };

  return {
    track(threadId, inspection) {
      if (disposed) return;
      const previous = cwdByThread.get(threadId);
      if (previous && previous !== inspection.cwd) {
        const remaining = threadsByCwd.get(previous);
        remaining?.delete(threadId);
        if (!remaining || remaining.size === 0) {
          threadsByCwd.delete(previous);
          unwatch(previous);
        }
      }
      cwdByThread.set(threadId, inspection.cwd);
      const threads = threadsByCwd.get(inspection.cwd) ?? new Set<string>();
      threads.add(threadId);
      threadsByCwd.set(inspection.cwd, threads);
      watchCwd(inspection.cwd, inspection.watchPaths);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const cwd of [...watchersByCwd.keys()]) unwatch(cwd);
      threadsByCwd.clear();
      cwdByThread.clear();
    },
  };
}
