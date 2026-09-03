import { execFile } from "node:child_process";
import { mkdir, realpath, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { promisify } from "node:util";

import {
  WORKSPACE_WORKTREE_MAX_LENGTH,
  suggestedWorkspaceWorktreeName,
  workspaceWorktreeBranch,
  workspaceWorktreeLaneFromBranch,
  workspaceWorktreeNameSchema,
  type WorkspaceWorktreeCreateParams,
  type WorkspaceWorktreeCreateResult,
  type WorkspaceWorktreeEntry,
  type WorkspaceWorktreeLane,
  type WorkspaceWorktreeListResult,
} from "@codexhost/shared-contracts";

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 8_000;
const GIT_CREATE_TIMEOUT_MS = 60_000;

const gitEnv: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_OPTIONAL_LOCKS: "0",
  GIT_TERMINAL_PROMPT: "0",
  LC_ALL: "C",
};

export class WorkspaceWorktreeError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "WorkspaceWorktreeError";
    this.code = code;
  }
}

async function git(
  cwd: string,
  args: readonly string[],
  timeout = GIT_TIMEOUT_MS,
): Promise<{ ok: true; stdout: string } | { ok: false; stderr: string }> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], {
      timeout,
      maxBuffer: 1_048_576,
      env: gitEnv,
    });
    return { ok: true, stdout: stdout.trim() };
  } catch (error) {
    const stderr =
      typeof error === "object" && error !== null && "stderr" in error
        ? String((error as { stderr: unknown }).stderr).trim()
        : error instanceof Error
          ? error.message
          : String(error);
    return { ok: false, stderr };
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

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * The primary checkout of the family `projectRoot` belongs to: the directory
 * holding the common `.git`, whether `projectRoot` is that checkout or one of
 * its linked worktrees.
 */
export async function resolvePrimaryRoot(projectRoot: string): Promise<string> {
  if (!isAbsolute(projectRoot)) {
    throw new WorkspaceWorktreeError(-32602, "projectRoot must be an absolute path");
  }
  const root = await realDirectory(projectRoot);
  const toplevel = await git(root, ["rev-parse", "--show-toplevel"]);
  if (!toplevel.ok) {
    throw new WorkspaceWorktreeError(-32602, "projectRoot is not inside a Git repository");
  }
  const resolvedToplevel = await realDirectory(toplevel.stdout);
  const commonDir = await git(resolvedToplevel, ["rev-parse", "--git-common-dir"]);
  if (!commonDir.ok) return resolvedToplevel;
  const common = await realDirectory(
    isAbsolute(commonDir.stdout) ? commonDir.stdout : resolve(resolvedToplevel, commonDir.stdout),
  );
  return basename(common) === ".git" ? await realDirectory(dirname(common)) : resolvedToplevel;
}

function parseWorktreeList(
  output: string,
): Array<{ path: string; head: string | null; branch: string | null }> {
  const entries: Array<{ path: string; head: string | null; branch: string | null }> = [];
  let current: { path: string; head: string | null; branch: string | null } | null = null;
  for (const line of output.split("\n")) {
    const worktree = /^worktree (.+)$/u.exec(line);
    if (worktree?.[1]) {
      current = { path: worktree[1].trim(), head: null, branch: null };
      entries.push(current);
      continue;
    }
    if (!current) continue;
    const head = /^HEAD ([0-9a-f]+)$/u.exec(line);
    if (head?.[1]) current.head = head[1];
    const branch = /^branch refs\/heads\/(.+)$/u.exec(line);
    if (branch?.[1]) current.branch = branch[1].trim();
  }
  return entries;
}

async function describeWorktree(
  primaryRoot: string,
  entry: { path: string; head: string | null; branch: string | null },
): Promise<WorkspaceWorktreeEntry | null> {
  const root = await realDirectory(entry.path);
  if (!(await exists(root))) return null;
  const shortSha = await git(root, ["rev-parse", "--short", "HEAD"]);
  const headSha = shortSha.ok ? shortSha.stdout : (entry.head?.slice(0, 7) ?? null);
  if (!headSha) return null;
  const status = await git(root, ["status", "--porcelain", "--untracked-files=normal"]);
  const laneFromPath = laneFromWorktreePath(primaryRoot, root);
  return {
    root,
    name: basename(root),
    branch: entry.branch,
    headSha,
    lane: workspaceWorktreeLaneFromBranch(entry.branch) ?? laneFromPath,
    dirty: status.ok ? status.stdout.length > 0 : false,
    isPrimary: root === primaryRoot,
  };
}

/** `{parent}/{Repo}-worktrees/{lane}/{name}` layout the Host creates. */
export function worktreeParentFor(primaryRoot: string, lane: WorkspaceWorktreeLane): string {
  return join(dirname(primaryRoot), `${basename(primaryRoot)}-worktrees`, lane);
}

function laneFromWorktreePath(primaryRoot: string, root: string): WorkspaceWorktreeLane | null {
  for (const lane of ["codex", "claude", "cursor", "group"] as const) {
    if (dirname(root) === worktreeParentFor(primaryRoot, lane)) return lane;
  }
  return null;
}

export async function listWorkspaceWorktrees(
  projectRoot: string,
  now: Date = new Date(),
): Promise<WorkspaceWorktreeListResult> {
  const primaryRoot = await resolvePrimaryRoot(projectRoot);
  const listed = await git(primaryRoot, ["worktree", "list", "--porcelain"]);
  if (!listed.ok) {
    throw new WorkspaceWorktreeError(-32603, `git worktree list failed: ${listed.stderr}`);
  }
  const worktrees: WorkspaceWorktreeEntry[] = [];
  for (const entry of parseWorktreeList(listed.stdout)) {
    if (worktrees.length >= WORKSPACE_WORKTREE_MAX_LENGTH) break;
    const described = await describeWorktree(primaryRoot, entry);
    if (described && !worktrees.some((existing) => existing.root === described.root)) {
      worktrees.push(described);
    }
  }
  worktrees.sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    return right.name.localeCompare(left.name);
  });
  return { primaryRoot, worktrees, suggestedName: suggestedWorkspaceWorktreeName(now) };
}

