# Standard Requirement Spec: 1502-cursor-native-history

Tool: dsh
Date: 2026-09-02
Status: `confirmed`
Documentation level: `standard requirement`

Raw source: [raw-requirement.md](raw-requirement.md)
Canonical target: [harness-adapter-text-session](../../../../openspec/specs/harness-adapter-text-session/spec.md), [registered-harness-routing](../../../../openspec/specs/registered-harness-routing/spec.md), [czz-dev 接入说明](../../../../docs/czz-dev.md)

## Task Documentation Sync Group

- Group key: `dsg:codex-host:1502-cursor-native-history`
- Group owner: this `spec.md`
- Git document prefixes: `vibe/specs/260902/1502-cursor-native-history/`, `vibe/specs/PROJECT_STATUS.md`, `docs/tasks/WORKTREE_TASKS.md`, `docs/czz-dev.md`, `docs/acp-layer-follow-up.md`, `.agents/skills/codexhost-add-harness/references/thread-lifecycle-and-history.md`
- Declared code/config dependencies: Cursor Adapter, renderer agent label, Host live-only path remains for other adapters
- Linked authorities: [thread lifecycle](../../../../.agents/skills/codexhost-add-harness/references/thread-lifecycle-and-history.md), [current implementations](../../../../.agents/skills/codexhost-add-harness/references/current-harness-implementations.md)
- Excluded unrelated dirty documents: Grok interject / Pi history / harness-adapter / protocol-core dirty hunks; sibling task cards
- Lookup contract: `get --lookup-only` returns `present/freshness=unchecked`; only `check status=hit` may reuse the gate.

```json documentation-sync-group-v1
{
  "schema": "documentation-sync-group-v1",
  "group_key": "dsg:codex-host:1502-cursor-native-history",
  "group_owner": "vibe/specs/260902/1502-cursor-native-history/spec.md",
  "documents": [
    "vibe/specs/260902/1502-cursor-native-history/raw-requirement.md",
    "vibe/specs/260902/1502-cursor-native-history/spec.md",
    "vibe/specs/260902/1502-cursor-native-history/changes.md",
    "vibe/specs/PROJECT_STATUS.md",
    "docs/tasks/WORKTREE_TASKS.md",
    "docs/czz-dev.md",
    "docs/acp-layer-follow-up.md",
    ".agents/skills/codexhost-add-harness/references/thread-lifecycle-and-history.md"
  ],
  "dependencies": [
    "packages/adapters/cursor/src/cursor-adapter.ts",
    "packages/adapters/cursor/src/acp-transport.ts",
    "packages/adapters/cursor/src/cursor-models.ts",
    "packages/adapters/cursor/src/cursor-history.ts",
    "packages/renderer-extension/src/renderer-agent-icon.ts"
  ],
  "validators": [],
  "git_scope_prefixes": [
    "vibe/specs/260902/1502-cursor-native-history",
    "vibe/specs/PROJECT_STATUS.md",
    "docs/tasks/WORKTREE_TASKS.md",
    "packages/adapters/cursor",
    "packages/renderer-extension/src/renderer-agent-icon.ts",
    "docs/czz-dev.md",
    "docs/acp-layer-follow-up.md",
    ".agents/skills/codexhost-add-harness/references/thread-lifecycle-and-history.md"
  ]
}
```

```json worktree-task-v1
{
  "schema": "worktree-task/v1",
  "task_id": "260902-cursor-native-history",
  "control_plane": "app-root",
  "target_branch": "czz-dev",
  "repositories": [
    {
      "repo_id": "codex-host",
      "base_sha": "c9ee09b3d5070ff308adb0a4d0a515e58bc576b7",
      "worktree_branch": "codex/260902-cursor-native-history",
      "task_owner": "vibe/specs/260902/1502-cursor-native-history/spec.md",
      "head": "c9ee09b3d5070ff308adb0a4d0a515e58bc576b7",
      "upstream": null
    }
  ],
  "commit_mode": "verified-milestone",
  "push_mode": "current-message-only",
  "verification_state": "planned",
  "push_state": "not-authorized",
  "integration_state": "not-started",
  "next_action": "implement Cursor native history and resume like Grok"
}
```

## Requirement Delta

- Modify: Cursor Adapter leaves `history.transcript: "live-only"` and becomes a Grok-style ACP CLI integration with native transcript.
- Add: `open({ kind: "resume" })`, `readSnapshot()`, stable `NativeTurnRef`, and on-disk history from `~/.cursor/acp-sessions/<sessionId>/`.
- Remove: Renderer label `Cursor (live only)`; product copy that Cursor cannot be restored after Host exit.
- Clarify: Fork / rollback / side chat stay unsupported until Cursor advertises a stable checkpoint API. Editor binary `cursor` is still not the Harness.

Confirmed facts:

- Connections Ready only means `cursor-agent` inspect passed.
- 2026-08-31 live-only decision was because ACP `session/load` did not replay history to the client; the task explicitly refused to parse the private store.
- This machine still has `~/.cursor/acp-sessions/<id>/{meta.json,store.db}`. `store.db` blobs are SHA-256 addressed; the latest root protobuf lists conversation message hashes, including JSON `{role,content,id}` turns from the original `CODEXHOST_CURSOR_OK` live check.
- Grok production path is `grok agent --no-leader stdio` plus `~/.grok/sessions/.../updates.jsonl`, not a different protocol family. Cursor should keep `cursor-agent acp` and add the same disk-history / load-or-resume layer.
- `cursor-agent status` / `whoami` from this DSH process hit `SecItemCopyMatching failed -50` and can segfault; Desktop Connections Ready is a different process with Keychain access. Live ACP round-trips stay a residual until a GUI/Host process can run them.

