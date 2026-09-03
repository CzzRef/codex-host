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

## 3. Multi-turn Checkpoint rollback (slice 4)

- [ ] 3.1 Spike: which Adapters return `nativeCheckpointRef` per Turn and accept `open({ kind: "fork", checkpoint })` on their own live Session
- [ ] 3.2 Host serves `numTurns > 1` on a live Thread by forking at the retained boundary Checkpoint and replacing the runtime Session
- [ ] 3.3 `multiTurn` reflects Checkpoint availability
- [ ] 3.4 Spike: transcript refresh after replace; Renderer notice fallback
