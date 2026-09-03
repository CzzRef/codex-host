## Why

Codex Desktop's Thread Composer has an empty slot above the input. Users currently cannot see which Git repository, worktree, or submodule the active Thread is bound to without leaving the chat. Claude Code already shows a compact repo/branch/worktree chip plus working-tree stats at that location. Official Desktop already knows Git/worktree state for Home tasks and the review panel, but the Thread composer footer does not surface it.

## What Changes

- Add a Host Thread workspace inspection RPC that reads Git roots from the Thread cwd, including linked worktrees and submodules, without creating or deleting worktrees.
- Render a codexhost-owned list above the Thread Composer showing each repository, current branch, worktree identity, and live dirty stats.
- Keep the list live when HEAD, the worktree, or the Thread cwd changes.
- Later slices in this change: conversation-scoped file-change summary, an official Switch-branch worktree checkbox defaulting to a new worktree, and Tab-reusable implicit composer prompts.
- Slice 3 of the 260903 worktree surface overhaul replaces that checkbox with a Host-managed draft worktree picker: Host lists and creates named linked worktrees (`codexhost/workspace/worktree/list|create`, additive only), the desktop-control draft policy rewrites the draft's `thread/start` cwd, and the Renderer offers Local / Desktop temporary worktree / existing / new.

## Capabilities

### New Capabilities

- `thread-workspace-inspection`: Host inspects Git workspace identity for a Thread cwd.
- `renderer-composer-workspace-surface`: browser-safe Composer-adjacent repository/worktree list.

### Modified Capabilities

- Desktop-provisioned Worktree Fork ownership stays unchanged. Since slice 3, Host owns the additive half of worktree lifecycle for new drafts (list and create); it still never removes or checks out worktrees.

## Impact

- `packages/shared-contracts`: workspace snapshot schema and inspect params.
- `packages/host-runtime`: Git inspect, watch, and `codexhost/thread/workspace/*` RPC.
- `packages/renderer-extension`: Composer-adjacent list, request-manager client, draft worktree picker, tests.
- `packages/desktop-control`: draft policy `selectWorkspace` / `draftCwd` and the `thread/start` cwd rewrite.
- No Harness Adapter, Mapping Store format, or official app-server passthrough changes.
