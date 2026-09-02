# Standard Requirement Spec: 1649-sidechat-parent-binding

Tool: pi
Date: 2026-09-02
Status: `confirmed`
Documentation level: `standard requirement`

Raw source: [raw-requirement.md](raw-requirement.md)
Canonical target: [external-thread-fork-routing](../../../../openspec/specs/external-thread-fork-routing/spec.md), [external-thread-list-archive-routing](../../../../openspec/specs/external-thread-list-archive-routing/spec.md), [czz-dev 接入说明](../../../../docs/czz-dev.md)

## Task Documentation Sync Group

- Group key: `dsg:codex-host:1649-sidechat-parent-binding`
- Group owner: this `spec.md`
- Git document prefixes: `vibe/specs/260902/1649-sidechat-parent-binding/`, `vibe/specs/PROJECT_STATUS.md`, `docs/czz-dev.md`, `openspec/changes/add-sidechat-parent-navigation/`
- Declared code/config dependencies: Host fork list projection, Renderer projectless Fork open path
- Linked authorities: [external-thread-fork-routing](../../../../openspec/specs/external-thread-fork-routing/spec.md)
- Excluded unrelated dirty documents: `.codemark/`; sibling 1437 interjection work
- Lookup contract: `get --lookup-only` returns `present/freshness=unchecked`; only `check status=hit` may reuse the gate.

```json documentation-sync-group-v1
{
  "schema": "documentation-sync-group-v1",
  "group_key": "dsg:codex-host:1649-sidechat-parent-binding",
  "group_owner": "vibe/specs/260902/1649-sidechat-parent-binding/spec.md",
  "documents": [
    "vibe/specs/260902/1649-sidechat-parent-binding/raw-requirement.md",
    "vibe/specs/260902/1649-sidechat-parent-binding/spec.md",
    "vibe/specs/260902/1649-sidechat-parent-binding/changes.md",
    "vibe/specs/PROJECT_STATUS.md",
    "docs/czz-dev.md",
    "openspec/changes/add-sidechat-parent-navigation/proposal.md"
  ],
  "dependencies": [
    "packages/host-runtime/src/external-thread-list.ts",
    "packages/host-runtime/src/external-thread-repository.ts",
    "packages/renderer-extension/src/renderer-fork-control.ts"
  ],
  "validators": [],
  "git_scope_prefixes": [
    "vibe/specs/260902/1649-sidechat-parent-binding",
    "vibe/specs/PROJECT_STATUS.md",
    "docs/czz-dev.md",
    "openspec/changes/add-sidechat-parent-navigation",
    "packages/host-runtime/src/external-thread-list.ts",
    "packages/host-runtime/src/external-thread-repository.ts",
    "packages/renderer-extension/src/renderer-fork-control.ts"
  ]
}
```

## Requirement Delta

- Add: ephemeral Side Chat / derived Fork stays bound to the source Thread; jump, deep link, and sidebar treat the source as the conversation the user opens.
- Modify: projectless external Fork must not click the derived Thread into the sidebar as a standalone conversation.
- Modify: default `thread/list` omits ephemeral derived External records (those with `forkSource`), the same way it already omits Subagents.
- Clarify: the derived Native Session still exists and still accepts Turns; identity is not collapsed into the parent Thread id.
- Clarify: Fork lineage is still not a Codex Subagent relationship (`parentThreadId` list filter unchanged).
- Out of this implementation slice: injecting parent visible messages into a cross-harness child (Codex → Pi). Recorded as confirmed product intent, not this code batch.

Confirmed facts:

- Codex GPT Side Chat is an ephemeral fork that keeps parent context and does not become an orphan project conversation.
- Current Host ack of `thread/inject_items` does not bind navigation to the source Thread.
- `forkedFromId` is already persisted via `forkSource`; jump/open ignored it and opened the child.
- Renderer Host-fork for `isProjectlessConversation` called `openThread(derived)`, which is a full sidebar switch.
- User selected F-1: write this Spec, then implement binding and jump.

Pending decisions: none for binding/jump. Cross-harness transcript injection remains a later slice.

Acceptance:

1. Ephemeral derived External Threads keep `forkSource` / `forkedFromId` pointing at the source Thread.
2. Default Desktop `thread/list` does not show those derived rows as independent conversations.
3. After a projectless external Fork, Renderer does not open the derived Thread as the current sidebar conversation; the source Thread remains the navigation target.
4. CLI/Host `deepLink` for an ephemeral derived Thread, when emitted, uses the source Thread id.
5. Derived Thread still accepts later Turns; `thread/read` of the child id still works.
6. Focused tests cover list omission and Renderer stay-on-source.

## Requirement Change Review

- Scan scope: current request → sidechat inject_items ack in fork-routing → list archive routing (subagent omission, parent filter) → Renderer projectless Fork → czz-dev sidechat note.
- Visible changes: added parent-bound navigation; changed projectless open and list membership; no removal of fork itself.
- Conflict classification: `compatible-update` of fork-routing Side Chat (derived Session remains); `direct-conflict` with “open the derived Thread in the sidebar” Renderer behavior (supersede that UI); `no-conflict` with Subagent `parentThreadId` filter.
- Decision status: `explicit-current-request` plus `selected-option` F-1.
- User-facing review: Side Chat is bound to the main conversation; jump stays on the main/project Thread.
- Post-sync rescan: after this round’s docs + focused tests.

