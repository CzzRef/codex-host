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
