## ADDED Requirements

### Requirement: Renderer mounts a compact changed-files surface beside the Composer

The Renderer SHALL insert a codexhost-owned workspace surface as the previous sibling of a verified `[data-codex-composer-root]` and visually float it above the Composer without consuming transcript layout. It SHALL NOT insert into `data-above-composer-portal` or React-owned transcript nodes. Unsupported or ambiguous Composer identities SHALL render nothing.

#### Scenario: Conversation file changes are available

- **WHEN** a connected Thread Composer root is unique and visible
- **AND** conversation file-change data can be mapped to an inspected repository
- **THEN** the Renderer SHALL show one compact, single-line surface above the Composer
- **AND** SHALL show only the owning Worktree identity and branch on the left, not the full inspected repository inventory or repository diff totals
- **AND** MAY show conversation-file aggregate additions/deletions beside the right-side file disclosure

#### Scenario: Composer identity is unsupported

- **WHEN** Composer roots are missing, hidden, or ambiguous
- **THEN** the Renderer SHALL not insert a workspace surface

### Requirement: Changed-file ownership filters repository locations

The Host SHALL continue inspecting the complete repository array, including primary roots, submodules, sibling Worktrees, and additional roots. The Renderer SHALL present only repositories that own conversation-changed file paths. Relative file paths SHALL resolve from the primary repository, while absolute paths SHALL use the longest matching repository root.

#### Scenario: Unrelated Git roots are inspected

- **WHEN** inspection returns multiple Git roots
- **AND** conversation-changed files belong to only one root
- **THEN** only that root's Worktree identity and branch SHALL appear in the compact workspace line

#### Scenario: Changed files span roots

- **WHEN** absolute conversation-changed file paths map to more than one inspected root
- **THEN** each involved root SHALL appear once in the compact workspace line

### Requirement: Live identity follows Host notifications

The Renderer SHALL subscribe to `codexhost/thread/workspace/updated` through the owned request manager and SHALL re-inspect only the notified Thread. It SHALL fail closed when the request manager is absent.

#### Scenario: Worktree HEAD changes

- **WHEN** a workspace-updated notification arrives for the Composer Thread
- **THEN** the visible rows SHALL match the next successful inspection

### Requirement: File changes expand from the right and replace duplicate native summaries

The codexhost file-change disclosure SHALL occupy the right edge of the compact workspace surface after the Worktree/branch identity. It SHALL show the current file count and conversation-file aggregate additions/deletions. Its file list SHALL align to the right edge and float upward above the compact line, and hovering a file SHALL show a bounded diff preview. While this replacement is available, the Renderer SHALL hide Desktop's duplicate top Changes summary and bottom Review/diff control without removing their event handlers. It SHALL restore native controls when the replacement is unavailable or disposed.

#### Scenario: User expands changed files

- **WHEN** the user opens the right-side codexhost file-change disclosure
- **THEN** the file list SHALL align to the right edge and appear above the compact workspace line without increasing the Composer's layout height
- **AND** hovering a file SHALL show its diff preview
- **AND** selecting a file SHALL enter that file's native change display

#### Scenario: Replacement surface is available

- **WHEN** the codexhost file-change disclosure is mounted for the active Thread
- **THEN** duplicate native Changes and Review/diff controls SHALL be hidden
- **AND** selecting a codexhost file SHALL still route through the retained native Review behavior

#### Scenario: Replacement surface is unavailable

- **WHEN** no codexhost file-change disclosure is mounted or the extension is disposed
- **THEN** native Changes and Review/diff controls SHALL remain visible

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
