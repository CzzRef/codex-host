## ADDED Requirements

### Requirement: Host inspects Git workspace identity from Thread cwd

Host SHALL expose `codexhost/thread/workspace/inspect` for a Host Thread ID. It SHALL resolve cwd from the external Mapping Store record or official `thread/read` and SHALL return a snapshot of Git repositories under that cwd. It SHALL NOT create, delete, rename, or check out a Git worktree.

#### Scenario: External Thread cwd is a Git repository

- **WHEN** an external Thread record has an absolute cwd that is inside a Git repository
- **THEN** Host SHALL return that repository as the primary root with its current branch or detached HEAD

#### Scenario: Workspace has Git submodules

- **WHEN** the primary root declares submodules
- **THEN** Host SHALL include each submodule as its own repository row
- **AND** the snapshot list SHALL be the presentation source of truth

#### Scenario: Cwd is a linked Git worktree

- **WHEN** the Git directory is a linked worktree
- **THEN** Host SHALL mark that repository as a worktree and identify the primary checkout

#### Scenario: Cwd is missing or not a Git repository

- **WHEN** cwd cannot be resolved or is not inside a Git worktree
- **THEN** Host SHALL return a valid snapshot with an empty repository list rather than inventing a root

### Requirement: Host notifies workspace identity changes

Host SHALL watch Git identity files for Thread cwds that have been inspected and SHALL emit `codexhost/thread/workspace/updated` with the Thread ID when HEAD, gitdir, or index identity changes. It SHALL NOT poll from the Renderer.

#### Scenario: Branch checkout in the Thread cwd

- **WHEN** HEAD changes in an inspected Thread cwd
- **THEN** Host SHALL notify that Thread ID so the Renderer can re-inspect

#### Scenario: Primary checkout has sibling worktrees

- **WHEN** the primary root lists linked worktrees through `git worktree list --porcelain`
- **THEN** Host SHALL include each sibling worktree as its own `worktree` row after the primary and submodule rows
- **AND** it SHALL NOT create, remove, or check out any of them

#### Scenario: Thread declares additional workspace roots

- **WHEN** the Thread record or official `thread/read` carries `runtimeWorkspaceRoots` outside cwd
- **THEN** Host SHALL inspect each root that is a Git repository and include it as an `additional` row
- **AND** a root that is not a Git repository SHALL be skipped rather than invented
