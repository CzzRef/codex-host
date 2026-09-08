## ADDED Requirements

### Requirement: Workspace identity stays beside the Composer

The Renderer SHALL mount a compact workspace surface as the previous sibling of each verified Thread Composer. Its height SHALL participate in the Composer container layout, and the transcript column SHALL reserve its additional height at the bottom, restoring the original bottom padding on unmount. The pinned Turn header SHALL contain only turn navigation, a short task subtitle and actions. Workspace identity SHALL NOT disappear when the prompt scrolls out or when no files changed.

#### Scenario: Thread cwd is known

- **WHEN** a unique visible Thread Composer has a workspace snapshot
- **THEN** its core workspace, worktree name and branch SHALL remain visible near the input
- **AND** clicking or keyboard-activating the identity SHALL open selectable full-path details, with Escape to close
- **AND** other roots SHALL appear only when they own conversation changes

#### Scenario: Narrow Composer

- **WHEN** the Composer width changes independently of the transcript width
- **THEN** workspace chips SHALL be refitted using the workspace surface's own width
- **AND** secondary line counts MAY be hidden so the core chip, file count and `+N` control stay usable
- **AND** popovers SHALL NOT change the Turn header height or cover the Composer

#### Scenario: Unsupported ownership

- **WHEN** Composer roots are missing, hidden, or share an ambiguous transcript
- **THEN** the Renderer SHALL not expose actions for an unverified owner
- **AND** unavailable workspace information SHALL be identified without inventing a cwd

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

- **WHEN** the repository chips do not fit the header width
- **THEN** the row SHALL stay one line and trailing chips SHALL collapse behind one `+N` chip, never the core chip
- **AND** activating `+N` SHALL open a list above the workspace row; pointer hover SHALL NOT open rich content
- **AND** entries cloned for presentation SHALL NOT retain button roles or tab stops

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

### Requirement: Files open a stable detail surface

The right-side file disclosure SHALL show the conversation file count and additions/deletions, grouped by owning repository, with current-turn files tagged. Its list SHALL open upward from the Composer workspace surface only on activation. Clicking a file SHALL open a right-side, resizable detail surface between the Turn header and workspace dock. Hover and focus alone SHALL NOT open or close it. The body SHALL allow text selection and internal scrolling. Width MAY persist locally.

#### Scenario: User reads a diff while navigating

- **WHEN** a file detail is open and the user scrolls the transcript or selects another turn
- **THEN** the detail SHALL stay open with its selected file
- **AND** file updates SHALL refresh that detail only for its owning Composer and Thread
- **AND** explicit close or Escape SHALL return focus to the file row, preserving focus across a row repaint

#### Scenario: Ownership or source disappears

- **WHEN** the owning Composer unmounts, changes Thread, or the file is removed from its change set
- **THEN** its detail SHALL close
- **AND** a different Composer's lifecycle SHALL NOT close the active detail
- **AND** old-thread events SHALL NOT populate the newly selected Thread's workspace

#### Scenario: User opens the native file surface

- **WHEN** the user activates the explicit Open file action inside the detail
- **THEN** the detail SHALL close and invoke the retained native file/Review behavior
- **AND** duplicate native Changes/Review summaries SHALL remain hidden only while the replacement file disclosure exists, and restore when it is absent or disposed

### Requirement: Turn actions live in the Turn header and act on the current Turn

The Renderer SHALL mount one fixed Turn header per verified Thread Composer below the app-shell header, preserve its transcript top reservation, and resolve the current turn using real transcript nodes and Host turn IDs when available. It SHALL expose previous/next controls, a numbered menu of loaded turns, a locally extracted task subtitle, and Edit / Rollback / Redo. The subtitle SHALL be present while the original user bubble is visible and after it scrolls out; it SHALL not replace the full prompt stored for editing or shown in confirmations. Activating it SHALL return to the original request.

#### Scenario: Numbered navigation with virtualised history

- **WHEN** the Host reports five turns but only three are currently in the transcript
- **THEN** the index SHALL use the Host position, the menu SHALL contain only the three addressable turns, and its loaded-count hint SHALL describe that distinction
- **AND** selection SHALL resolve a stable turn key before scrolling; it SHALL not guess unseen prompts or offer unavailable jumps

