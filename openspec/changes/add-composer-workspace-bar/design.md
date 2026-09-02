## Context

Live Codex Desktop Thread Composer (`data-composer-placement="thread"`) sits in a `flex flex-col gap-2` parent with no sibling above it. Official `data-above-composer-portal` exists as a React child but is empty and `empty:hidden`. Inserting into that portal is wiped on re-render. The established pattern is a renderer-owned sibling immediately before `[data-codex-composer-root]`.

Renderer code cannot run Git. Thread cwd already exists on external Mapping Store records and on official `thread/read`. Desktop already exposes worktree/branch UI on Home and in the review panel (`composer.footer.branchSwitch`, `worktree-environment-dropdown`) but not as a persistent Thread composer chip.

## Goals / Non-Goals

**Goals:**

- Keep complete Host inspection of Git roots under the active Thread cwd.
- Present only the Worktree identity and branch that own conversation-changed files in one compact line.
- Put the codexhost changed-file disclosure first, float its list upward, and retain hover diff previews.
- Suppress duplicate native Changes/Review controls only while the codexhost replacement is available.
- Fail closed when cwd, Git, changed-file ownership, or Composer identity is missing.

**Non-Goals (this slice):**

- Creating, deleting, or checking out worktrees.
- Changing an existing Thread cwd in place.
- Replacing the native diff viewer or parsing Git diffs in the Renderer.
- Hijacking private Desktop `git` IPC (`codex-worktrees`, `submodule-paths`).

## Decisions

### 1. Host inspects Git from Thread cwd

`codexhost/thread/workspace/inspect` resolves cwd from the external record or official `thread/read`, then enumerates Git roots. The Renderer never runs `git`.

### 2. Changed-file ownership is the presentation filter

Host inspection still returns the complete primary/submodule/sibling-Worktree/additional-root inventory. Renderer presentation maps conversation file paths to that inventory and shows only owning locations. Relative paths resolve against the primary root; absolute paths choose the longest root prefix so nested submodules win over their parent.

Each visible location is reduced to Worktree identity plus branch on one non-wrapping line. Repository names and aggregate diff totals are omitted because the adjacent file disclosure already carries file-level context.

### 3. Display-only worktree identity

`git rev-parse --git-dir` / `--git-common-dir` and `git worktree list` identify a linked worktree. Host does not call `git worktree add`.

### 4. Insert beside the Composer contract

Mount a renderer-owned node as the previous sibling of the verified Composer root. Position it as a fixed overlay above the Composer so opening the absolute-positioned file list upward does not reflow or split Composer interaction. Re-attach and reposition through the existing MutationObserver and viewport listeners. Do not write into `data-above-composer-portal`.

### 5. Push updates, do not poll from the browser

Host watches Git identity files for inspected Thread cwds and notifies `codexhost/thread/workspace/updated`. The Renderer re-inspects that Thread, matching Usage.

### 6. Codexhost file disclosure conditionally replaces native summaries

The file disclosure leads the compact line. Its list opens upward in a bounded floating panel; each file keeps the existing hover diff preview and native Review routing. While this replacement exists, recognized official top Changes and bottom Review/diff controls receive a codexhost marker whose stylesheet hides them without deleting nodes or handlers. The marker is removed whenever no replacement exists and on dispose, preserving a native fallback under contract drift or missing file notifications.

### 7. Worktree checkbox drives Desktop-owned Composer mode

The checkbox is an alternative control for Codex Desktop's existing new-chat run-location state, not a Git operation. The Renderer accepts exactly one `button[data-composer-navigation-target="run-location"]` whose reviewed React ownership chain exposes `composerMode`, `setComposerMode`, and a null `conversationId`. It calls the official state setter with `worktree` or `local`, then lets Desktop provision the selected destination on submission.

Existing Threads, ambiguous ownership, unsupported modes, and label-only DOM matches fail closed without rendering the checkbox. This avoids moving an active Thread, scraping localized menu labels, or taking Worktree lifecycle away from Desktop.

## Risks / Trade-offs

- Desktop DOM contract changes hide the bar; the Composer remains usable.
- Official Thread cwd depends on `thread/read`; missing cwd renders nothing.
- Conversation files not observed by the Renderer cannot be mapped, so native diff controls remain as the fallback.
- File watchers are cwd-refcounted so many Threads sharing a repo share one watch.
- The run-location binding is version-locked to a reviewed React ownership chain; Desktop contract drift hides the checkbox instead of leaving a misleading checked control.

## Migration Plan

1. Keep Host workspace inspection and notifications unchanged.
2. Filter the Renderer line to changed-file owners and move the file disclosure first.
3. Float the file list upward and conditionally hide duplicate native controls.
4. Re-run renderer unit/E2E, typecheck, formatting, lint, build, and strict OpenSpec validation before integration.
