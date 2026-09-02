## Context

`rollbackLastTurn` already opens a replacement Native Session whose history is the current history minus the final Turn. Host then atomically replaces `nativeSessionRef` and `turnMappings` and closes the previous Session handle. For Pi, OMP, and Claude Code that replacement is a distinct Native identity; the previous Session remains resumable. Grok last-turn rollback uses in-place `_x.ai/rewind` with `conversation_only` and keeps the same Native Session ID, so the pre-rewind history is not a separate resume target.

Official Desktop Redo (`redoAppAction`, writing-block Redo, Turn-diff **Reapply**) is not a conversation restore for external Threads.

## Decisions

1. **Host slot, not Adapter protocol.** Redo is `open(resume)` of the displaced Native Session. No `kind: "redo"`.
2. **One slot, distinct identity only.** Store `historyRedo: { nativeSessionRef, turnMappings }` only when the replacement Native Session ID differs. Same-ID in-place rewind stores nothing.
3. **Host RPC, not `thread/redo`.** Desktop has no such method. Renderer uses `codexhost/thread/redo { threadId }`. Unmapped Threads error and do not fall through to Codex.
4. **Clear on divergence.** Persisting a new Host Turn or post-Fork ready replacement drops `historyRedo`. A later last-turn rollback overwrites the slot with the immediately previous state.
5. **Conversation only.** Redo does not restore project files. Desktop Undo/Reapply stays independent.
6. **Inspect flag.** External Thread inspection may report `historyRedoAvailable` so the injected button can survive Host/Renderer refresh.

## Risks

- Injected rollback/redo still cannot force Desktop's React conversation store to apply a response the way native edit-message does. Native Session restore remains the source of truth for the next Turn; DOM refresh may require reopening the Thread.
- Fake Adapter currently returns a closed Session on resume. Tests need resume-after-close to reopen a usable Session with the same Native ID, matching Pi file resume.

## Rollback

Remove `historyRedo` writes, Host method, and Renderer Host call. Last-turn rollback behavior remains.
