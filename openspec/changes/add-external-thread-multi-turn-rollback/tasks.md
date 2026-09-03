## 1. Rollback ability on inspect (worktree surface overhaul slice 2)

- [x] 1.1 Optional `rollback: { lastTurn, multiTurn }` on external Thread inspection (shared-contracts)
- [x] 1.2 `externalRollbackCapabilities` in host-runtime; AppServerHost inspect includes it
- [x] 1.3 Host test asserts the bits for a non-Fork Pi Thread

## 2. Renderer Turn actions (slice 2)

- [x] 2.1 `rollbackSupportFor` maps the bits to `full | lastTurnOnly | none`; Rollback disabled with a reason tooltip; Edit needs confirmation only when rollback is possible
- [x] 2.2 Edit prefers the native pencil, otherwise refills the Composer with the Turn's prompt and focuses it
- [x] 2.3 Copy no longer promises to rewrite files; the native Undo control is no longer clicked implicitly
- [x] 2.4 Replace rail dots with one hover `⋯` chip at the hovered Turn's top-right; scroll/resize/mutation repositioning coalesced into one animation frame; ResizeObserver on the selected Turn
- [x] 2.5 Unit coverage for support mapping and copy; Composer E2E for hover chip, Edit refill, disabled Rollback
- [x] 2.6 Superseded by the pinned Turn header (`add-composer-workspace-bar` §13): the hover `⋯` chip and the floating cluster are removed; Edit / Rollback / Redo act on the viewport-derived current Turn from the header

## 3. Multi-turn Checkpoint rollback (slice 4)

- [x] 3.1 Spike: Pi, OMP, Grok, DeepSeek Harness and Claude Code Adapters report `history.fork: true`, emit a `nativeCheckpointRef` per Turn and accept `open({ kind: "fork", sourceRef, checkpoint })` against their own Session (Grok through its ACP fork/rewind transport); Pi / OMP / Grok / Claude keep `rollbackLastTurn` for `numTurns = 1`, DeepSeek Harness (`rollbackLastTurn: false`) goes through the Checkpoint path for every extent; Cursor reports `fork: false` and stays `none`. Live confirmation per Harness is still owed (3.6)
- [x] 3.2 Host serves `numTurns >= 1` on a live Thread by forking its own Session at the retained boundary Checkpoint (`executeCheckpointRollback`), keeps the first Turn, verifies Turn count and configuration, and replaces the runtime Session; `MappingStore.replaceReadySessionAfterRollback` + `ExternalThreadRepository.commitCheckpointRollback` persist the shorter prefix and stash the whole previous Session in the one Redo slot (`historyRedo` may now be longer than the current prefix by more than one Turn)
- [x] 3.3 `lastTurn` / `multiTurn` reflect Checkpoint availability on the Thread's own mappings
- [x] 3.4 Transcript refresh: Host emits `thread/reverted { threadId }` after External `thread/rollback` and `codexhost/thread/redo` on paginated Threads; legacy Threads update from the response; Renderer marks Redo available after any rollback extent and its copy no longer says "last turn"
- [x] 3.5 Tests: mapping-store multi-Turn slot + Redo restore; host `rolls a live external Thread back at its own Checkpoint, publishes the ability, and offers Redo` (inspect bits, `numTurns >= turns` refused, two-Turn rollback, grown Fork-derived Thread, Redo, `thread/reverted` per Thread); renderer copy unit test updated
- [ ] 3.6 `[live]` Confirm Desktop's paginated transcript re-reads on `thread/reverted` after a Renderer-initiated rollback, and that a legacy-mode Thread shows the shortened transcript after the next `thread/read`
