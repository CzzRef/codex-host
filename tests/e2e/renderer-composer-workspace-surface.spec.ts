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

      // Desktop's title chrome floats over the transcript; the transcript is a
      // column-reverse scroller whose first child is the content column and
      // whose Composer container is an absolutely positioned sibling.
      const chrome = document.createElement("header");
      chrome.setAttribute("data-pip-obstacle", "app-shell-header");
      chrome.style.cssText = "position:fixed;top:0;left:0;right:0;height:44px;background:#222;z-index:1";
      const scroller = document.createElement("div");
      scroller.id = "transcript";
      scroller.style.cssText =
        "position:relative;margin-top:44px;width:640px;height:560px;overflow-y:auto;display:flex;flex-direction:column-reverse;background:#111";
      const column = document.createElement("div");
      column.style.cssText =
        "box-sizing:border-box;flex:0 0 auto;min-height:100%;padding:24px 80px 120px;display:flex;flex-direction:column";
      const turnSpecs = [
        ["turn-a", 320, "first prompt"],
        ["turn-b", 320, "second prompt"],
        ["turn-c", 600, "third prompt"],
      ];
      // Desktop stamps data-turn-key on its paginated-history gap placeholder too.
      const gap = document.createElement("div");
      gap.setAttribute("data-turn-key", 'history-gap:[null,"boundary:tail:0:older"]');
      gap.style.cssText = "height:40px;width:480px";
      column.append(gap);
      for (const [key, height, prompt] of turnSpecs) {
        const turn = document.createElement("div");
        turn.setAttribute("data-turn-key", "history-content:turn:" + key);
        turn.style.cssText = "box-sizing:border-box;height:" + height + "px;width:480px";
        const bubble = document.createElement("div");
        bubble.setAttribute("data-message-role", "user");
        bubble.style.cssText = "height:48px;box-sizing:border-box;padding:8px;background:rgba(255,255,255,0.05);border-radius:25px";
        bubble.textContent = prompt;
        const reply = document.createElement("div");
        reply.style.cssText = "height:" + (height - 48) + "px;box-sizing:border-box;padding:8px";
        reply.textContent = "assistant reply for " + key;
        turn.append(bubble, reply);
        column.append(turn);
      }
      const parent = document.createElement("div");
      parent.style.cssText = "position:absolute;bottom:0;left:80px;width:480px;display:flex;flex-direction:column";
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
          cwd: "/workspace/source",
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
      scroller.append(column, parent);
      document.body.style.margin = "0";
      document.body.append(chrome, scroller, branch, runLocation, changes, review);
      const turnElement = (key) => document.querySelector('[data-turn-key="history-content:turn:' + key + '"]');
      // column-reverse: scrollTop is 0 at the bottom and negative above it, so
      // the helpers only ever use clamped absolute targets or relative deltas.
      globalThis.scrollTranscriptToTop = () => scroller.scrollTo({ top: -scroller.scrollHeight });
      globalThis.scrollTranscriptToBottom = () => scroller.scrollTo({ top: scroller.scrollHeight });
      globalThis.scrollTurnUnderHeader = (key, extra) => {
        const header = document.querySelector("[data-codexhost-turn-header]");
        const headerBottom = header.getBoundingClientRect().bottom;
        const delta = turnElement(key).getBoundingClientRect().top - (headerBottom - extra);
        scroller.scrollBy({ top: delta });
      };
      globalThis.setNativeEdit = (key, editing) => {
        const turn = turnElement(key);
        turn.querySelector("textarea")?.remove();
        if (editing) {
          const textarea = document.createElement("textarea");
          textarea.value = "editing";
          turn.append(textarea);
        }
      };

      const unavailable = async () => {
        throw new Error("unused fixed control");
      };
      // Stand-in for the desktop-control draft policy: records the worktree cwd
      // the Renderer picks so the test can assert the Host-side rewrite input.
      globalThis.__workspaceSelections = [];
      window.__codexhostDraftPrewarmPolicyV1 = {
        state: "ready",
        hostId: "local",
        select: () => false,
        selectWorkspace(selection) {
          globalThis.__workspaceSelections.push(selection ? selection.cwd : null);
          return true;
        },
        draftCwd: () => null,
        clear: async () => undefined,
      };
      const worktrees = [
        {
          root: "/workspace/source",
          name: "source",
          branch: "main",
          headSha: "abc1234",
          lane: null,
          dirty: false,
          isPrimary: true,
        },
        {
          root: "/workspace/source-worktrees/codex/260901-existing",
          name: "260901-existing",
          branch: "codex/260901-existing",
          headSha: "1111111",
          lane: "codex",
          dirty: true,
          isPrimary: false,
        },
      ];
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
          inspectThread: async (params) => {
            globalThis.__threadInspectCalls = (globalThis.__threadInspectCalls ?? 0) + 1;
            return {
              owner: "external",
              harnessId: "pi",
              transportModelId: model.id,
              history: inspection.capabilities.history,
              historyRedoAvailable: false,
              rollback: { lastTurn: true, multiTurn: false },
              locked: true,
              threadId: params.threadId,
            };
          },
          forkThread: unavailable,
          inspectThreadUsage: unavailable,
          inspectThreadWorkspace: async (params) => {
            globalThis.__workspaceInspectCalls = (globalThis.__workspaceInspectCalls ?? 0) + 1;
            globalThis.__workspaceInspectExtraPaths = params.extraPaths ?? null;
            const external = (params.extraPaths ?? []).some((path) => path.startsWith("/notes/CodeNote/"))
              ? [
                  {
                    root: "/notes/CodeNote",
                    name: "CodeNote",
                    kind: "external",
                    branch: "main",
                    headSha: "0badf00",
                    isWorktree: false,
                    worktreeName: null,
                    primaryRoot: "/notes/CodeNote",
                    addedLines: 0,
                    deletedLines: 0,
                    dirty: true,
                  },
                ]
              : [];
            return {
            threadId,
            cwd: "/workspace/app",
            repositories: [
              ...external,
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
              {
                root: "/workspace/app-feature-two",
                name: "app-feature-two",
                kind: "worktree",
                branch: "feature-two",
                headSha: "0feature2",
                isWorktree: true,
                worktreeName: "app-feature-two",
                primaryRoot: "/workspace/source",
                addedLines: 0,
                deletedLines: 0,
                dirty: false,
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
          listWorkspaceWorktrees: async (params) => {
            globalThis.__worktreeListRoots = [...(globalThis.__worktreeListRoots ?? []), params.projectRoot];
            return { primaryRoot: "/workspace/source", worktrees, suggestedName: "260903-" };
          },
          createWorkspaceWorktree: async (params) => {
            globalThis.__worktreeCreateParams = params;
            if (params.name === "260903-taken") throw new Error("Branch already exists: codex/260903-taken");
            const created = {
              root: "/workspace/source-worktrees/codex/" + params.name,
              name: params.name,
              branch: "codex/" + params.name,
              headSha: "2222222",
              lane: "codex",
              dirty: false,
              isPrimary: false,
            };
            worktrees.push(created);
            return { primaryRoot: "/workspace/source", worktree: created };
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
          itemId: "item-a",
          files: [{ path: "src/bar.ts", addedLines: 8, deletedLines: 2, preview: "+keep" }],
          turnId: "turn-a",
        });
      };
      globalThis.emitExternalFiles = () => {
        if (!fileListener) throw new Error("File-change listener is unavailable");
        fileListener({
          threadId,
          itemId: "item-b",
          files: [
            { path: "/notes/CodeNote/README.md", addedLines: 3, deletedLines: 0, preview: "+note" },
            { path: "vendor/lib.ts", addedLines: 0, deletedLines: 0, preview: "" },
          ],
          turnId: "turn-b",
        });
      };
      globalThis.emitSiblingFiles = () => {
        if (!fileListener) throw new Error("File-change listener is unavailable");
        fileListener({
          threadId,
          itemId: "item-c",
          files: [
            { path: "/workspace/app-feature-two/src/two.ts", addedLines: 3, deletedLines: 1, preview: "+two" },
          ],
          turnId: "turn-c",
        });
      };
      globalThis.revertExternalFiles = () => {
        if (!fileListener) throw new Error("File-change listener is unavailable");
        fileListener({ threadId, itemId: "item-b", files: [], turnId: "turn-b" });
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

test("Composer shows a compact changed-files workspace surface, draft worktree picker, and Tab prompt reuse", async ({
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

  // The pinned Turn header: a body child fixed at the transcript's top edge,
  // below Desktop's title chrome, opaque, spanning the Composer column.
  const header = page.locator("[data-codexhost-turn-header]");
  const headerIndex = page.locator("[data-codexhost-turn-header-index]");
  const headerPrompt = page.locator("[data-codexhost-turn-header-prompt]");
  await expect(header).toBeVisible();
  expect(await header.evaluate((node) => node.parentElement === node.ownerDocument.body)).toBe(
    true,
  );
  expect(
    await header.evaluate((node) => {
      const style = node.ownerDocument.defaultView?.getComputedStyle(node);
      return [style?.position, style?.backgroundColor, style?.backdropFilter];
    }),
  ).toEqual(["fixed", "rgb(17, 17, 17)", "none"]);
  const headerBox = await header.boundingBox();
  const composerBoxForHeader = await page.locator("[data-codex-composer-root]").boundingBox();
  expect(
    headerBox && composerBoxForHeader && Math.abs(headerBox.x - composerBoxForHeader.x) <= 1,
  ).toBe(true);
  expect(
    headerBox &&
      composerBoxForHeader &&
      Math.abs(headerBox.width - composerBoxForHeader.width) <= 1,
  ).toBe(true);
  expect(headerBox?.y).toBe(44);
  // The transcript column reserves the header's height above the first Turn.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const column = document.querySelector("[data-codexhost-transcript-reserve]");
        return column instanceof HTMLElement ? Number.parseFloat(column.style.paddingTop) : null;
      }),
    )
    // The 40px gap placeholder already spaces the first Turn; only the rest is padded.
    .toBe(Math.max(24, Math.round((headerBox?.height ?? 0) + 8 - 40)));
  await expect(page.locator("[data-codexhost-turn-hover]")).toHaveCount(0);
  await expect(page.locator("[data-codexhost-turn-rail]")).toHaveCount(0);
  await expect(header.locator("[data-codexhost-turn-actions]")).toHaveCount(1);
  await expect.poll(() => page.evaluate("globalThis.__threadInspectCalls ?? 0")).toBeGreaterThan(0);
  const inspectCallsBeforeScrolling = await page.evaluate("globalThis.__threadInspectCalls");
  // Scrolling moves the current Turn; the prompt appears only once its bubble
  // has passed under the header.
  await page.evaluate("globalThis.scrollTranscriptToTop()");
  // The gap placeholder is not a Turn: three Turns, and the first real Turn is current.
  await expect(headerIndex).toHaveText("Turn 1/3");
  await expect(headerPrompt).toBeHidden();
  const firstTurnBox = await page
    .locator('[data-turn-key="history-content:turn:turn-a"]')
    .boundingBox();
  expect(firstTurnBox && headerBox && firstTurnBox.y >= headerBox.y + headerBox.height).toBe(true);
  await expect(page.locator('[data-codexhost-turn-action="rollback"]')).toBeDisabled();
  await expect(page.locator('[data-codexhost-turn-action="rollback"]')).toHaveAttribute(
    "aria-label",
    /only roll back its last turn; 2 turns follow/,
  );
  await page.evaluate("globalThis.scrollTurnUnderHeader('turn-b', 8)");
  await expect(headerIndex).toHaveText("Turn 2/3");
  await expect(headerPrompt).toBeHidden();
  await page.evaluate("globalThis.scrollTurnUnderHeader('turn-b', 60)");
  await expect(headerIndex).toHaveText("Turn 2/3");
  await expect(headerPrompt).toHaveText("second prompt");
  expect(await header.boundingBox()).toEqual(headerBox);
  // One later Turn on a last-turn-only Thread: rollback is offered behind a confirmation.
  await expect(page.locator('[data-codexhost-turn-action="rollback"]')).toBeEnabled();
  await page.locator('[data-codexhost-turn-action="rollback"]').click();
  await expect(page.locator("[data-codexhost-turn-confirm]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-codexhost-turn-confirm]")).toHaveCount(0);
  await page.evaluate("globalThis.scrollTurnUnderHeader('turn-c', 60)");
  await expect(headerIndex).toHaveText("Turn 3/3");
  await expect(headerPrompt).toHaveText("third prompt");
  // Redo is disabled until the Host reports a Redo slot.
  await expect(page.locator('[data-codexhost-turn-action="redo"]')).toBeDisabled();
  await expect(page.locator('[data-codexhost-turn-action="rollback"]')).toBeDisabled();
  await expect(page.locator('[data-codexhost-turn-action="rollback"]')).toHaveAttribute(
    "aria-label",
    /No later turns/,
  );
  await expect(page.locator('[data-codexhost-turn-action="edit"]')).toHaveAttribute(
    "aria-label",
    /Last turn; edit the prompt/,
  );
  // No native pencil on this Turn: Edit refills the Composer with the prompt.
  const editorForEdit = page.locator('[data-codex-composer][contenteditable="true"]');
  await page.locator('[data-codexhost-turn-action="edit"]').click();
  await expect(editorForEdit).toContainText("third prompt");
  await expect(page.locator(".codexhost-turn-notice")).toContainText("placed in the Composer");
  await editorForEdit.evaluate((node) => {
    node.textContent = "";
  });
  // Desktop's own edit mode on the current Turn hides the Host actions.
  await page.evaluate("globalThis.setNativeEdit('turn-c', true)");
  await expect(header).toHaveAttribute("data-native-edit", "true");
  await expect(header.locator("[data-codexhost-turn-actions]")).toBeHidden();
  await expect(headerPrompt).toHaveText("Editing this turn");
  await page.evaluate("globalThis.setNativeEdit('turn-c', false)");
  await expect(header).toHaveAttribute("data-native-edit", "false");
  await expect(header.locator("[data-codexhost-turn-actions]")).toBeVisible();
  await expect(headerPrompt).toHaveText("third prompt");
  // Following the viewport across Turns never re-inspects the Thread.
  expect(await page.evaluate("globalThis.__threadInspectCalls")).toBe(inspectCallsBeforeScrolling);
  // With the transcript end in view the last Turn is current and its prompt is pinned.
  await page.evaluate("globalThis.scrollTranscriptToBottom()");
  await expect(headerIndex).toHaveText("Turn 3/3");
  await expect(headerPrompt).toHaveText("third prompt");

  // The workspace row lives in the header: nothing floats above the Composer any more.
  const workspace = header.locator("[data-codexhost-turn-header-workspace]");
  await expect(page.locator("[data-codexhost-workspace-bar]")).toHaveCount(0);
  await expect(page.locator("[data-codexhost-workspace-reserve]")).toHaveCount(0);
  const nativeChanges = page.locator('[data-slot="thread-summary-panel-item-button"]');
  const nativeReview = page.locator('[data-tab-id="diff"]');
  const composer = page.locator("[data-codex-composer-root]");
  // The core workspace chip is always present once the Host knows the cwd,
  // even before any file changed; native diff controls stay until the row
  // has a file disclosure to replace them with.
  await expect(workspace).toHaveAttribute("data-codexhost-turn-header-workspace", "core");
  await expect(page.locator("[data-codexhost-workspace-row]")).toHaveCount(1);
  await expect(page.locator('[data-codexhost-workspace-core="true"]')).toContainText("app-feature");
  await expect(page.locator("[data-codexhost-workspace-files]")).toHaveCount(0);
  await expect(nativeChanges).toBeVisible();
  await expect(nativeReview).toBeVisible();

  await page.evaluate("globalThis.emitWorkspaceFiles()");
  await expect(workspace).toHaveAttribute("data-codexhost-turn-header-workspace", "files");
  await expect(page.locator("[data-codexhost-workspace-row]")).toHaveCount(1);
  await expect(workspace).toContainText("app-feature");
  await expect(workspace).toContainText("main");
  await expect(workspace).not.toContainText("vendor");
  await expect(workspace).not.toContainText("+12");
  await expect(nativeChanges).toBeHidden();
  await expect(nativeReview).toBeHidden();
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("file changed");
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("+8");
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("-2");
  expect(
    await workspace.evaluate(
      (node) =>
        node.firstElementChild?.classList.contains("codexhost-workspace-chips") === true &&
        node.lastElementChild?.hasAttribute("data-codexhost-workspace-files") === true,
    ),
  ).toBe(true);
  // The row never changes the header's height: dropdowns hang below it.
  expect((await header.boundingBox())?.height).toBe(headerBox?.height);
  await expect(page.locator("[data-codexhost-workspace-file]")).toBeHidden();
  await page.locator(".codexhost-workspace-files-toggle").click();
  const fileRow = page.locator("[data-codexhost-workspace-file]");
  await expect(fileRow).toBeVisible();
  await expect(fileRow).toContainText("src/bar.ts");
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("+8");
  const headerBoxOpen = await header.boundingBox();
  const fileListBox = await page
    .locator('[data-codexhost-workspace-file-list="downward-right"]')
    .boundingBox();
  expect(
    headerBoxOpen && fileListBox && fileListBox.y >= headerBoxOpen.y + headerBoxOpen.height,
  ).toBe(true);
  expect(
    headerBoxOpen &&
      fileListBox &&
      Math.abs(fileListBox.x + fileListBox.width - (headerBoxOpen.x + headerBoxOpen.width)) <= 12,
  ).toBe(true);
  // The current Turn's files are tagged; src/bar.ts belongs to turn-a, not turn-c.
  await expect(fileRow).not.toHaveAttribute("data-codexhost-workspace-turn-file", "true");
  await fileRow.hover();
  const preview = page.locator("[data-codexhost-workspace-preview]");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("+keep");
  await expect(preview).toContainText("src/bar.ts");
  // The preview sits beside the list (never over it), under the header and above the Composer.
  const previewBox = await preview.boundingBox();
  const composerBox = await composer.boundingBox();
  expect(
    previewBox &&
      fileListBox &&
      (previewBox.x + previewBox.width <= fileListBox.x ||
        previewBox.x >= fileListBox.x + fileListBox.width),
  ).toBe(true);
  expect(
    previewBox && headerBoxOpen && previewBox.y >= headerBoxOpen.y + headerBoxOpen.height,
  ).toBe(true);
  expect(previewBox && composerBox && previewBox.y + previewBox.height <= composerBox.y).toBe(true);
  // Moving the pointer into the preview keeps it (interactive, scrollable).
  await preview.hover();
  await page.waitForTimeout(250);
  await expect(preview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await expect(page.locator("[data-codexhost-workspace-file]")).toBeHidden();
  await page.locator(".codexhost-workspace-files-toggle").click();
  await fileRow.hover();
  await expect(preview).toBeVisible();
  await fileRow.click();
  await expect(preview).toBeHidden();
  await expect.poll(async () => page.evaluate("globalThis.__changesClicks ?? 0")).toBe(1);

  // A file outside every inspected root is resolved through the Host
  // (`extraPaths`) into an `external` chip; a 0-line file adds no root; the
  // Item's later empty change set retires its files again.
  await page.evaluate("globalThis.emitExternalFiles()");
  await expect(page.locator("[data-codexhost-workspace-row]")).toHaveCount(2);
  await expect(page.locator('[data-codexhost-workspace-row="external"]')).toContainText("CodeNote");
  // The 0-line vendor file is listed under "Other paths" but earns no chip.
  await expect(page.locator(".codexhost-workspace-chips")).not.toContainText("vendor");
  await expect(page.locator("[data-codexhost-workspace-file-list]")).toContainText("vendor/lib.ts");
  expect(await page.evaluate("globalThis.__workspaceInspectExtraPaths")).toEqual([
    "/notes/CodeNote/README.md",
  ]);
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("3 files");
  await page.evaluate("globalThis.revertExternalFiles()");
  await expect(page.locator("[data-codexhost-workspace-row]")).toHaveCount(1);
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("1 file changed");
  // Scrolling to turn-a makes its file the current Turn's and tags it first.
  await page.evaluate("globalThis.scrollTranscriptToTop()");
  await expect(headerIndex).toHaveText("Turn 1/3");
  await page.locator(".codexhost-workspace-files-toggle").click();
  await expect(page.locator('[data-codexhost-workspace-file="src/bar.ts"]')).toHaveAttribute(
    "data-codexhost-workspace-turn-file",
    "true",
  );
  await expect(page.locator('[data-codexhost-workspace-file="src/bar.ts"]')).toContainText(
    "this turn",
  );
  // Scrolling the transcript closes the list again.
  await page.evaluate("globalThis.scrollTranscriptToBottom()");
  await expect(page.locator("[data-codexhost-workspace-file]")).toBeHidden();
  await expect(headerIndex).toHaveText("Turn 3/3");

  // Many touched roots collapse to one line behind `+N`; hover previews the
  // hidden chips, click pins the list, and the header keeps its height.
  await page.evaluate("globalThis.emitSiblingFiles()");
  await page.evaluate("globalThis.emitExternalFiles()");
  await expect(page.locator("[data-codexhost-workspace-row]")).toHaveCount(3);
  const visibleRows = page.locator("[data-codexhost-workspace-row]:visible");
  const setComposerWidth = (width: string) =>
    composer.evaluate((node, value) => {
      (node as HTMLElement).style.width = value;
      (node.parentElement as HTMLElement).style.width = value;
    }, width);
  const visibleAtFullWidth = await visibleRows.count();
  await setComposerWidth("300px");
  const more = page.locator("[data-codexhost-workspace-more]");
  await expect(more).toBeVisible();
  await expect(more).toHaveText(/^\+[12]$/, { useInnerText: true });
  // The core chip yields width before more roots are hidden; the line never grows.
  await expect.poll(() => visibleRows.count()).toBeLessThanOrEqual(visibleAtFullWidth);
  await expect(page.locator('[data-codexhost-workspace-core="true"]')).toBeVisible();
  expect((await header.boundingBox())?.height).toBe(headerBox?.height);
  await more.hover();
  await expect(page.locator(".codexhost-workspace-more-list")).toBeVisible();
  await expect(page.locator("[data-codexhost-workspace-more-row]").first()).toBeVisible();
  expect((await header.boundingBox())?.height).toBe(headerBox?.height);
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await setComposerWidth("480px");
  await expect.poll(() => visibleRows.count()).toBe(visibleAtFullWidth);
  await page.evaluate("globalThis.revertExternalFiles()");
  await expect(page.locator("[data-codexhost-workspace-row]")).toHaveCount(2);

  // Draft worktree picker: a chip beside Switch branch, defaulting to Local.
  const picker = page.locator("[data-codexhost-draft-worktree-picker]");
  const runLocation = page.locator('[data-composer-navigation-target="run-location"]');
  const menu = page.locator("[data-codexhost-draft-worktree-menu]");
  const option = (label: string) =>
    menu.locator(`[data-codexhost-draft-worktree-option="${label}"]`);
  const selections = () => page.evaluate("globalThis.__workspaceSelections");
  const storedPick = () => page.evaluate("localStorage.getItem('codexhost.draft-worktree.v1')");
  await expect(picker).toHaveCount(1);
  await expect(picker).toHaveAttribute("data-codexhost-draft-worktree-kind", "local");
  await expect(picker).toContainText("Local");
  await expect(runLocation).toHaveText("Local");
  expect(await storedPick()).toBeNull();
  // The draft project root came from the React owner; the list was fetched for it.
  await expect
    .poll(() => page.evaluate("globalThis.__worktreeListRoots"))
    .toEqual(["/workspace/source"]);
  await picker.click();
  await expect(menu).toBeVisible();
  await expect(option("Local")).toHaveAttribute("aria-checked", "true");
  await expect(option("260901-existing")).toContainText("codex/260901-existing");
  await expect(option("260901-existing")).toContainText("uncommitted changes");
  // The primary checkout is not listed twice: "Local" already means it.
  await expect(option("source")).toHaveCount(0);
  // Picking an existing worktree keeps Desktop on Local and routes cwd through the policy.
  await option("260901-existing").click();
  await expect(menu).toHaveCount(0);
  await expect(picker).toContainText("260901-existing");
  await expect(picker).toHaveAttribute("data-codexhost-draft-worktree-kind", "worktree");
  await expect(runLocation).toHaveText("Local");
  expect(await selections()).toEqual(["/workspace/source-worktrees/codex/260901-existing"]);
  expect(JSON.parse((await storedPick()) as string)).toMatchObject({
    kind: "worktree",
    root: "/workspace/source-worktrees/codex/260901-existing",
  });
  // Desktop's own anonymous worktree mode is still reachable and clears the Host pick.
  await picker.click();
  await option("Temporary worktree").click();
  await expect(runLocation).toHaveText("Worktree");
  await expect(picker).toHaveAttribute("data-codexhost-draft-worktree-kind", "desktop");
  expect(await selections()).toEqual(["/workspace/source-worktrees/codex/260901-existing", null]);
  // Creating: bad names are rejected inline, Host errors are shown, success selects it.
  await picker.click();
  await option("create").click();
  const nameInput = menu.locator("input");
  await expect(nameInput).toHaveValue("260903-");
  await nameInput.fill("Bad Name");
  await nameInput.press("Enter");
  await expect(menu.locator(".codexhost-draft-worktree-error")).toContainText(/yyMMdd/);
  await nameInput.fill("260903-taken");
  await nameInput.press("Enter");
  await expect(menu.locator(".codexhost-draft-worktree-error")).toContainText(
    "Branch already exists",
  );
  await nameInput.fill("260903-picker");
  await nameInput.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(picker).toContainText("260903-picker");
  await expect(runLocation).toHaveText("Local");
  expect(await page.evaluate("globalThis.__worktreeCreateParams")).toEqual({
    projectRoot: "/workspace/source",
    name: "260903-picker",
    lane: "codex",
  });
  expect(await selections()).toEqual([
    "/workspace/source-worktrees/codex/260901-existing",
    null,
    "/workspace/source-worktrees/codex/260903-picker",
  ]);
  // Submitting the draft removes the chip and releases the Host pick; the next
  // draft starts on Local again and only highlights the remembered worktree.
  type FixtureFiber = {
    return: {
      memoizedProps: { conversationId: string | null; setComposerMode(value: string): void };
    };
  };
  const setDraftConversation = (conversationId: string | null) =>
    runLocation.evaluate((node, nextId) => {
      const fiber = (node as unknown as Record<string, FixtureFiber | undefined>)[
        "__reactFiber$fixture"
      ];
      if (fiber) fiber.return.memoizedProps.conversationId = nextId;
      node.setAttribute("title", `draft:${String(nextId)}`);
    }, conversationId);
  await setDraftConversation("thread-submitted");
  await expect(picker).toHaveCount(0);
  expect(await selections()).toEqual([
    "/workspace/source-worktrees/codex/260901-existing",
    null,
    "/workspace/source-worktrees/codex/260903-picker",
    null,
  ]);
  await setDraftConversation(null);
  await expect(picker).toHaveAttribute("data-codexhost-draft-worktree-kind", "local");
  await expect(runLocation).toHaveText("Local");
  await picker.click();
  await expect(option("260903-picker")).toContainText("last used");
  await expect(option("260903-picker")).toHaveAttribute("aria-checked", "false");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  const editor = page.locator('[data-codex-composer][contenteditable="true"]');
  await composer.evaluate((node) => {
    const stop = node.ownerDocument.createElement("button");
    stop.setAttribute("aria-label", "Stop");
    node.append(stop);
  });
  // A running Turn pauses the header actions instead of letting the Host reject them.
  await expect(header).toHaveAttribute("data-streaming", "true");
  await expect(page.locator('[data-codexhost-turn-action="edit"]')).toBeDisabled();
  await editor.click();
  await editor.evaluate((node) => {
    node.textContent = "现在是第二段";
  });
  await editor.press("Enter");
  await expect(editor).toHaveText("");
  await expect(page.locator("[data-codexhost-prompt-ghost]")).toHaveCount(0);
  await composer.evaluate((node) => node.querySelector('[aria-label="Stop"]')?.remove());
  await expect(header).toHaveAttribute("data-streaming", "false");
  await expect(page.locator('[data-codexhost-turn-action="edit"]')).toBeEnabled();
  const ghost = page.locator("[data-codexhost-prompt-ghost]");
  await expect(ghost).toBeVisible();
  await expect(ghost).toContainText("现在是第二段");
  await editor.click();
  await editor.press("Tab");
  await expect(editor).toContainText("现在是第二段");

  await page.evaluate("globalThis.disposeBinding()");
  await expect(nativeChanges).toBeVisible();
  await expect(nativeReview).toBeVisible();
  await expect(header).toHaveCount(0);
  await expect(page.locator("[data-codexhost-transcript-reserve]")).toHaveCount(0);
});
