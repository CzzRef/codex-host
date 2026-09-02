# Worktree checkbox routing fix

Tool: pi
Date: 2026-09-02
Status: implemented / integrated into czz-dev (`c9ee09b`)

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

## Requirement Change Review — right-side file disclosure

- Added: show conversation-file aggregate additions/deletions in the compact line, matching the attached visual reference without adopting unrelated `Create PR` or close actions.
- Changed: keep changed-file Worktree identity and branch on the left, and move the file-count/disclosure control plus aggregate stats to the right edge.
- Changed: align the expandable file panel to the right edge as a sidebar-like floating list; each file remains directly clickable into its native change display.
- Removed: none; native duplicate controls remain conditionally hidden only while the codexhost replacement is available.
- Superseded: the previous follow-up's requirement that the file disclosure must be the leading/left-most control. The explicit current request replaces it with a trailing/right-side disclosure.
- Conflicting: the active OpenSpec currently says the disclosure leads the compact line. The explicit current request wins; requirement, design, preview, implementation, and tests are updated together.
- Decision source: `explicit-current-request` plus attached visual reference.

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
      "head": "142fcfbd9cc3259a0a39e1195fc19a833f9fcc3c",
      "upstream": null
    }
  ],
  "commit_mode": "verified-milestone",
  "push_mode": "current-message-only",
  "verification_state": "verified-commit",
  "push_state": "not-authorized",
  "integration_state": "integrated",
  "next_action": "parked; resume later without removing the worktree"
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
- Lifecycle/documentation milestone: `63b063b` (`docs(task): record compact workspace verification`).
- The managed-worktree lifecycle receipt was refreshed over the complete verified branch prefix after the follow-up commits advanced HEAD.
- Renderer unit suite: 32 files, 226 tests passed.
- Composer Playwright E2E: 1 passed; verifies one changed-file owner, unrelated-root filtering, single-line content, native duplicate suppression/restoration, upward list placement, hover preview, and hidden-native Review routing.
- Full root `npm run typecheck` passed from the child Worktree using the complete temporary dependency mirror.
- Renderer production bundle, focused ESLint, package-boundary check, Prettier, and `git diff --check` passed.
- OpenSpec `add-composer-workspace-bar --strict` passed with `@fission-ai/openspec@1.10.0`.
- Project AI rule audit and changed-document code-link audit passed through the temporary nested-Worktree path bridge; the bridge was removed afterward.
- ego-browser visual QA confirmed the disclosure is first, exactly one Worktree/branch row is visible, the list opens upward, the hover preview appears beside it, and the legacy native mock is hidden.
- The first verification attempt ran read-only checks from the control checkout because Bash retained the harness cwd. No task source was written there; all material checks were rerun with an asserted child-Worktree cwd, and the reusable trap is recorded below.

## Right-side file disclosure implementation

- The attached image was treated only as a visual reference: unrelated `Create PR` and close controls were not adopted.
- Changed-file Worktree identity and branch now occupy the left side of the compact line without pill-style repository inventory chrome.
- The right-side disclosure shows current file count plus additions/deletions aggregated from the displayed conversation files, not repository-wide Git totals.
- Expanding the disclosure opens a bounded panel upward and aligned to the right edge; hovering still previews the diff, and clicking a file routes to that file in Desktop's retained native Review flow.

## Right-side follow-up verification evidence

- Renderer unit suite: 32 files, 226 tests passed; aggregate conversation-file stats and changed-file owner filtering are covered.
- Composer Playwright E2E: 1 passed; verifies left/right DOM order, `+8/-2` aggregate stats, upward-right panel alignment, hover preview, native duplicate suppression/restoration, and file-to-native-change routing.
- Full root TypeScript typecheck, Renderer production bundle, focused ESLint, package-boundary check, Prettier, and `git diff --check` passed.
- OpenSpec `add-composer-workspace-bar --strict` passed.
- ego-browser visual QA confirmed Worktree/branch first, summary last, right-edge list alignment, upward expansion, left-side hover preview, and clickable file behavior.
- The first lifecycle receipt attempt was blocked with `task_contract_identity` because the task owner manually changed `verification_state` away from the canonical `verified-commit` mode. Restoring that mode made the same receipt and commit gates pass; the reusable contract trap is recorded below.

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
- Memory routing: retained the build trap in [Root `node_modules` symlink misses workspace-local dependencies](../../../knowledge/error-memory/worktree-root-node-modules-symlink-misses-workspace-nested-deps.md) and the command-lane trap in [Managed-worktree Bash can default to the control checkout](../../../knowledge/error-memory/managed-worktree-bash-defaults-to-control-checkout.md); captured the follow-up receipt trap in [`mark-verified` rejects lifecycle-mode drift](../../../knowledge/error-memory/managed-worktree-mark-verified-rejects-lifecycle-mode-drift.md). No ADR was needed.
