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

#### Scenario: Renderer asks about changed paths outside every root

- **WHEN** inspect params carry `extraPaths` with absolute file paths
- **THEN** Host SHALL resolve each path's nearest existing ancestor directory to its Git toplevel and include a toplevel not already listed as an `external` row
- **AND** a relative path, a path inside an already listed root, or a path with no Git toplevel SHALL add no row
- **AND** Host SHALL NOT create, remove, or check out anything while resolving

### Requirement: Host lists and creates project worktrees on request

Host SHALL serve `codexhost/workspace/worktree/list { projectRoot }` and `codexhost/workspace/worktree/create { projectRoot, name, lane?, baseRef? }` without involving the official app-server or any Thread. `projectRoot` MAY be the primary checkout or any linked worktree of the same family; Host SHALL resolve the family's primary checkout from the common Git directory. `list` SHALL return `{ primaryRoot, worktrees[], suggestedName }` where each entry carries `root, name, branch, headSha, lane, dirty, isPrimary`, the primary checkout sorts first, and `suggestedName` is `yyMMdd-` in GMT+8. `create` SHALL add exactly one linked worktree at `{parent}/{Repo}-worktrees/{lane}/{name}` on the new branch `{lane}/{name}` (lane default `codex`, base `HEAD` unless `baseRef`), and Host SHALL never remove, prune, or check out an existing worktree or branch through these methods.

#### Scenario: Listing from a linked worktree

- **WHEN** `projectRoot` is a linked worktree of repository `Repo`
- **THEN** `primaryRoot` SHALL be `Repo`'s primary checkout and the list SHALL include both the primary checkout (`isPrimary: true`, first) and every linked worktree with its branch and dirty state

#### Scenario: Creating a named worktree

- **WHEN** `create` is called with `name: "260903-picker"` and no lane
- **THEN** Host SHALL run `git worktree add -b codex/260903-picker <parent>/Repo-worktrees/codex/260903-picker HEAD` and return the described entry with `lane: "codex"`, `isPrimary: false`

#### Scenario: Refusing unsafe creation

- **WHEN** `name` does not match `^\d{6}-[a-z0-9][a-z0-9-]{1,40}$`, the target path already exists, the branch already exists, `baseRef` is unknown, or `projectRoot` is relative or outside a Git repository
- **THEN** Host SHALL reply with error `-32602` and SHALL leave the repository unchanged
