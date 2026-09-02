import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const browserExecutable = process.env.CODEXHOST_PLAYWRIGHT_EXECUTABLE_PATH;
if (browserExecutable) test.use({ launchOptions: { executablePath: browserExecutable } });

const { outputFiles } = await build({
  stdin: {
    contents: `
      import { installRendererBindingProbe } from "./packages/renderer-extension/src/renderer-binding-probe.ts";
      try {

      const threadId = "thread-workspace-e2e";
      const model = { id: "pi-model-v1.workspace-e2e" };
      const inspection = {
        status: "ready",
        catalog: {
          models: [{ ref: model, label: "Workspace Model" }],
          defaultModel: model,
          thinkingOptions: [],
        },
        capabilities: {
          configuration: {
            selectModel: true,
            selectThinkingOption: false,
            selectPermissionMode: false,
          },
          history: { fork: true, forkAcrossCwd: true, rollbackLastTurn: true },
        },
      };

      const parent = document.createElement("div");
      parent.style.display = "flex";
      parent.style.flexDirection = "column";
      parent.style.gap = "8px";
      parent.style.width = "480px";
      const composer = document.createElement("div");
      composer.setAttribute("data-codex-composer-root", "true");
      composer.setAttribute("data-composer-placement", "thread");
      composer.style.width = "480px";
      composer.style.height = "96px";
      const portal = document.createElement("div");
      portal.setAttribute("data-above-composer-portal", "true");
      portal.setAttribute("data-above-composer-conversation-id", threadId);
      const editor = document.createElement("div");
      editor.setAttribute("data-codex-composer", "true");
      editor.setAttribute("contenteditable", "true");
      editor.setAttribute("role", "textbox");
      editor.style.minHeight = "44px";
      editor.style.padding = "8px";
      const toolbar = document.createElement("div");
      const send = document.createElement("button");
      send.type = "submit";
      send.setAttribute("aria-label", "Send");
      toolbar.append(send);
      composer.append(portal, editor, toolbar);
      parent.append(composer);
      const branch = document.createElement("button");
      branch.type = "button";
      branch.setAttribute("aria-label", "Switch branch main");
      branch.textContent = "main";
      const runLocation = document.createElement("button");
      runLocation.type = "button";
      runLocation.setAttribute("aria-haspopup", "menu");
      runLocation.setAttribute("data-composer-navigation-target", "run-location");
      runLocation.textContent = "Local";
      const modeOwner = {
        memoizedProps: {
          composerMode: "local",
          conversationId: null,
          setComposerMode(mode) {
            modeOwner.memoizedProps.composerMode = mode;
            runLocation.textContent = mode === "worktree" ? "Worktree" : "Local";
          },
        },
        return: null,
      };
      Object.defineProperty(runLocation, "__reactFiber$fixture", {
        value: {
          memoizedProps: {
            "aria-haspopup": "menu",
            "data-composer-navigation-target": "run-location",
          },
          return: modeOwner,
        },
      });
      const changes = document.createElement("button");
      changes.type = "button";
      changes.setAttribute("data-slot", "thread-summary-panel-item-button");
      changes.textContent = "Changes +12 -3";
      changes.style.width = "120px";
      changes.style.height = "24px";
      changes.addEventListener("click", () => {
        globalThis.__changesClicks = (globalThis.__changesClicks ?? 0) + 1;
      });
      const review = document.createElement("button");
      review.type = "button";
      review.setAttribute("data-tab-id", "diff");
      review.setAttribute("aria-label", "Open review tab");
      review.textContent = "Review";
      review.style.width = "80px";
      review.style.height = "24px";
      const turn = document.createElement("div");
      turn.setAttribute("data-turn-key", "history-content:turn:turn-a");
      turn.textContent = "You said: hello";
      turn.style.minHeight = "120px";
      turn.style.flex = "1";
      document.body.style.margin = "0";
      document.body.style.display = "flex";
      document.body.style.flexDirection = "column";
      document.body.style.minHeight = "100vh";
      document.body.append(turn, parent, branch, runLocation, changes, review);

      const unavailable = async () => {
        throw new Error("unused fixed control");
      };
      let fileListener = null;
      const binding = installRendererBindingProbe({
        enabledAgents: ["codex", "pi"],
        defaultAgent: "codex",
      });
      binding.setAdapter(
        { state: "ready", reason: "ready", modelUpdates: 0, hook: "model-state" },
        undefined,
        () => true,
        {
          inspectHarness: async () => inspection,
          inspectThread: unavailable,
          forkThread: unavailable,
          inspectThreadUsage: unavailable,
          inspectThreadWorkspace: async () => {
            globalThis.__workspaceInspectCalls = (globalThis.__workspaceInspectCalls ?? 0) + 1;
            return {
            threadId,
            cwd: "/workspace/app",
            repositories: [
              {
                root: "/workspace/app",
                name: "app",
                kind: "primary",
                branch: "main",
                headSha: "abc1234",
                isWorktree: true,
                worktreeName: "app-feature",
                primaryRoot: "/workspace/source",
                addedLines: 12,
                deletedLines: 3,
                dirty: true,
              },
              {
                root: "/workspace/app/vendor",
                name: "vendor",
                kind: "submodule",
                branch: "lib",
                headSha: "def5678",
                isWorktree: false,
                worktreeName: null,
                primaryRoot: "/workspace/app/vendor",
                addedLines: 4,
                deletedLines: 1,
                dirty: true,
              },
            ],
            };
          },
          subscribeThreadWorkspace: () => () => undefined,
          subscribeThreadFileChanges: (listener) => {
            fileListener = listener;
            return () => {
              fileListener = null;
            };
          },
          listThreadOwnership: unavailable,
          inspectThreadCommands: unavailable,
          executeThreadCommand: unavailable,
          selectThreadModel: unavailable,
          selectThreadThinking: unavailable,
          selectThreadPermissionMode: unavailable,
          checkUpdate: unavailable,
          startUpdate: unavailable,
          readUpdateStatus: unavailable,
        },
      );

      globalThis.emitWorkspaceFiles = () => {
        if (!fileListener) throw new Error("File-change listener is unavailable");
        fileListener({
          threadId,
          files: [{ path: "src/bar.ts", addedLines: 8, deletedLines: 2, preview: "+keep" }],
          turnId: "turn-a",
        });
      };
      globalThis.disposeBinding = () => binding.dispose();
      } catch (error) {
        globalThis.__e2eError = error instanceof Error ? error.stack : String(error);
      }
    `,
    resolveDir: repositoryRoot,
    sourcefile: "renderer-composer-workspace-surface-e2e-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2024",
  loader: { ".css": "text", ".png": "dataurl", ".svg": "dataurl" },
  write: false,
});

const browserBundle = outputFiles[0]?.text;
if (!browserBundle) throw new Error("Composer workspace surface E2E bundle was not generated");

test("Composer shows a compact changed-files workspace surface, branch worktree toggle, and Tab prompt reuse", async ({
  page,
}) => {
  await page.route("https://codexhost.test/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><body></body>",
    });
  });
  await page.goto("https://codexhost.test/");
  await page.addScriptTag({ content: browserBundle });

  const bar = page.locator("[data-codexhost-workspace-bar]");
  const nativeChanges = page.locator('[data-slot="thread-summary-panel-item-button"]');
  const nativeReview = page.locator('[data-tab-id="diff"]');
  await expect(bar).toHaveCount(0);
  await expect(nativeChanges).toBeVisible();
  await expect(nativeReview).toBeVisible();

  await page.evaluate("globalThis.emitWorkspaceFiles()");
  await expect(bar).toBeVisible();
  await expect(page.locator("[data-codexhost-workspace-row]")).toHaveCount(1);
  await expect(bar).toContainText("app-feature");
  await expect(bar).toContainText("main");
  await expect(bar).not.toContainText("vendor");
  await expect(bar).not.toContainText("+12");
  await expect(nativeChanges).toBeHidden();
  await expect(nativeReview).toBeHidden();
  const composer = page.locator("[data-codex-composer-root]");
  expect(
    await bar.evaluate(
      (node) => node.nextElementSibling?.hasAttribute("data-codex-composer-root") === true,
    ),
  ).toBe(true);
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("file change");
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("+8");
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("-2");
  expect(
    await bar.evaluate(
      (node) =>
        node.firstElementChild?.classList.contains("codexhost-workspace-chips") === true &&
        node.lastElementChild?.hasAttribute("data-codexhost-workspace-files") === true,
    ),
  ).toBe(true);
  await expect(page.locator("[data-codexhost-workspace-file]")).toBeHidden();
  await page.locator(".codexhost-workspace-files-toggle").click();
  const fileRow = page.locator("[data-codexhost-workspace-file]");
  await expect(fileRow).toBeVisible();
  await expect(fileRow).toContainText("src/bar.ts");
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("+8");
  const barBox = await bar.boundingBox();
  const fileListBox = await page
    .locator('[data-codexhost-workspace-file-list="upward-right"]')
    .boundingBox();
  expect(barBox && fileListBox && fileListBox.y + fileListBox.height <= barBox.y).toBe(true);
  expect(
    barBox &&
      fileListBox &&
      Math.abs(fileListBox.x + fileListBox.width - (barBox.x + barBox.width)) <= 12,
  ).toBe(true);
  await fileRow.hover();
  await expect(page.locator("[data-codexhost-workspace-preview]")).toBeVisible();
  await expect(page.locator("[data-codexhost-workspace-preview]")).toContainText("+keep");
  await fileRow.click();
  await expect.poll(async () => page.evaluate("globalThis.__changesClicks ?? 0")).toBe(1);
  await page.locator("[data-turn-key]").click();
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("this turn");
  await expect(page.locator("[data-codexhost-turn-files]")).toHaveCount(1);
  await expect(page.locator("[data-codexhost-turn-actions]")).toContainText("Edit");
  await expect(page.locator("[data-codexhost-turn-actions]")).toContainText("Rollback");
  await expect(page.locator("[data-codexhost-turn-actions]")).toContainText("Redo");
  // The cluster anchors inside the selected Turn's own box, never above it.
  const clusterBox = await page.locator("[data-codexhost-turn-actions]").boundingBox();
  const turnBox = await page.locator("[data-turn-key]").boundingBox();
  expect(clusterBox && turnBox && clusterBox.y >= turnBox.y).toBe(true);
  expect(
    clusterBox && turnBox && clusterBox.x + clusterBox.width <= turnBox.x + turnBox.width,
  ).toBe(true);
  // Redo is disabled until the Host reports a last-Turn slot; the fixture's
  // inspectThread is unavailable, so the button must stay disabled.
  await expect(page.locator('[data-codexhost-turn-action="redo"]')).toBeDisabled();
  await expect(page.locator('[data-codexhost-turn-action="edit"]')).toHaveAttribute(
    "aria-label",
    /Last turn; edit the prompt/,
  );
  await page.locator('[data-codexhost-turn-action="edit"]').hover();
  await expect(page.locator("[data-codexhost-turn-confirm]")).toHaveCount(0);
  // Rollback still confirms before dropping anything (nothing later here, so disabled).
  await expect(page.locator('[data-codexhost-turn-action="rollback"]')).toBeDisabled();

  const worktreeToggle = page.locator("[data-codexhost-branch-worktree-toggle] input");
  const runLocation = page.locator('[data-composer-navigation-target="run-location"]');
  await expect(worktreeToggle).toBeChecked();
  await expect(worktreeToggle).toBeEnabled();
  await expect(runLocation).toHaveText("Worktree");
  await worktreeToggle.uncheck();
  await expect(runLocation).toHaveText("Local");
  await expect
    .poll(async () => page.evaluate("localStorage.getItem('codexhost.switch-branch-worktree')"))
    .toBe("0");
  await worktreeToggle.check();
  await expect(runLocation).toHaveText("Worktree");

  const editor = page.locator('[data-codex-composer][contenteditable="true"]');
  await composer.evaluate((node) => {
    const stop = node.ownerDocument.createElement("button");
    stop.setAttribute("aria-label", "Stop");
    node.append(stop);
  });
  await editor.click();
  await editor.evaluate((node) => {
    node.textContent = "现在是第二段";
  });
  await editor.press("Enter");
  await expect(editor).toHaveText("");
  await expect(page.locator("[data-codexhost-prompt-ghost]")).toHaveCount(0);
  await composer.evaluate((node) => node.querySelector('[aria-label="Stop"]')?.remove());
  const ghost = page.locator("[data-codexhost-prompt-ghost]");
  await expect(ghost).toBeVisible();
  await expect(ghost).toContainText("现在是第二段");
  await editor.click();
  await editor.press("Tab");
  await expect(editor).toContainText("现在是第二段");

  await page.evaluate("globalThis.disposeBinding()");
  await expect(nativeChanges).toBeVisible();
  await expect(nativeReview).toBeVisible();
});