#### Scenario: Edit and rollback use full prompts and real capabilities

- **WHEN** a native pencil exists
- **THEN** Desktop SHALL continue owning that edit behavior
- **WHEN** replacement requires Host rollback
- **THEN** Edit SHALL confirm against the complete original prompt, roll back to before that turn, and refill the Composer without sending
- **AND** if the first turn must be retained or the Harness cannot remove the required extent, Edit SHALL be disabled with a reason instead of appending a duplicate
- **AND** Rollback SHALL retain the selected turn, Redo SHALL use the existing single-slot external history contract, and busy/native-edit constraints SHALL remain enforced

#### Scenario: Header scrolls to a Turn it names

- **WHEN** the user activates the prompt button or a step arrow
- **THEN** the transcript SHALL scroll that Turn's top edge just under the header
- **AND** the index SHALL still name that Turn once the explicit step expires and the viewport rule takes over
- **AND** the move SHALL use `scrollIntoView` followed by a bounded per-frame correction of the header offset, because Desktop's transcript container honours only part of a direct scroll offset

#### Scenario: Virtualised transcript holds fewer Turns than the Thread

- **WHEN** inspect publishes `turnIds` for the Thread and Desktop's transcript window holds fewer Turns
- **THEN** the index SHALL report the current Turn's position inside the Host's Turn list, not inside the DOM window
- **AND** the step arrows SHALL stay bounded by the transcript window, since a forked Thread can carry an inherited first Turn that Desktop never renders

#### Scenario: Harness Turn without a native pencil

- **WHEN** the user activates Edit on a current Turn that has no native Edit control and is not the Thread's first Turn
- **THEN** the Renderer SHALL ask for confirmation, naming that this Turn and the later ones are dropped
- **AND** on confirmation SHALL roll the Thread back by the later Turns plus this one
- **AND** SHALL then place the Turn's prompt text in the Composer, focus it, and show a notice

#### Scenario: Edit on a Turn that cannot be dropped

- **WHEN** the current Turn is the Thread's first Turn, or the Harness can only roll back its last Turn and others follow it
- **THEN** Edit SHALL be disabled with a reason explaining that this turn cannot be replaced

#### Scenario: Host reports last-turn-only rollback

- **WHEN** inspect reports `rollback: { lastTurn: true, multiTurn: false }` and the current Turn has more than one later Turn
- **THEN** Rollback SHALL be disabled with a tooltip explaining only the last Turn can be rolled back
- **AND** Edit SHALL be disabled if replacing the selected turn exceeds that capability

#### Scenario: Native edit mode on the current Turn

- **WHEN** Desktop's own edit-message mode is open on the current Turn
- **THEN** the header SHALL hide its actions and mark the prompt slot as editing until that mode closes

#### Scenario: Legacy transcript after a rollback

- **WHEN** a rollback or Redo succeeds and the transcript's Turn nodes are unchanged shortly afterwards
- **THEN** the header SHALL tell the user the Host updated the conversation and that switching Threads refreshes the transcript

### Requirement: Draft worktree picker selects where a new Thread starts

For a new-chat draft with a verified official run-location control, the Renderer SHALL render a `Worktree ▾` chip beside the branch control, or beside the unique draft Composer when the branch anchor is absent. If the draft owner binding itself is missing, the entry SHALL explain that workspace selection is unavailable and SHALL not change the draft policy. Its menu SHALL offer `Local` (Desktop's project directory), `Temporary worktree` (Desktop's own anonymous worktree via `setComposerMode("worktree")`), every Host-managed linked worktree of the draft's project (`codexhost/workspace/worktree/list`, name · branch · dirty marker, primary checkout excluded), and `New worktree…` (created through `codexhost/workspace/worktree/create` on lane `codex`). The new-worktree name SHALL be prefilled complete, not just with the `yyMMdd-` date: the functional core comes from what the user has already typed in the Composer, slugified and truncated, falling back to the GMT+8 time when the prompt yields no ASCII word, and disambiguated against the worktree names that already exist. The suggestion SHALL always satisfy the Host's name pattern, and the user SHALL still be able to edit it. Picking a Host-managed worktree SHALL keep Desktop's Composer mode on `local` and SHALL hand the worktree root to the desktop-control draft policy (`selectWorkspace({ cwd })`), which rewrites `cwd` (and matching `runtimeWorkspaceRoots`) on the draft's non-ephemeral `thread/start` for official Codex and external Threads alike. While a Host-managed worktree is picked, Desktop's own run-location drifting back to `worktree` SHALL re-request `local` rather than discard the pick, since discarding it silently started the Thread in the project root. Every new draft SHALL start on `Local`; the last pick SHALL be persisted only to mark that entry as last used. The Renderer SHALL NOT invoke Git itself.

