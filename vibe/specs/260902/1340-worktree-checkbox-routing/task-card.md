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
      "head": "40e890fd18d44d8577fcf9c90833abb600d54040",
      "upstream": null
    }
  ],
  "commit_mode": "verified-milestone",
  "push_mode": "current-message-only",
  "verification_state": "planned",
  "push_state": "not-authorized",
  "integration_state": "not-started",
  "next_action": "review the verified implementation and integrate it into czz-dev"
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

## Verification evidence

- Renderer unit suite: 32 files, 225 tests passed.
- Composer Playwright E2E: 1 passed; checked selects Worktree, unchecked selects Local and persists `0`, re-check selects Worktree.
- Focused TypeScript build: `shared-contracts` + `renderer-extension` passed.
- Renderer production bundle build passed.
- Focused ESLint and package-boundary checks passed.
- Prettier check passed.
- OpenSpec `add-composer-workspace-bar --strict` passed with `@fission-ai/openspec@1.10.0`.
- Full root TypeScript build remains blocked by absent optional/private `@deepseek-ai/dsh-*` declarations in the shared dependency installation; the focused affected projects passed.

## Documentation impact

- `doc_drift: resolved` — OpenSpec requirement, design, tasks, implementation, unit tests, and E2E now agree.
- Memory routing: no reusable product knowledge or ADR; the build-environment blocker is reported, not treated as feature failure.
