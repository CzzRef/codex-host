## Why

The injected Turn actions light up "Rollback" on any earlier Turn, but the Host only accepts `numTurns = 1` for a live External Thread (or an untouched Fork-derived Thread); everything else is rejected with `-32076` after the user has already confirmed. Harnesses that can re-open a Native Session at a Checkpoint (`history.fork`) could serve multi-turn rollback the same way Fork does, and the Renderer should know up front what the Host will accept so the control is disabled with a reason instead of failing late.

## What Changes

- External Thread inspection publishes `rollback: { lastTurn, multiTurn }` computed from the Harness history capabilities and the Thread's own Turn mappings.
- Host serves `thread/rollback` on a live External Thread (any `numTurns` that keeps the first Turn, when `rollbackLastTurn` or an untouched Fork prefix does not already serve it) by re-opening the Thread's own Native Session at the retained boundary's Native Checkpoint through Adapter `open({ kind: "fork" })`, replacing the runtime Session, persisting the shortened Turn list and stashing the whole previous Session in the one Redo slot. Slice 4 of the 260903 worktree surface overhaul.
- Host emits `thread/reverted { threadId }` after External rollback / Redo on paginated Threads so Desktop re-reads the transcript.
- Renderer disables Rollback / Edit-with-rollback according to the bits and explains why; copy stops promising file rewinds.
- No Adapter contract change, no file rewind, no official app-server `thread/rollback` change for Codex Threads.

## Capabilities

### Modified Capabilities

- `external-thread-fork-routing`: Host publishes rollback ability on inspect and serves Checkpoint-based multi-turn rollback for live Threads.

## Impact

- `packages/shared-contracts`: optional `rollback` on external Thread inspection.
- `packages/mapping-store`: `replaceReadySessionAfterRollback` (any trailing extent); `historyRedo` may exceed the current prefix by more than one Turn.
- `packages/host-runtime`: `externalRollbackCapabilities`; `executeCheckpointRollback` + `commitCheckpointRollback`; `thread/reverted` after paginated rollback / Redo.
- `packages/renderer-extension`: `rollbackSupportFor`, honest disablement, Composer refill for Edit, hover `⋯` chip, rAF repositioning.
