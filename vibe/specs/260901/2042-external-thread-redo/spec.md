# Standard Requirement Spec: 2042-external-thread-redo

Tool: dsh
Date: 2026-09-01
Status: `confirmed`
Documentation level: `standard requirement`

Raw source: [raw-requirement.md](raw-requirement.md)
Canonical target: [external-thread-fork-routing](../../../../openspec/specs/external-thread-fork-routing/spec.md), [external-thread-mapping-store](../../../../openspec/specs/external-thread-mapping-store/spec.md), in-flight [add-external-thread-last-turn-redo](../../../../openspec/changes/add-external-thread-last-turn-redo/proposal.md)

## Task Documentation Sync Group

- Group key: `dsg:codex-host:2042-external-thread-redo`
- Group owner: this `spec.md`
- Git document prefixes: `vibe/specs/260901/2042-external-thread-redo/`, `vibe/specs/PROJECT_STATUS.md`, `openspec/changes/add-external-thread-last-turn-redo/`, `openspec/specs/external-thread-fork-routing/spec.md`, `openspec/specs/external-thread-mapping-store/spec.md`
- Declared code/config dependencies: mapping-store records/runtime, host-runtime rollback/redo, renderer turn actions, shared-contracts thread inspection
- Linked authorities: [thread lifecycle](../../../../.agents/skills/codexhost-add-harness/references/thread-lifecycle-and-history.md), [领域术语表](../../../../docs/领域术语表.md)
- Excluded unrelated dirty documents: `AGENTS.md`, `CLAUDE.md`, `vibe/specs/260901/2034-ai-rules-init/`, Composer workspace-bar files except `renderer-turn-actions.ts` / model client, unread-only `app-server-host.ts` hunk
- Lookup contract: `get --lookup-only` returns `present/freshness=unchecked`; only `check status=hit` may reuse the gate.

```json documentation-sync-group-v1
{
  "schema": "documentation-sync-group-v1",
  "group_key": "dsg:codex-host:2042-external-thread-redo",
  "group_owner": "vibe/specs/260901/2042-external-thread-redo/spec.md",
  "documents": [
    "vibe/specs/260901/2042-external-thread-redo/raw-requirement.md",
    "vibe/specs/260901/2042-external-thread-redo/spec.md",
    "vibe/specs/260901/2042-external-thread-redo/changes.md",
    "vibe/specs/PROJECT_STATUS.md",
    "openspec/changes/add-external-thread-last-turn-redo/proposal.md",
    "openspec/changes/add-external-thread-last-turn-redo/design.md",
    "openspec/changes/add-external-thread-last-turn-redo/tasks.md",
    "openspec/changes/add-external-thread-last-turn-redo/specs/external-thread-fork-routing/spec.md",
    "openspec/changes/add-external-thread-last-turn-redo/specs/external-thread-mapping-store/spec.md"
  ],
  "dependencies": [
    "packages/mapping-store/src/records.ts",
    "packages/mapping-store/src/mapping-store.ts",
    "packages/host-runtime/src/external-thread-rollback.ts",
    "packages/host-runtime/src/external-thread-redo.ts",
    "packages/host-runtime/src/app-server-host.ts",
    "packages/renderer-extension/src/renderer-turn-actions.ts",
    "packages/shared-contracts/src/harness-models.ts"
  ],
  "validators": [],
  "git_scope_prefixes": [
    "vibe/specs/260901/2042-external-thread-redo",
    "vibe/specs/PROJECT_STATUS.md",
    "openspec/changes/add-external-thread-last-turn-redo"
  ]
}
```

## Requirement Delta

- Add: Host-owned one-slot conversation Redo after a successful last-turn rollback that produced a **distinct** Native Session.
- Modify: last-turn Mapping Store replacement stashes the displaced Native identity; injected Redo button calls Host instead of official Desktop Redo.
- Remove: none.
- Clarify: Redo restores Native conversation context only. It does not rewind project files, invent `thread/redo` for official Codex, or add Adapter `open(redo)`.

Confirmed facts:

- Official Desktop has `undoAppAction` / `redoAppAction` and Turn-diff Undo/Reapply, not a Host-visible `thread/redo`.
- `rollbackLastTurn` already returns a replacement Session; Host `replace()` closes the previous handle. Pi / OMP / Claude Code leave the previous Native Session resumable. Grok rewind is in-place (`conversation_only`, same Session ID) and cannot be resumed as the pre-rewind history.
- Injected Composer Redo currently clicks a DOM `Redo`/`重做` button.

Pending decisions: none material. File restore stays Desktop Undo/Reapply.

Acceptance:

1. Last-turn rollback of a distinct Native Session persists `historyRedo` (previous `nativeSessionRef` + longer `turnMappings`).
2. In-place rollback (same Native Session ID) does not persist `historyRedo`.
3. `codexhost/thread/redo` resumes that previous Native Session, replaces the current Thread in place, clears the slot, and does not forward to Codex.
4. A later new Turn, post-Fork rollback, or missing slot clears or rejects Redo.
5. Official / unmapped Thread: Host rejects; Renderer may click official Redo.
6. Injected Redo copy no longer claims official Redo for external Threads.
7. Focused tests cover Store stash/restore/clear and Host rollback→redo→continue.