Pending decisions: none. Fork remains out of scope.

Acceptance:

1. `inspect()` still does not create a user Session.
2. `create` still uses ACP `session/new` and keeps the confirmed native Session ID.
3. After a successful Turn, the Adapter publishes a stable `NativeTurnRef` sourced from native history (assistant message id or blob hash), not a random Host id.
4. `readSnapshot()` returns ordered user/assistant Turns from the native store without fabricating an empty transcript.
5. `open({ kind: "resume" })` reopens the same native Session ID via ACP `session/load` or `session/resume` and can continue writing.
6. Host restart can restore a persisted Cursor Thread from Mapping Store + native store.
7. Renderer Agent label is `Cursor`.
8. Fork / rollback / unattended-full-access remain typed `unsupported`.
9. Focused tests cover history parse, snapshot, resume, and NativeTurnRef; Host generic live-only tests stay for other adapters.

## Requirement Change Review

- Scan scope: current request → czz-dev Cursor live-only contract → harness-adapter-text-session live-only exception → registered-harness-routing persist rules → Grok ACP+disk history.
- Visible changes: Cursor moves from live-only to native transcript; live-only remains a legal capability for other adapters.
- Conflict classification: `supersede` of the Cursor-specific live-only product decision in czz-dev integration; `compatible-update` of the public live-only schema.
- Decision status: `explicit-current-request`.
- User-facing review: Cursor sessions persist like Grok; no claim of Fork/side chat.
- Post-sync rescan: pending implementation.

## Prior Task Overlap

- Relationship: `continuation` of [czz-dev Cursor ACP](../../../../docs/tasks/260831-czz-dev-integration/spec.md) with a requirement delta on history.
- Document governance: new Standard requirement folder; do not rewrite 260831 verify as if it failed — it recorded the live-only decision correctly at the time.
- Execution logic: reuse Cursor ACP transport and Grok history/resume pattern; do not extract a shared ACP transport in this slice.
- Traceability and decision: `new-task` (delta-only on Cursor history).

## Canonical Merge

- Base: accepted live-only exception in harness-adapter-text-session / registered-harness-routing.
- Result: those specs keep live-only as an optional capability; Cursor current behavior moves to `docs/czz-dev.md` and this Spec.
- Merge status: no OpenSpec change package unless a later task needs a Cursor-specific capability spec. Current product authority is this Spec plus czz-dev.

## Implementation Sync

- Changed logic: Cursor Adapter reads `~/.cursor/acp-sessions`, resumes via ACP load/resume, and emits NativeTurnRef.
- Authoritative current document: this Spec until czz-dev is synchronized.
- Mapping: `cursor-agent acp` → `CursorAcpTransport` → native store parse → `HarnessSession.readSnapshot` / `open(resume)`.
- Verification evidence: cursor adapter/history vitest; renderer label test or icon assertion; typecheck of changed packages.
- Gap: live Desktop resume after Host restart needs a process that can access Cursor Keychain.

## Verification

### Verification Decision

- Route: `focused-automated`
- Reason: Adapter history identity change; Keychain blocks live `cursor-agent` from this DSH process
- Impact source: current source 2026-09-02
- Provisional trace completed before verification commands: `yes`
- Verification-command provenance: `impact-trace`
- Affected modules: `packages/adapters/cursor`, renderer agent label, czz-dev docs
- Checked: pending
- Skipped: full `npm test`; `gate:*`; live Desktop until Keychain-capable Host process
- Full-suite escalation: `none`
- Owner: this Spec
- Residual risk: Cursor store protobuf layout can change; Fork still unsupported

### Verification Impact Trace

| Changed surface / claim | Direct consumers | Material transitive or failure boundary | Selected evidence | Skipped suites / reason | Outcome / residual |
| --- | --- | --- | --- | --- | --- |
| Native store parse | `readSnapshot` / resume settle | WAL / missing db / system blobs | cursor-history vitest with synthetic sqlite | live Keychain ACP | pending |
| `open(resume)` | Host restart | ACP load vs resume capability | cursor-adapter vitest | live Desktop | pending |
| Successful Turn NativeTurnRef | Host persist | missing assistant id | adapter settle test | Host full suite | pending |
| Renderer label | Agent picker / Connections | stale "live only" copy | icon label assertion | Playwright | pending |
| Host live-only path | other adapters | must not delete generic support | existing host-runtime live-only test unchanged | none | keep |

## Documentation Impact

- Classification: `project-current` (czz-dev / ACP follow-up / add-harness Cursor note) plus this Spec
- Central Rule Task admission: `project-local / no central row`
- `doc_drift`: czz-dev and add-harness still say Cursor is live-only
- Affected authoritative documents: this folder, PROJECT_STATUS, czz-dev, acp-layer-follow-up, thread-lifecycle-and-history, renderer label
- Root acceptance gate: focused cursor tests green

## Execution Journal

| Event ID | Local Time | Work Unit / Attempt | Actor / Surface | Event | Prior -> Resulting State | Trigger / Evidence | Root Decision / Next Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | 2026-09-02 15:02 +08:00 | plan | dsh | classify Standard requirement + worktree | Q&A -> confirmed spec | user: live 没用, 改成 Grok CLI 形式 | isolate on dirty czz-dev and implement native history |

## Efficiency / Token Evidence

| Metric | Baseline | Observed | Delta | Confidence / Source |
| --- | --- | --- | --- | --- |
| runtime usage | n/a | usage unavailable | n/a | host does not expose counters |

## Closeout

- Sidecar: `main-thread`
- Requirement / business / tech route: this Spec + czz-dev current notes
- Memory / error route: none unless a verified reusable failure appears
- Evolution Candidate: `none`
