## ADDED Requirements

### Requirement: Renderer mounts a workspace list beside the Composer

The Renderer SHALL insert a codexhost-owned workspace list as the previous sibling of a verified `[data-codex-composer-root]`. It SHALL NOT insert into `data-above-composer-portal` or React-owned transcript nodes. Unsupported or ambiguous Composer identities SHALL render nothing.

#### Scenario: Thread Composer is present

- **WHEN** a connected Thread Composer root is unique and visible
- **AND** workspace inspection returns at least one repository
- **THEN** the Renderer SHALL show one row per repository above the Composer

#### Scenario: Composer identity is unsupported

- **WHEN** Composer roots are missing, hidden, or ambiguous
- **THEN** the Renderer SHALL not insert a workspace list

### Requirement: Submodule rows are first-class

The workspace surface SHALL treat the repository array as the core UI. It SHALL NOT collapse submodules behind a single parent chip when more than one repository is present.

#### Scenario: Multiple Git roots

- **WHEN** inspection returns a primary root and one or more submodules
- **THEN** each root SHALL appear as its own row with name, branch, and worktree identity

### Requirement: Live identity follows Host notifications

The Renderer SHALL subscribe to `codexhost/thread/workspace/updated` through the owned request manager and SHALL re-inspect only the notified Thread. It SHALL fail closed when the request manager is absent.

#### Scenario: Worktree HEAD changes

- **WHEN** a workspace-updated notification arrives for the Composer Thread
- **THEN** the visible rows SHALL match the next successful inspection

### Requirement: Worktree preference controls the official new-chat execution mode

For a new-chat draft with one verified official run-location control and one official branch control, the Renderer SHALL route the persisted Worktree preference through Codex Desktop's owned `setComposerMode` state. Checked SHALL select `worktree`; unchecked SHALL select `local`. The Renderer SHALL NOT invoke Git or provision a Worktree itself.

#### Scenario: Checked preference selects a new Worktree

- **GIVEN** the current surface is a new-chat draft and the preference is checked
- **WHEN** the official run-location control currently reports `local`
- **THEN** the Renderer SHALL set the official Composer mode to `worktree`
- **AND** Codex Desktop SHALL remain responsible for provisioning the Worktree when the draft is submitted

#### Scenario: User opts out of a new Worktree

- **WHEN** the user unchecks the preference on a verified new-chat draft
- **THEN** the Renderer SHALL set the official Composer mode to `local`
- **AND** SHALL persist the unchecked preference

#### Scenario: Mode ownership is unsupported or belongs to an existing Thread

- **WHEN** the run-location React ownership chain is missing, ambiguous, unsupported, or carries a non-null conversation id
- **THEN** the Renderer SHALL render no Worktree checkbox
- **AND** SHALL NOT change Composer mode, Thread cwd, branch state, or Git Worktrees
