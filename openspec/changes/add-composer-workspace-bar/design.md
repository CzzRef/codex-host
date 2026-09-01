## Context

Live Codex Desktop Thread Composer (`data-composer-placement="thread"`) sits in a `flex flex-col gap-2` parent with no sibling above it. Official `data-above-composer-portal` exists as a React child but is empty and `empty:hidden`. Inserting into that portal is wiped on re-render. The established pattern is a renderer-owned sibling immediately before `[data-codex-composer-root]`.

Renderer code cannot run Git. Thread cwd already exists on external Mapping Store records and on official `thread/read`. Desktop already exposes worktree/branch UI on Home and in the review panel (`composer.footer.branchSwitch`, `worktree-environment-dropdown`) but not as a persistent Thread composer chip.

## Goals / Non-Goals

**Goals:**

- Show every Git root under the active Thread cwd as a list (primary + submodules).
- Distinguish a linked worktree from the primary checkout and refresh when HEAD or gitdir changes.
- Fail closed when cwd, Git, or Composer identity is missing.

**Non-Goals (this slice):**

- Creating, deleting, or checking out worktrees.
- Changing an existing Thread cwd in place.
- Tab ghost prompts or conversation file-change aggregation (later slices).
- Hijacking private Desktop `git` IPC (`codex-worktrees`, `submodule-paths`).

## Decisions

### 1. Host inspects Git from Thread cwd

`codexhost/thread/workspace/inspect` resolves cwd from the external record or official `thread/read`, then enumerates Git roots. The Renderer never runs `git`.

### 2. Submodule list is the core presentation

A single-root workspace still renders one row. Multiple roots render as a list; the parent repo is not a collapsed summary that hides children.

### 3. Display-only worktree identity

`git rev-parse --git-dir` / `--git-common-dir` and `git worktree list` identify a linked worktree. Host does not call `git worktree add`.

### 4. Insert beside the Composer contract

Mount a renderer-owned node as the previous sibling of the verified Composer root. Re-attach through the existing MutationObserver. Do not write into `data-above-composer-portal`.

### 5. Push updates, do not poll from the browser

Host watches Git identity files for inspected Thread cwds and notifies `codexhost/thread/workspace/updated`. The Renderer re-inspects that Thread, matching Usage.

## Risks / Trade-offs

- Desktop DOM contract changes hide the bar; the Composer remains usable.
- Official Thread cwd depends on `thread/read`; missing cwd renders nothing.
- File watchers are cwd-refcounted so many Threads sharing a repo share one watch.

## Migration Plan

1. Ship the read-only bar.
2. Add conversation file-change summary into the same surface.
3. Add the official Switch-branch worktree checkbox without taking Git lifecycle away from Desktop.
4. Add Tab-reusable implicit prompts as a separate high-risk slice.
