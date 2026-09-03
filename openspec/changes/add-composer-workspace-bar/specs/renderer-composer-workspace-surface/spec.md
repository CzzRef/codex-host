## ADDED Requirements

### Requirement: Renderer mounts a compact changed-files surface beside the Composer

The Renderer SHALL mount a codexhost-owned workspace surface as a `document.body` child positioned `fixed` directly above a verified `[data-codex-composer-root]`, horizontally aligned to the Composer box, without consuming transcript layout. It SHALL NOT insert into the Composer's parent, `data-above-composer-portal`, or React-owned transcript nodes, so that transformed or filtered ancestors cannot offset it. Unsupported or ambiguous Composer identities SHALL render nothing.

#### Scenario: Thread cwd is known

- **WHEN** a connected Thread Composer root is unique and visible
- **AND** workspace inspection returns a primary repository
- **THEN** the Renderer SHALL show one compact, single-line surface above the Composer whose first chip is the core workspace (the Thread cwd root) with its Worktree identity and branch, marked as core
- **AND** the core chip SHALL remain visible while the conversation has no file changes

#### Scenario: Conversation file changes are available

- **WHEN** conversation file-change data is present for the Composer Thread
- **THEN** the Renderer SHALL add the right-side file disclosure
- **AND** SHALL show per-repository conversation additions/deletions on each chip that has any, never repository diff totals
- **AND** MAY show conversation-file aggregate additions/deletions beside the right-side file disclosure

#### Scenario: Composer identity is unsupported

- **WHEN** Composer roots are missing, hidden, or ambiguous
- **THEN** the Renderer SHALL not insert a workspace surface

### Requirement: Changed-file ownership filters repository locations

The Host SHALL continue inspecting the complete repository array, including primary roots, submodules, sibling Worktrees, additional roots, and external roots resolved from `extraPaths`. The Renderer SHALL group conversation-changed files by owning repository. Relative file paths SHALL resolve from the primary repository, while absolute paths SHALL use the longest matching repository root. Besides the core repository, only repositories whose owned conversation files have a non-zero line change SHALL appear as chips.

#### Scenario: Unrelated Git roots are inspected

- **WHEN** inspection returns multiple Git roots
- **AND** conversation-changed files belong to only the core root
- **THEN** only the core chip SHALL appear in the compact workspace line

#### Scenario: Changed files span roots

- **WHEN** absolute conversation-changed file paths map to more than one inspected root
- **THEN** each involved root SHALL appear once in the compact workspace line with its own additions/deletions
- **AND** a root whose owned files total zero changed lines SHALL NOT appear as a chip, although its files stay listed in the file disclosure

#### Scenario: Changed file lies outside every inspected root

- **WHEN** an absolute conversation-changed path matches no inspected root
- **THEN** the Renderer SHALL re-inspect once with that path in `extraPaths`
- **AND** SHALL render the resolved `external` repository as its own chip
- **AND** SHALL keep passing the same `extraPaths` on later re-inspections of that Thread

#### Scenario: Chips overflow the single line

- **WHEN** the repository chips do not fit the Composer width
- **THEN** trailing chips SHALL collapse behind one `+N` chip
- **AND** hovering or activating `+N` SHALL reveal the hidden chips without changing the line height

### Requirement: Conversation files follow File Change Item change sets

The Renderer SHALL key conversation file changes by File Change Item (`itemId`). A later `item/fileChange/patchUpdated` for the same Item SHALL replace that Item's earlier change set, and an empty change set SHALL retire the Item's files. Files touched by several Items SHALL appear once with summed line counts. Updates without an Item id SHALL merge by path under one Turn-scoped key.

#### Scenario: Agent reverts an edit

- **WHEN** a File Change Item that previously reported files reports an empty change set
- **THEN** those files SHALL disappear from the file disclosure and from repository chip statistics

### Requirement: Live identity follows Host notifications

The Renderer SHALL subscribe to `codexhost/thread/workspace/updated` through the owned request manager and SHALL re-inspect only the notified Thread. It SHALL fail closed when the request manager is absent.

#### Scenario: Worktree HEAD changes

