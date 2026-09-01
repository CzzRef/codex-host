import { execFile } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { inspectGitWorkspace } from "../src/thread-workspace.js";

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

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync("git", ["-C", cwd, ...args], { env: gitEnv });
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

describe("inspectGitWorkspace", () => {
  it("returns an empty list outside a Git repository", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codexhost-workspace-none-"));
    cleanups.push(dir);
    await expect(inspectGitWorkspace(dir)).resolves.toMatchObject({
      cwd: await realpath(dir),
      repositories: [],
    });
  });

  it("describes the primary repository branch and dirty stats", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codexhost-workspace-primary-"));
    cleanups.push(dir);
    await initRepo(dir);
    await writeFile(join(dir, "README.md"), "changed\n");
    const inspection = await inspectGitWorkspace(dir);
    expect(inspection.repositories).toHaveLength(1);
    expect(inspection.repositories[0]).toMatchObject({
      kind: "primary",
      branch: "main",
      isWorktree: false,
      worktreeName: null,
      dirty: true,
    });
    expect(inspection.repositories[0]?.addedLines).toBeGreaterThan(0);
    expect(inspection.watchPaths.length).toBeGreaterThan(0);
  });

  it("marks a linked worktree and lists a submodule as its own row", async () => {
    const root = await mkdtemp(join(tmpdir(), "codexhost-workspace-multi-"));
    cleanups.push(root);
    const lib = join(root, "lib");
    const app = join(root, "app");
    const worktree = join(root, "app-feature");
    await initRepo(lib, "lib");
    await initRepo(app);
    await git(app, ["-c", "protocol.file.allow=always", "submodule", "add", lib, "vendor"]);
    await git(app, ["commit", "-m", "add vendor"]);
    await git(app, ["worktree", "add", "-b", "feature", worktree]);

    const fromWorktree = await inspectGitWorkspace(worktree);
    expect(fromWorktree.repositories[0]).toMatchObject({
      kind: "primary",
      branch: "feature",
      isWorktree: true,
      worktreeName: "app-feature",
      primaryRoot: await realpath(app),
    });
    const fromPrimary = await inspectGitWorkspace(app);
    expect(fromPrimary.repositories.map((repository) => repository.kind)).toContain("submodule");
    expect(
      fromPrimary.repositories.find((repository) => repository.kind === "submodule"),
    ).toMatchObject({
      name: "vendor",
      kind: "submodule",
    });
  });
});