/**
 * Adds one linked worktree on a fresh branch. Refuses to reuse an existing
 * path or branch and never removes anything, so a failed attempt leaves the
 * repository as it was.
 */
export async function createWorkspaceWorktree(
  params: WorkspaceWorktreeCreateParams,
): Promise<WorkspaceWorktreeCreateResult> {
  const name = workspaceWorktreeNameSchema.safeParse(params.name);
  if (!name.success) {
    throw new WorkspaceWorktreeError(
      -32602,
      "Worktree name must be yyMMdd- followed by a lowercase functional core",
    );
  }
  const lane = params.lane ?? "codex";
  const primaryRoot = await resolvePrimaryRoot(params.projectRoot);
  const parent = worktreeParentFor(primaryRoot, lane);
  const root = join(parent, name.data);
  const branch = workspaceWorktreeBranch(lane, name.data);
  if (await exists(root)) {
    throw new WorkspaceWorktreeError(-32602, `Worktree path already exists: ${root}`);
  }
  const branchExists = await git(primaryRoot, [
    "rev-parse",
    "--verify",
    "--quiet",
    `refs/heads/${branch}`,
  ]);
  if (branchExists.ok) {
    throw new WorkspaceWorktreeError(-32602, `Branch already exists: ${branch}`);
  }
  if (params.baseRef) {
    const baseOk = await git(primaryRoot, ["rev-parse", "--verify", "--quiet", params.baseRef]);
    if (!baseOk.ok) {
      throw new WorkspaceWorktreeError(-32602, `Base ref is unknown: ${params.baseRef}`);
    }
  }
  try {
    await mkdir(parent, { recursive: true });
  } catch (error) {
    throw new WorkspaceWorktreeError(
      -32603,
      `Cannot create worktree parent: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const added = await git(
    primaryRoot,
    ["worktree", "add", "-b", branch, root, params.baseRef ?? "HEAD"],
    GIT_CREATE_TIMEOUT_MS,
  );
  if (!added.ok) {
    throw new WorkspaceWorktreeError(-32603, `git worktree add failed: ${added.stderr}`);
  }
  const created = await describeWorktree(primaryRoot, {
    path: root,
    head: null,
    branch,
  });
  if (!created) {
    throw new WorkspaceWorktreeError(-32603, "Created worktree could not be described");
  }
  return { primaryRoot, worktree: created };
}
