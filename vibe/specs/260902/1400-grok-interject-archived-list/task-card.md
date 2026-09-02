# Task Card

> Standard non-requirement work only.

Tool: claude
Date: 2026-09-02
Task: 1400-grok-interject-archived-list

## Task Documentation Sync Group

- Group key: `dsg:codex-host:1400-grok-interject-archived-list`
- Group owner: this `task-card.md`
- Git document prefixes: `vibe/specs/260902/1400-grok-interject-archived-list/`, `vibe/specs/PROJECT_STATUS.md`, `openspec/changes/add-delegation-thread-list-archived/`, `openspec/changes/add-external-turn-steer-queue/`, `docs/czz-dev.md`, `vibe/knowledge/error-memory/`
- Declared code/config dependencies: `packages/adapters/grok/src/grok-interject.ts`, `packages/adapters/grok/src/grok-adapter.ts`, `packages/host-runtime/src/delegation-types.ts`, `packages/host-runtime/src/delegation-cli.ts`, `packages/host-runtime/src/app-server-host.ts`
- Linked authorities: [steer queue change](../../../../openspec/changes/add-external-turn-steer-queue/proposal.md), [archived list change](../../../../openspec/changes/add-delegation-thread-list-archived/proposal.md), [error memory](../../../knowledge/error-memory/grok-interjection-persists-extra-native-turn.md)
- Excluded unrelated dirty documents: peer session hunks (Claude catalog refresh, Launcher controller reap, Pi/OMP/DeepSeek native steer, delegation `thread send --steer`), `docs/tasks/WORKTREE_TASKS.md`

```json documentation-sync-group-v1
{
  "schema": "documentation-sync-group-v1",
  "group_key": "dsg:codex-host:1400-grok-interject-archived-list",
  "group_owner": "vibe/specs/260902/1400-grok-interject-archived-list/task-card.md",
  "documents": [
    "vibe/specs/260902/1400-grok-interject-archived-list/task-card.md",
    "vibe/specs/PROJECT_STATUS.md",
    "openspec/changes/add-delegation-thread-list-archived/proposal.md",
    "openspec/changes/add-delegation-thread-list-archived/tasks.md",
    "openspec/changes/add-delegation-thread-list-archived/specs/cross-harness-delegation/spec.md",
    "openspec/changes/add-external-turn-steer-queue/proposal.md",
    "openspec/changes/add-external-turn-steer-queue/tasks.md",
    "docs/czz-dev.md",
    "vibe/knowledge/error-memory/grok-interjection-persists-extra-native-turn.md",
    "vibe/knowledge/error-memory/README.md"
  ],
  "dependencies": [
    "packages/adapters/grok/src/grok-interject.ts",
    "packages/adapters/grok/src/grok-adapter.ts",
    "packages/host-runtime/src/delegation-types.ts",
    "packages/host-runtime/src/delegation-cli.ts",
    "packages/host-runtime/src/app-server-host.ts"
  ],
  "validators": [],
  "git_scope_prefixes": [
    "vibe/specs/260902/1400-grok-interject-archived-list",
    "openspec/changes/add-delegation-thread-list-archived"
  ]
}
```

## Goal And Scope

- Goal: make Composer steer on Grok Threads a real mid-turn insertion, stop the post-turn `persisted 2 new Native Turns` failure, and let delegation consumers (EyPc) see Desktop archives of external Threads.
- Symptoms: grok 1.0.13 answers `x.ai/interject` with `-32601`, so every steer fell back to cancel-and-resend (`turn_ended mid_turn_abort`, `turn_started redirect_kind=cancel_then_send`); the fallback's settle read `updates.jsonl` before Grok appended `turn_completed`, re-keying one Native Turn and failing the Host Turn; `codexhost thread list` aggregated with `archived: false` and carried no `archived` field, so an archived Thread only vanished.
- In scope: `_x.ai/interject` + `{sessionId, text}` + `result.status`; checkpoint identity and bounded wait for the terminal record (`nativeHistorySettleTimeoutMs`, default 1.5s) with the strict one-Native-Turn check restored for Grok; `ThreadListInput.archived`, `DelegationThreadListItem.archived`, CLI `--archived true|false`; fake transport modelled on the live interjection form; regression tests.
- Out of scope: EyPc consumption of `archived` (other repository); Pi/OMP/DeepSeek native steer (peer session); history projection of the interjection wrapper text into the Turn input (`grok-history.ts`); Desktop relaunch.

## Decision

- Documentation level: `standard`
- Execution: `main-only` (peer sessions active in the same checkout; edits limited to the declared files and regions)
- Key decisions: withdraw the Grok `1 + deliveredInterjections` relaxation from `2155d93` because the live probe shows an accepted interjection stays inside one Native Turn; keep the delegation list default at `archived: false` so existing callers see no change and expose archive state through an explicit view plus a per-row flag, mirroring `hasUnreadTurn`.
- High-risk / DB boundary: none.

## Work And Verification

- Changed surface: `grok-interject.ts` (method, params, result), `grok-adapter.ts` (`nativeTurnIdentity`, `#awaitPersistedTurn`, option plumbing), `delegation-types.ts`, `delegation-cli.ts` (`--archived`), `app-server-host.ts` (`#listDelegationThreads`), tests in `grok-adapter.test.ts` (+3), `grok-interject.test.ts` (rewritten), `delegation-cli.test.ts` (+2 and one rejection row), `app-server-host.test.ts` (+1).
- Verification 2026-09-02: `vitest run` 187 files / 1601 pass / 7 skipped (whole workspace, including peer dirty files); `npm run typecheck` pass; `node tools/check-boundaries.mjs` pass; eslint + prettier on changed files pass; live grok 1.0.13 ACP probes (`x.ai/interject` → -32601, `_x.ai/interject` → `{"result":{"status":"queued"}}`, same-prompt injection, one `turn_completed`); built `GrokAdapter` (dist) against the real binary in a scratch cwd: `turn.steer` accepted 2.5s into a running Turn without cancel, Turn completed `succeeded` with a prompt-id `nativeTurnRef` and checkpoint `0`, agent text ended with `INTERJECTED`, snapshot held one Native Turn (session deleted afterwards).
- Unverified gaps: Desktop relaunch to activate `dist`; `codexhost thread list --archived true` against a restarted Host; EyPc side.

## Closeout

- Sidecar: `main-thread`
- Memory / error route: error-memory record corrected in place (root cause superseded, history row added); personal memory `grok-acp-interject-semantics` / `eypc-consumes-host-thread-list`.
- Evolution Candidate: `none`
