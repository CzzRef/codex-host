```json worktree-task-v1
{
  "schema": "worktree-task/v1",
  "task_id": "260901-composer-workspace-bar",
  "control_plane": "app-root",
  "target_branch": "czz-dev",
  "repositories": [
    {
      "repo_id": "codex-host",
      "base_sha": "820d2ac9ff9e0b8f1e32ff60cefe266e97c23be4",
      "worktree_branch": "codex/260901-composer-workspace-bar",
      "task_owner": "openspec/changes/add-composer-workspace-bar/tasks.md",
      "head": "820d2ac9ff9e0b8f1e32ff60cefe266e97c23be4",
      "upstream": null
    }
  ],
  "commit_mode": "verified-milestone",
  "push_mode": "current-message-only",
  "verification_state": "planned",
  "push_state": "not-authorized",
  "integration_state": "not-started",
  "next_action": "implement composer workspace bar milestone"
}
```

## 1. Workspace inspection contract

- [x] 1.1 Add Thread workspace snapshot and inspect-params schemas
- [x] 1.2 Export inspect/updated method names from shared-contracts and renderer client
- [x] 1.3 Cover valid primary/submodule/worktree snapshots and fail-closed empty lists

## 2. Host Git inspect and watch

- [x] 2.1 Inspect Thread cwd Git roots including submodules and linked worktrees
- [x] 2.2 Do not create, delete, or check out worktrees
- [x] 2.3 Watch Git identity files and emit workspace-updated for inspected Threads
- [x] 2.4 Route `codexhost/thread/workspace/inspect` from AppServerHost

## 3. Composer workspace list

- [x] 3.1 Mount a renderer-owned list as the previous sibling of the Composer root
- [x] 3.2 Render one row per repository with name, branch, and worktree identity
- [x] 3.3 Re-inspect on workspace-updated and Composer Thread identity changes
- [x] 3.4 Hide the list when inspection is empty or Composer identity is unsupported

## 4. Later slices

- [x] 4.1 Conversation-scoped file-change summary in the same surface
- [x] 4.2 Official Switch-branch worktree checkbox defaulting to a new worktree
- [x] 4.3 Tab-reusable implicit composer prompts

## 5. Validation

- [x] 5.1 Host inspect tests for primary, submodule, worktree, and missing Git
- [x] 5.2 Renderer tests for insertion, list rows, empty hide, and notification refresh
- [x] 5.3 Focused typecheck and affected vitest
- [x] 5.4 Chromium E2E for Composer repository rows, conversation files, branch worktree toggle, and Tab reuse

## 6. Sibling worktrees and additional roots

- [x] 6.1 Enumerate `git worktree list --porcelain` roots of the primary checkout as `worktree` rows
- [x] 6.2 Accept Thread `runtimeWorkspaceRoots` as `additional` rows without creating or checking out anything
- [x] 6.3 Contract kinds `worktree` / `additional`; Host and shared-contracts tests for both

## 7. Worktree checkbox routing correction

- [x] 7.1 Specify checked/unchecked routing through Desktop-owned new-chat Composer mode
- [x] 7.2 Bind only a verified null-conversation run-location React owner and fail closed elsewhere
- [x] 7.3 Cover mode routing, semantic ownership, false-positive labels, and Composer E2E
- [x] 7.4 Run focused renderer tests, TypeScript typecheck, and strict OpenSpec validation

## 8. Compact changed-files workspace surface

- [x] 8.1 Filter workspace locations to repositories owning conversation-changed files and render only Worktree identity plus branch on one line
- [x] 8.2 Move the file disclosure first and float its expanded list upward without Composer reflow
- [x] 8.3 Preserve file hover previews and native Review routing while conditionally hiding duplicate native Changes/Review controls
- [x] 8.4 Cover ownership filtering, native fallback/restoration, upward placement, and hover preview in focused unit/E2E verification

## 9. Right-side changed-file disclosure

- [x] 9.1 Keep changed-file Worktree identity and branch on the left of the compact line
- [x] 9.2 Move the file disclosure to the right and show file count plus aggregate conversation-file additions/deletions
- [x] 9.3 Align the upward file panel to the right edge and preserve direct file-to-native-change navigation
- [x] 9.4 Update preview and E2E coverage for the attached-reference layout

## 10. Default Local and explicit-only persistence

- [x] 10.1 Default the persisted Worktree preference to unchecked (`local`) when unset or unreadable
- [x] 10.2 Persist the preference only from an explicit checkbox change, never from an observed Desktop mode
- [x] 10.3 Cover default, opt-in/opt-out, unpersisted Desktop-side switch, and next-draft fallback in unit and Composer E2E
- [x] 10.4 Run focused renderer tests, TypeScript typecheck, and strict OpenSpec validation
