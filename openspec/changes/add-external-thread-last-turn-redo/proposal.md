## Why

Codex Desktop has no `thread/redo` for conversation history. The injected Composer Redo button currently clicks a native `Redo`/`重做` control, which is the official app-action stack (or writing-block/editor Redo), not a restore of an external last-turn rollback. After Host `rollbackLastTurn`, the previous Native Session is displaced and can be resumed for Harnesses that create a distinct Session. CodexHost should own that restore globally instead of depending on official Redo.

## What Changes

- Persist a one-slot `historyRedo` on a ready External Thread when last-turn rollback replaces it with a **distinct** Native Session.
- Add Host-owned `codexhost/thread/redo` that resumes the stashed Native Session, atomically restores Turn mappings, and clears the slot.
- Point the injected Redo button at that Host method for mapped external Threads, with official DOM Redo only as fallback.
- Clear the slot when a new Turn is persisted or a post-Fork Session replacement occurs.
- Do not add Adapter `open(redo)`, file rewind, or official app-server `thread/redo`.

## Capabilities

### New Capabilities

- `external-thread-last-turn-redo`: Host-owned restore of the Native Session displaced by last-turn rollback.

### Modified Capabilities

- `external-thread-mapping-store`: last-turn replacement may stash `historyRedo`.
- `external-thread-fork-routing`: Host routes `codexhost/thread/redo` for mapped Threads only.

## Impact

- `packages/mapping-store`: optional `historyRedo` on V1 records; stash/restore/clear.
- `packages/host-runtime`: last-turn rollback writes the slot; new redo execution; inspect flag.
- `packages/shared-contracts`: optional `historyRedoAvailable` on external Thread inspection.
- `packages/renderer-extension`: Redo calls Host, then official click fallback.
- `packages/harness-adapter` testing fake: resume after Session close.
- Official Codex Threads remain passthrough and never receive `codexhost/thread/redo`.
