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
          inspectThread: unavailable,
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

  const bar = page.locator("[data-codexhost-workspace-bar]");
  const nativeChanges = page.locator('[data-slot="thread-summary-panel-item-button"]');
  const nativeReview = page.locator('[data-tab-id="diff"]');
  const composer = page.locator("[data-codex-composer-root]");
  // The core workspace chip is always present once the Host knows the cwd,
  // even before any file changed; native diff controls stay until the bar
  // has a file disclosure to replace them with.
  await expect(bar).toBeVisible();
  await expect(page.locator("[data-codexhost-workspace-row]")).toHaveCount(1);
  await expect(page.locator('[data-codexhost-workspace-core="true"]')).toContainText("app-feature");
  await expect(page.locator("[data-codexhost-workspace-files]")).toHaveCount(0);
  await expect(nativeChanges).toBeVisible();
  await expect(nativeReview).toBeVisible();
  // Mounted on <body> so `position: fixed` is viewport-relative, yet aligned
  // to the Composer's horizontal box.
  expect(await bar.evaluate((node) => node.parentElement === node.ownerDocument.body)).toBe(true);
  const alignedBarBox = await bar.boundingBox();
  const composerBox = await composer.boundingBox();
  expect(alignedBarBox && composerBox && Math.abs(alignedBarBox.x - composerBox.x) <= 1).toBe(true);
  expect(
    alignedBarBox && composerBox && Math.abs(alignedBarBox.width - composerBox.width) <= 1,
  ).toBe(true);
  expect(
    alignedBarBox && composerBox && alignedBarBox.y + alignedBarBox.height <= composerBox.y,
  ).toBe(true);

  await page.evaluate("globalThis.emitWorkspaceFiles()");
  await expect(bar).toBeVisible();
  await expect(page.locator("[data-codexhost-workspace-row]")).toHaveCount(1);
  await expect(bar).toContainText("app-feature");
  await expect(bar).toContainText("main");
  await expect(bar).not.toContainText("vendor");
  await expect(bar).not.toContainText("+12");
  await expect(nativeChanges).toBeHidden();
  await expect(nativeReview).toBeHidden();
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
  const preview = page.locator("[data-codexhost-workspace-preview]");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("+keep");
  await expect(preview).toContainText("src/bar.ts");
  // The preview sits beside the list (never over it) and above the Composer.
  const previewBox = await preview.boundingBox();
  expect(
    previewBox &&
      fileListBox &&
      (previewBox.x + previewBox.width <= fileListBox.x ||
        previewBox.x >= fileListBox.x + fileListBox.width),
  ).toBe(true);
  expect(previewBox && barBox && previewBox.y + previewBox.height <= barBox.y + barBox.height).toBe(
    true,
  );
  // Moving the pointer into the preview keeps it (interactive, scrollable).
  await preview.hover();
  await page.waitForTimeout(250);
  await expect(preview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
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
  await expect(page.locator("[data-codexhost-workspace-files]")).toContainText("1 file change");
  // Hovering a Turn shows one floating "⋯" chip at its top-right (no rail dots
  // over the text); clicking it selects the Turn.
  await expect(page.locator("[data-codexhost-turn-hover]")).not.toHaveAttribute(
    "data-visible",
    "true",
  );
  await page.locator("[data-turn-key]").hover();
  const hoverChip = page.locator('[data-codexhost-turn-hover][data-visible="true"]');
  await expect(hoverChip).toBeVisible();
  const hoverBox = await hoverChip.boundingBox();
  const hoveredTurnBox = await page.locator("[data-turn-key]").boundingBox();
  expect(hoverBox && hoveredTurnBox && hoverBox.y >= hoveredTurnBox.y).toBe(true);
  expect(
    hoverBox &&
      hoveredTurnBox &&
      hoverBox.x + hoverBox.width <= hoveredTurnBox.x + hoveredTurnBox.width,
  ).toBe(true);
  await hoverChip.click();
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
  // No native pencil on this Turn: Edit refills the Composer with the prompt.
  const editorForEdit = page.locator('[data-codex-composer][contenteditable="true"]');
  await page.locator('[data-codexhost-turn-action="edit"]').click();
  await expect(editorForEdit).toContainText("You said: hello");
  await expect(page.locator(".codexhost-turn-notice")).toContainText("placed in the Composer");
  await editorForEdit.evaluate((node) => {
    node.textContent = "";
  });

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
  await expect.poll(() => page.evaluate("globalThis.__worktreeListRoots")).toEqual([
    "/workspace/source",
  ]);
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
  expect(await selections()).toEqual([
    "/workspace/source-worktrees/codex/260901-existing",
    null,
  ]);
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