## Requirement Change Review

- Scan scope: current request → this Spec → OpenSpec fork-routing / mapping-store → last-message-edit archive → Grok rewind.
- Visible changes: added Host Redo slot and RPC; changed last-turn replacement to stash distinct identity; changed Renderer Redo to Host-first.
- Conflict classification: `compatible-update` of last-turn rollback. No removal of rollback. Does not supersede Fork.
- Decision status: `explicit-current-request`.
- User-facing review: Host-global last-turn conversation Redo; no file rewind; Grok in-place out of this slice.
- Post-sync rescan: `pass` after OpenSpec delta and implementation agree.

## Prior Task Overlap

- Relationship: `partial-overlap` with archived last-message-edit (`rollbackLastTurn`) and in-progress Composer turn-actions Redo button.
- Document governance: extend those owners; do not migrate `docs/tasks/`.
- Execution logic: reuse `open(rollbackLastTurn)` + `open(resume)` + Mapping Store atomic replace. New Store field and Host method only.
- Traceability and decision: `new-task` (delta-only capability on top of last-turn rollback).

## Canonical Merge

- Base: current `openspec/specs/external-thread-fork-routing` and `external-thread-mapping-store`.
- Result: in-flight change `add-external-thread-last-turn-redo` until archived.
- Merge status: change package is the current authority for Redo; accepted specs update when the change is archived.

## Implementation Sync

- Changed logic: stash displaced Native Session on distinct last-turn rollback; Host `codexhost/thread/redo` resumes it; Renderer Redo uses that method.
- Authoritative current document: this Spec + the OpenSpec change package.
- Mapping: Mapping Store field `historyRedo` → Host `executeExternalThreadRedo` → Renderer `redoThread`.
- Verification evidence: focused vitest on mapping-store, host-runtime, renderer-extension.
- Gap: live Desktop conversation DOM refresh after Host redo is opportunistic (same as injected rollback today). Native Session restore is authoritative for the next Turn.

## Verification

### Verification Decision

- Route: `focused-automated`
- Reason: cross-package history identity change; no live Desktop Gate unless asked
- Impact source: current source 2026-09-01
- Provisional trace completed before verification commands: `yes`
- Verification-command provenance: `impact-trace`
- Affected modules: mapping-store, host-runtime, renderer-extension, shared-contracts, harness-adapter testing fake
- Checked: `tsc -b`; vitest mapping-store, host-runtime app-server-host, renderer-extension model-client/workspace-bar, shared-contracts harness-models, harness-adapter text-session (223 pass)
- Skipped: `npm test` full suite; `gate:*`; live Desktop
- Full-suite escalation: `none`
- Owner: this Spec
- Residual risk: Grok in-place rewind has no Host Redo; official Codex stays passthrough

### Verification Impact Trace

| Changed surface / claim | Direct consumers | Material transitive or failure boundary | Selected evidence | Skipped suites / reason | Outcome / residual |
| --- | --- | --- | --- | --- | --- |
| `historyRedo` on ready record | Host last-turn replace / redo | stale Native identity after restart | mapping-store unit tests | full store suite beyond last-turn | pass |
| `codexhost/thread/redo` | Renderer button | official passthrough must not receive the method | host-runtime last-turn rollback + redo tests | live Desktop | pass (RPC); DOM refresh residual |
| Injected Redo Host-first | Composer turn actions | official Codex fallback click | renderer copy + client method tests | e2e Playwright | pass |
| Fake resume after close | Host replace then redo | closed Fake session cannot execute | host redo continue turn | none | pass |

| Check | Evidence | Result | Remaining Manual Path |
| --- | --- | --- | --- |
| requirement/raw/canonical parity | this folder + OpenSpec change | pass (in-flight change, not archived) | archive OpenSpec when merging |

## Documentation Impact

- Classification: `requirement-canonical` (OpenSpec) plus `project-current` (this hub)
- Central Rule Task admission: `project-local / no central row`
- `doc_drift`: last-turn rollback docs omitted Redo; this change adds it
- Affected authoritative documents: OpenSpec change package, this Spec, PROJECT_STATUS
- Root acceptance gate: focused tests green

## Execution Journal

| Event ID | Local Time | Work Unit / Attempt | Actor / Surface | Event | Prior -> Resulting State | Trigger / Evidence | Root Decision / Next Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | 2026-09-01 20:42 +08:00 | plan | dsh | classify Standard requirement | Q&A -> confirmed spec | user implement + vibe docs | implement Host Redo |
| E2 | 2026-09-01 21:03 +08:00 | implement | dsh | Host Redo slice | no slot -> stash/resume/button | tsc + 223 vitest | uncommitted; no live Desktop |

## Efficiency / Token Evidence

| Metric | Baseline | Observed | Delta | Confidence / Source |
| --- | --- | --- | --- | --- |
| runtime usage | n/a | usage unavailable | n/a | host does not expose counters |

## TaskExperienceObservation

- Result: `not applicable`

## Closeout

- Sidecar: `main-thread`
- Requirement / business / tech route: OpenSpec change package
- Memory / error route: none unless a verified reusable failure appears
- Evolution Candidate: `none`