#### Scenario: New draft starts Local and lists Host-managed worktrees

- **GIVEN** a verified new-chat draft whose project root is known (React owner `cwd`, or the policy's observed draft cwd)
- **WHEN** the chip is opened
- **THEN** `Local` SHALL be checked, the primary checkout SHALL NOT be listed as a separate entry
- **AND** each linked worktree SHALL show its name, branch, and a dirty marker when it has uncommitted changes

#### Scenario: Picking an existing worktree routes the draft cwd

- **WHEN** the user picks a listed worktree
- **THEN** the Renderer SHALL call `selectWorkspace({ cwd: <worktree root> })`, keep Composer mode `local`, show the worktree name on the chip, and persist it as the last pick
- **AND** the draft's next non-ephemeral `thread/start` SHALL carry that cwd

#### Scenario: Creating a worktree

- **WHEN** the user submits a name that does not match `yyMMdd-<lowercase core>`
- **THEN** the menu SHALL reject it inline without calling the Host
- **WHEN** the Host rejects the name (path or branch exists)
- **THEN** the Host message SHALL be shown inline and nothing SHALL be selected
- **WHEN** creation succeeds
- **THEN** the new worktree SHALL be selected exactly as an existing one

#### Scenario: Desktop's own temporary worktree

- **WHEN** the user picks `Temporary worktree`, or Desktop's own run-location control switches the draft to `worktree`
- **THEN** the Renderer SHALL clear any Host-managed pick (`selectWorkspace(null)`), set or mirror Composer mode `worktree`, and label the chip accordingly

#### Scenario: Draft ends

- **WHEN** the draft is submitted or the run-location ownership disappears
- **THEN** the chip SHALL be removed and `selectWorkspace(null)` SHALL be called so the next draft starts Local
- **AND** the next draft's menu SHALL only mark the remembered worktree as last used, not select it

#### Scenario: Mode ownership is unsupported or belongs to an existing Thread

- **WHEN** the run-location React ownership chain is missing, ambiguous, unsupported, or carries a non-null conversation id
- **THEN** the Renderer SHALL render no picker
- **AND** SHALL NOT change Composer mode, Thread cwd, branch state, or Git Worktrees

#### Scenario: Worktree menu exposes the send directory

- **WHEN** the user opens the worktree picker
- **THEN** the menu SHALL show the current send directory, full paths for existing worktrees, and an explicit refresh action
- **AND** a new-worktree form SHALL identify its starting directory and planned branch
- **AND** the Renderer SHALL not report a selection as successful if the draft policy rejects it

### Requirement: Current conversation worktrees start a separate native draft

The Composer workspace's Worktrees action SHALL reuse the same inventory and creation menu. Choosing an existing or newly created worktree SHALL leave the current Thread cwd untouched. The Renderer SHALL invoke only a unique visible native new-conversation control, then wait until the source Composer has left that Thread and exactly one verified draft exists before applying the cwd policy. If that control is unavailable, it SHALL show an explicit reason; an unverified or timed-out draft SHALL not receive a deferred selection. Closing a creation menu SHALL prevent its asynchronous result from selecting a different draft.

#### Scenario: Native navigation is delayed

- **WHEN** the user chooses a worktree from an existing Thread and native navigation is still in progress
- **THEN** no workspace selection SHALL be applied to the existing Thread
- **WHEN** a unique verified new draft appears and the original Composer has left its Thread
- **THEN** the pending choice SHALL be consumed once, with the final cwd visible in the draft picker
- **AND** an absent branch anchor SHALL use the verified draft Composer fallback
