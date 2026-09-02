# Worktree checkbox routing fix

Tool: pi
Date: 2026-09-02
Status: implemented / focused-verified

## User request

Fix the checked Worktree control in codexhost so that it affects the official Codex Desktop branch-switch flow instead of remaining a display-only preference.

## Requirement Change Review

- Added: when the codexhost Worktree checkbox is checked, a branch selection must use Codex Desktop's own new-Worktree option.
- Added: when unchecked, branch selection must use the current-workspace option.
- Changed: the existing persisted preference becomes an executable branch-switch preference rather than display-only state.
- Removed: none.
- Superseded: none.
- Conflicting: none identified; Desktop remains the owner of Git Worktree creation and lifecycle.
- Decision source: `explicit-current-request`.

The product requirement delta belongs to the active [Composer workspace surface OpenSpec change](../../../../openspec/changes/add-composer-workspace-bar/specs/renderer-composer-workspace-surface/spec.md).

## Requirement Change Review — compact changed-files surface

- Added: move the codexhost file-change disclosure to the leading/top position and expand its file list upward as a floating panel with per-file hover diff previews.
- Changed: replace the multi-row repository inventory with one compact line that shows only the Worktree and branch owning conversation-changed files.
- Removed: hide Desktop's native top Changes summary and bottom Review/diff control while the codexhost file-change replacement is available; restore native controls when the replacement is unavailable or disposed.
- Superseded: the earlier presentation requirement that every inspected primary, submodule, sibling Worktree, or additional root must always render. Host inspection remains complete, but Renderer presentation is now filtered by changed-file ownership.
- Conflicting: this directly conflicts with the active OpenSpec's “one row per repository” and “submodule rows are first-class” wording. The explicit current request wins; the OpenSpec is updated before implementation.
- Decision source: `explicit-current-request`.

## Scope

- Wire the renderer checkbox to the official Desktop branch menu without invoking Git from the renderer.
- Fail closed when the official menu contract cannot be identified.
- Cover checked, unchecked, re-render, and unsupported-menu behavior with focused tests.
- Keep Harness Adapters and Host Git lifecycle unchanged.

```json worktree-task-v1
{
  "schema": "worktree-task/v1",
  "task_id": "260902-worktree-checkbox-routing",
  "control_plane": "app-root",
  "target_branch": "czz-dev",
  "repositories": [
    {
      "repo_id": "codex-host",
      "base_sha": "40e890fd18d44d8577fcf9c90833abb600d54040",
      "worktree_branch": "codex/260902-worktree-checkbox-routing",
      "task_owner": "vibe/specs/260902/1340-worktree-checkbox-routing/task-card.md",
      "head": "154d079fe21e5f3fbe97d0883a41131f8ccbf6ed",
      "upstream": null
    }
  ],
  "commit_mode": "verified-milestone",
  "push_mode": "current-message-only",
  "verification_state": "verified-commit",
  "push_state": "not-authorized",
  "integration_state": "not-started",
  "next_action": "integrate the verified milestones into czz-dev when the control checkout is idle, then rebuild Desktop for live verification"
}
```

## Verification plan

- Focused renderer unit tests.
- Composer workspace Playwright E2E.
- TypeScript typecheck.
- OpenSpec strict validation for `add-composer-workspace-bar`.
- Live Desktop check only if the official control can be exercised without changing unrelated user work.

## Implementation

- The checkbox now binds to the official `run-location` React owner and calls Desktop's `setComposerMode("worktree" | "local")` state setter.
- Binding requires one semantic run-location trigger, one branch control, a unique mode owner, and `conversationId: null`; existing Threads and contract drift render no checkbox.
- Branch detection no longer treats descendant transcript/tool text containing “Switch branch” as a branch control.
- Worktree creation remains owned by Codex Desktop at new-chat submission.

## Compact changed-files follow-up implementation

- The workspace surface now mounts as a 32px single-line overlay above the Composer and shows only changed-file-owning locations as Worktree identity plus branch.
- Relative changed paths map from the primary root; absolute paths select the longest matching repository root so nested submodules and sibling Worktrees remain distinguishable.
- The file disclosure leads the line; its bounded list opens upward without reflow, and mouse/focus previews retain colorized diff excerpts.
- Duplicate native top Changes and bottom Review/diff controls are hidden only while the codexhost file disclosure is mounted. Their DOM nodes and handlers remain intact for file-click routing and are restored when the replacement disappears or the extension is disposed.
- The interactive preview now matches the compact line, upward file list, and adjacent hover diff preview.

## Follow-up verification evidence

- Verified implementation milestone: `c860512` (`feat(composer): compact changed-file workspace surface`).
- Process-memory milestone: `154d079` (`docs(memory): guard managed Worktree command cwd`).
- Renderer unit suite: 32 files, 226 tests passed.
- Composer Playwright E2E: 1 passed; verifies one changed-file owner, unrelated-root filtering, single-line content, native duplicate suppression/restoration, upward list placement, hover preview, and hidden-native Review routing.
- Full root `npm run typecheck` passed from the child Worktree using the complete temporary dependency mirror.
- Renderer production bundle, focused ESLint, package-boundary check, Prettier, and `git diff --check` passed.
- OpenSpec `add-composer-workspace-bar --strict` passed with `@fission-ai/openspec@1.10.0`.
- Project AI rule audit and changed-document code-link audit passed through the temporary nested-Worktree path bridge; the bridge was removed afterward.
- ego-browser visual QA confirmed the disclosure is first, exactly one Worktree/branch row is visible, the list opens upward, the hover preview appears beside it, and the legacy native mock is hidden.
- The first verification attempt ran read-only checks from the control checkout because Bash retained the harness cwd. No task source was written there; all material checks were rerun with an asserted child-Worktree cwd, and the reusable trap is recorded below.

## Verification evidence

- Renderer unit suite: 32 files, 225 tests passed.
- Composer Playwright E2E: 1 passed; checked selects Worktree, unchecked selects Local and persists `0`, re-check selects Worktree.
- Focused TypeScript build: `shared-contracts` + `renderer-extension` passed.
- Full root `npm run typecheck` passed after the temporary dependency mirror included both root and package-local workspace `node_modules` directories.
- Renderer production bundle build passed.
- Focused ESLint and package-boundary checks passed.
- Prettier check passed.
- OpenSpec `add-composer-workspace-bar --strict` passed with `@fission-ai/openspec@1.10.0`.
- Project AI rule/link audit passed using a temporary original-layout link bridge for the nested worktree; no repository link was rewritten.
- The first full-root attempt failed because a root-only dependency link omitted package-local workspace installations. The corrected complete temporary mirror passed, and the reusable trap is recorded below.

## Documentation impact

- `doc_drift: resolved` — OpenSpec requirement, design, tasks, implementation, unit tests, and E2E now agree.
- Memory routing: retained the build trap in [Root `node_modules` symlink misses workspace-local dependencies](../../../knowledge/error-memory/worktree-root-node-modules-symlink-misses-workspace-nested-deps.md) and captured the repeated command-lane trap in [Managed-worktree Bash can default to the control checkout](../../../knowledge/error-memory/managed-worktree-bash-defaults-to-control-checkout.md); no ADR needed.
