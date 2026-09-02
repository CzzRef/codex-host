## 1. Mapping Store

- [x] 1.1 Add optional `historyRedo` to the V1 Thread record with distinct-identity validation
- [x] 1.2 Stash previous Native identity on distinct last-turn replacement; omit on same-ID replacement
- [x] 1.3 Restore via dedicated atomic replace that requires an exact `historyRedo` match and then clears the slot
- [x] 1.4 Clear `historyRedo` when a new Host Turn mapping is added or a post-Fork ready Session is replaced
- [x] 1.5 Unit tests: stash, same-ID skip, restore, clear on new Turn, persist across reopen

## 2. Host Runtime

- [x] 2.1 Last-turn rollback uses the Store stash automatically
- [x] 2.2 `codexhost/thread/redo` resumes the stashed Session, verifies Snapshot length/identity, replaces runtime, returns the Thread
- [x] 2.3 Reject busy, missing slot, in-place/no-slot, official/unmapped, and Snapshot mismatch without Codex fallback
- [x] 2.4 External inspect reports `historyRedoAvailable`
- [x] 2.5 Tests: rollback then redo then continue; reject after a new Turn; unmapped error

## 3. Renderer

- [x] 3.1 `redoThread` client method
- [x] 3.2 Injected Redo calls Host first; official `Redo`/`重做` click is fallback
- [x] 3.3 Copy no longer claims official Redo for the Host path
- [x] 3.4 Focused client/copy tests

## 4. Fake Adapter

- [x] 4.1 Resume of a closed Fake Session reopens a usable Session with the same Native ID
