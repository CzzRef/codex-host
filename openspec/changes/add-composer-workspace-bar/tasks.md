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
