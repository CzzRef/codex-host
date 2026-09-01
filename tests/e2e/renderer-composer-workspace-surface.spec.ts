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
      document.body.append(parent, branch);

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
          files: [{ path: "src/bar.ts", addedLines: 8, deletedLines: 2 }],
        });
      };
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

test("Composer shows repository rows, conversation files, branch worktree toggle, and Tab prompt reuse", async ({
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
  await page.evaluate(() => {
    sessionStorage.setItem("codexhost.prompt-reuse:thread-workspace-e2e", "验收一下当前改动");
  });
  await page.addScriptTag({ content: browserBundle });

  const bar = page.locator("[data-codexhost-workspace-bar]");
  await expect(bar).toBeVisible();
  await expect(page.locator("[data-codexhost-workspace-row]")).toHaveCount(2);
  await expect(bar).toContainText("app");
  await expect(bar).toContainText("vendor");
  await expect(bar).toContainText("wt app-feature");
  const composer = page.locator("[data-codex-composer-root]");
  await expect
    .poll(async () =>
      composer.evaluate((node) =>
        node.previousElementSibling?.hasAttribute("data-codexhost-workspace-bar"),
      ),
    )
    .toBe(true);

  await page.evaluate("globalThis.emitWorkspaceFiles()");
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("src/bar.ts");
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("+8");

  await expect(page.locator("[data-codexhost-branch-worktree-toggle] input")).toBeChecked();

  const ghost = page.locator("[data-codexhost-prompt-ghost]");
  await expect(ghost).toBeVisible();
  await expect(ghost).toContainText("验收一下当前改动");
  const editor = page.locator('[data-codex-composer][contenteditable="true"]');
  await editor.click();
  await editor.press("Tab");
  await expect(editor).toContainText("验收一下当前改动");
});