## Prior Task Overlap

- Relationship: `reference-only` to 2026-09-01 sidechat `inject_items` ack and [czz-dev sidechat](../../../../docs/czz-dev.md).
- Document governance: new Standard requirement folder; do not rewrite the inject_items ack as failed — it unblocked opening Side Chat.
- Execution logic: reuse `forkSource`; do not invent a second parent field or mark forks as Subagents.
- Traceability and decision: `new-task`.

## Canonical Merge

- Base: accepted fork-routing Side Chat injection ack; list omits Subagents only.
- Result: OpenSpec change [add-sidechat-parent-navigation](../../../../openspec/changes/add-sidechat-parent-navigation/proposal.md); czz-dev current note. Canonical specs integrate when the change is accepted.
- Merge status: change package created; canonical not switched this round.

## Implementation Sync

- Changed logic: list filter + Renderer Fork open target; optional navigation id helper from `forkSource`.
- Authoritative current document: this Spec until the OpenSpec change is integrated.
- Mapping: `thread/fork` ephemeral + `forkSource` → omit from directory; Renderer stays on source `threadId`.
- Verification evidence: `external-thread-list` vitest; `renderer-fork-control` vitest.
- Gap: live Desktop Side Chat visual; cross-harness parent transcript injection.

## Verification

### Verification Decision

- Route: `focused-automated`
- Reason: list membership and Renderer navigation are unit-testable; live Side Chat overlay is user-owned
- Impact source: current source 2026-09-02
- Provisional trace completed before verification commands: `yes`
- Verification-command provenance: `impact-trace`
- Affected modules: `packages/host-runtime` list projection, `packages/renderer-extension` fork control
- Checked: vitest renderer-fork-control + external-thread-list 14 pass
- Cross-harness live check (2026-09-02 18:40, claude session codex-host-bf): a standalone Host Runtime (`packages/host-runtime/dist/main.js app-server`, real stock codex, `CODEXHOST_DATA_DIR` scratch) driven over stdio ran `thread/start` → `turn/start` → `thread/fork {ephemeral, excludeTurns, lastTurnId}` → `thread/inject_items` → child `turn/start` → `thread/list` → `thread/read` for `codexhost/pi-native`, `codexhost/grok-native`, `codexhost/deepseek-harness-native`, `codexhost/claude-code-native`: every child carried `forkedFromId` = source, answered with the parent context (ALPHA), was absent from the default list and readable by id; `codexhost/cursor-native` answered `thread/fork` with `-32076 External Harness does not support fork` as documented. Native probe sessions were deleted or archived afterwards.
- Skipped: full `npm test`; `gate:*`; live Desktop Side Chat
- Full-suite escalation: `none`
- Owner: this Spec
- Residual risk: Desktop may still pin a live `thread/started` child until reload; cross-harness context not in this slice

### Verification Impact Trace

| Changed surface / claim | Direct consumers | Material transitive or failure boundary | Selected evidence | Skipped suites / reason | Outcome / residual |
| --- | --- | --- | --- | --- | --- |
| Omit ephemeral derived from `thread/list` | Desktop sidebar, CLI list | Subagent/parent filters must stay | external-thread-list vitest | full host-runtime | pass |
| Projectless Fork stays on source | Renderer fork control | Codex/project native replay unchanged | renderer-fork-control vitest | Playwright / live Desktop | pass (unit) |
| Child Turn path | Host fork runtime | must still accept Turns | existing fork tests unchanged | live Side Chat | keep |

## Documentation Impact

- Classification: `requirement-canonical` (OpenSpec change) plus `project-current` (czz-dev, hub)
- Central Rule Task admission: `project-local / no central row`
- `doc_drift`: czz-dev sidechat paragraph restates old “derived Session is enough”; same-round update
- Affected authoritative documents: this folder, OpenSpec change, czz-dev, PROJECT_STATUS
- Root acceptance gate: focused list + fork-control tests green

## Execution Journal

| Event ID | Local Time | Work Unit / Attempt | Actor / Surface | Event | Prior -> Resulting State | Trigger / Evidence | Root Decision / Next Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | 2026-09-02 16:49 +08:00 | plan | pi | user selected F-1 | pending -> confirmed Spec | RAW-004 F1 | write Spec then implement binding/jump |
| E2 | 2026-09-02 16:49 +08:00 | implement | pi | list omit + stay on source | inject_items-only -> parent navigation | focused vitest | context injection later slice |

## Efficiency / Token Evidence

| Metric | Baseline | Observed | Delta | Confidence / Source |
| --- | --- | --- | --- | --- |
| runtime usage | n/a | usage unavailable | n/a | host does not expose counters |

## Closeout

- Sidecar: `main-thread`
- Requirement / business / tech route: this Spec + OpenSpec change + czz-dev
- Memory / error route: none unless a verified reusable failure appears
- Evolution Candidate: `none`
