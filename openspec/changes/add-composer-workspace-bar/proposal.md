## Why

Codex Desktop's Thread Composer has an empty slot above the input. Users currently cannot see which Git repository, worktree, or submodule the active Thread is bound to without leaving the chat. Claude Code already shows a compact repo/branch/worktree chip plus working-tree stats at that location. Official Desktop already knows Git/worktree state for Home tasks and the review panel, but the Thread composer footer does not surface it.

## What Changes

- Add a Host Thread workspace inspection RPC that reads Git roots from the Thread cwd, including linked worktrees and submodules, without creating or deleting worktrees.
- Render a codexhost-owned list above the Thread Composer showing each repository, current branch, worktree identity, and live dirty stats.
- Keep the list live when HEAD, the worktree, or the Thread cwd changes.
- Later slices in this change: conversation-scoped file-change summary, an official Switch-branch worktree checkbox defaulting to a new worktree, and Tab-reusable implicit composer prompts.

## Capabilities

### New Capabilities

- `thread-workspace-inspection`: Host inspects Git workspace identity for a Thread cwd.
- `renderer-composer-workspace-surface`: browser-safe Composer-adjacent repository/worktree list.

### Modified Capabilities

- None. Desktop-provisioned Worktree Fork ownership stays unchanged. Host still does not own Git worktree lifecycle in this slice.

## Impact

- `packages/shared-contracts`: workspace snapshot schema and inspect params.
- `packages/host-runtime`: Git inspect, watch, and `codexhost/thread/workspace/*` RPC.
- `packages/renderer-extension`: Composer-adjacent list, request-manager client, tests.
- No Harness Adapter, Mapping Store format, or official app-server passthrough changes.