- **WHEN** a workspace-updated notification arrives for the Composer Thread
- **THEN** the visible rows SHALL match the next successful inspection

### Requirement: File changes expand from the right and replace duplicate native summaries

The codexhost file-change disclosure SHALL occupy the right edge of the compact workspace surface after the repository chips. It SHALL show the current file count and conversation-file aggregate additions/deletions. Its file list SHALL align to the right edge and float upward above the compact line, grouped by owning repository when more than one is involved, and hovering or focusing a file SHALL show a diff preview. The preview SHALL be an interactive `document.body` overlay sized for reading (up to `min(560px, 60vw)` by `min(420px, 50vh)`), placed beside the file list (left first, right as fallback) so it never covers the list, and kept above the Composer. It SHALL stay open while the pointer moves from the file row into the preview, hide after a short grace when the pointer leaves both, and hide on `Escape`. While this replacement is available, the Renderer SHALL hide Desktop's duplicate top Changes summary and bottom Review/diff control without removing their event handlers. It SHALL restore native controls when the replacement is unavailable or disposed, and SHALL NOT hide them while only the core chip is shown.

#### Scenario: User expands changed files

- **WHEN** the user opens the right-side codexhost file-change disclosure
- **THEN** the file list SHALL align to the right edge and appear above the compact workspace line without increasing the Composer's layout height
- **AND** hovering a file SHALL show its diff preview beside the list, with the file path and its additions/deletions in the header
- **AND** moving the pointer into the preview SHALL keep it open and scrollable
- **AND** selecting a file SHALL hide the preview and enter that file's native change display

#### Scenario: Replacement surface is available

- **WHEN** the codexhost file-change disclosure is mounted for the active Thread
- **THEN** duplicate native Changes and Review/diff controls SHALL be hidden
- **AND** selecting a codexhost file SHALL still route through the retained native Review behavior

#### Scenario: Replacement surface is unavailable

- **WHEN** no codexhost file-change disclosure is mounted or the extension is disposed
- **THEN** native Changes and Review/diff controls SHALL remain visible

### Requirement: Worktree preference controls the official new-chat execution mode

For a new-chat draft with one verified official run-location control and one official branch control, the Renderer SHALL route the persisted Worktree preference through Codex Desktop's owned `setComposerMode` state. The preference SHALL default to unchecked. Checked SHALL select `worktree`; unchecked SHALL select `local`. Only an explicit checkbox change SHALL persist the preference: a Composer mode observed from Desktop's own run-location control SHALL update the checkbox for the current draft and SHALL NOT be persisted. The Renderer SHALL NOT invoke Git or provision a Worktree itself.

#### Scenario: Unset preference keeps a new draft Local

- **GIVEN** the preference has never been written
- **WHEN** a verified new-chat draft reports `worktree`
- **THEN** the Renderer SHALL set the official Composer mode to `local`
- **AND** SHALL NOT write any preference value

#### Scenario: Checked preference selects a new Worktree

- **GIVEN** the current surface is a new-chat draft and the user has checked the preference
- **WHEN** the official run-location control currently reports `local`
- **THEN** the Renderer SHALL set the official Composer mode to `worktree`
- **AND** Codex Desktop SHALL remain responsible for provisioning the Worktree when the draft is submitted

#### Scenario: User opts out of a new Worktree

- **WHEN** the user unchecks the preference on a verified new-chat draft
- **THEN** the Renderer SHALL set the official Composer mode to `local`
- **AND** SHALL persist the unchecked preference

#### Scenario: Desktop-side mode change is not persisted

- **GIVEN** a verified new-chat draft whose persisted preference is unchecked
- **WHEN** Desktop's own run-location control switches that draft to `worktree`
- **THEN** the checkbox SHALL show checked for that draft
- **AND** the persisted preference SHALL remain unchecked
- **AND** the next verified new-chat draft SHALL start on `local`

#### Scenario: Mode ownership is unsupported or belongs to an existing Thread

- **WHEN** the run-location React ownership chain is missing, ambiguous, unsupported, or carries a non-null conversation id
- **THEN** the Renderer SHALL render no Worktree checkbox
- **AND** SHALL NOT change Composer mode, Thread cwd, branch state, or Git Worktrees
