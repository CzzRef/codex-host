import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  WorkspaceWorktreeError,
  createWorkspaceWorktree,
  listWorkspaceWorktrees,
  resolvePrimaryRoot,
  worktreeParentFor,
} from "../src/workspace-worktree.js";

const execFileAsync = promisify(execFile);

const gitEnv: NodeJS.ProcessEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "Dev",
  GIT_AUTHOR_EMAIL: "dev@example.com",
  GIT_COMMITTER_NAME: "Dev",
  GIT_COMMITTER_EMAIL: "dev@example.com",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_TERMINAL_PROMPT: "0",
};

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, ...args], { env: gitEnv });
  return stdout.trim();
}

async function initRepo(dir: string, branch = "main"): Promise<void> {
  await execFileAsync("git", ["init", "-b", branch, dir], { env: gitEnv });
  await git(dir, ["config", "user.email", "dev@example.com"]);
  await git(dir, ["config", "user.name", "Dev"]);
  await writeFile(join(dir, "README.md"), "ok\n");
  await git(dir, ["add", "."]);
  await git(dir, ["commit", "-m", "init"]);
}

const cleanups: string[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function repoFixture(): Promise<{ parent: string; repo: string }> {
  const parent = await realpath(await mkdtemp(join(tmpdir(), "codexhost-worktree-")));
  cleanups.push(parent);
  const repo = join(parent, "Repo");
  await mkdir(repo);
  await initRepo(repo);
  return { parent, repo };
}

describe("Host-managed worktrees", () => {
  it("lists the primary checkout first with a yyMMdd- suggestion", async () => {
    const { repo } = await repoFixture();
    const listed = await listWorkspaceWorktrees(repo, new Date("2026-09-03T01:00:00+08:00"));
    expect(listed.primaryRoot).toBe(repo);
    expect(listed.suggestedName).toBe("260903-");
    expect(listed.worktrees).toHaveLength(1);
    expect(listed.worktrees[0]).toMatchObject({
      root: repo,
      name: "Repo",
      branch: "main",
      lane: null,
      dirty: false,
      isPrimary: true,
    });
  });

  it("creates {Repo}-worktrees/{lane}/{name} on branch {lane}/{name} and lists it", async () => {
    const { parent, repo } = await repoFixture();
    const created = await createWorkspaceWorktree({
      projectRoot: repo,
      name: "260903-picker",
      lane: "codex",
    });
    const expectedRoot = join(parent, "Repo-worktrees", "codex", "260903-picker");
    expect(worktreeParentFor(repo, "codex")).toBe(join(parent, "Repo-worktrees", "codex"));
    expect(created.primaryRoot).toBe(repo);
    expect(created.worktree).toMatchObject({
      root: expectedRoot,
      name: "260903-picker",
      branch: "codex/260903-picker",
      lane: "codex",
      dirty: false,
      isPrimary: false,
    });
    expect(await git(expectedRoot, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe(
      "codex/260903-picker",
    );
    // Any directory in the family resolves back to the primary checkout.
    expect(await resolvePrimaryRoot(expectedRoot)).toBe(repo);
    await writeFile(join(expectedRoot, "notes.txt"), "dirty\n");
    const listed = await listWorkspaceWorktrees(expectedRoot);
    expect(listed.primaryRoot).toBe(repo);
    expect(listed.worktrees.map((entry) => entry.name)).toEqual(["Repo", "260903-picker"]);
    expect(listed.worktrees[1]).toMatchObject({ dirty: true, lane: "codex" });
  });

  it("refuses bad names, duplicate paths or branches, and never deletes", async () => {
    const { repo } = await repoFixture();
    await expect(
      createWorkspaceWorktree({ projectRoot: repo, name: "Feature Branch" }),
    ).rejects.toMatchObject({ code: -32602 });
    await createWorkspaceWorktree({ projectRoot: repo, name: "260903-dup" });
    await expect(
      createWorkspaceWorktree({ projectRoot: repo, name: "260903-dup" }),
    ).rejects.toBeInstanceOf(WorkspaceWorktreeError);
    await git(repo, ["branch", "codex/260903-taken"]);
    await expect(
      createWorkspaceWorktree({ projectRoot: repo, name: "260903-taken" }),
    ).rejects.toMatchObject({ code: -32602, message: expect.stringContaining("Branch") });
    await expect(
      createWorkspaceWorktree({ projectRoot: repo, name: "260903-base", baseRef: "no-such-ref" }),
    ).rejects.toMatchObject({ code: -32602 });
    const listed = await listWorkspaceWorktrees(repo);
    expect(listed.worktrees).toHaveLength(2);
  });

  it("rejects paths outside a Git repository", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codexhost-worktree-none-"));
    cleanups.push(dir);
    await expect(listWorkspaceWorktrees(dir)).rejects.toMatchObject({ code: -32602 });
    await expect(listWorkspaceWorktrees("relative")).rejects.toMatchObject({ code: -32602 });
  });
});
