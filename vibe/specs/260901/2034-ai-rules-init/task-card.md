# Task Card

> Standard non-requirement work only.

Tool: dsh
Date: 2026-09-01
Task: 2034-ai-rules-init

## Task Documentation Sync Group

- Group key: `dsg:codex-host:2034-ai-rules-init`
- Group owner: this `task-card.md`
- Git document prefixes: `AGENTS.md`, `CLAUDE.md`, `vibe/`
- Durable document members: adapters, `vibe/rules/*`, `vibe/specs/*`, `vibe/knowledge/*`; CodeNote `vibe/knowledge/project-index.json` and ignored `workspace.local.json`
- Declared code/config dependencies: none (read-only on application source)
- Linked current/canonical/rule/memory authorities: CodeNote starter-kit, wechat-download-api adapter shape, this hub
- Excluded unrelated dirty documents: Composer workspace-bar TypeScript/test files already dirty on `czz-dev`
- Lookup contract: `get --lookup-only` returns `present/freshness=unchecked`; only `check status=hit` may reuse the gate.

```json documentation-sync-group-v1
{
  "schema": "documentation-sync-group-v1",
  "group_key": "dsg:codex-host:2034-ai-rules-init",
  "group_owner": "vibe/specs/260901/2034-ai-rules-init/task-card.md",
  "documents": [
    "AGENTS.md",
    "CLAUDE.md",
    "vibe/rules/README.md",
    "vibe/rules/project.md",
    "vibe/rules/workflow.md",
    "vibe/rules/knowledge.md",
    "vibe/rules/documentation.md",
    "vibe/specs/README.md",
    "vibe/specs/PROJECT_STATUS.md",
    "vibe/specs/260901/2034-ai-rules-init/task-card.md",
    "vibe/specs/260901/2034-ai-rules-init/changes.md",
    "vibe/knowledge/README.md",
    "vibe/knowledge/architecture.md",
    "vibe/knowledge/adr/README.md",
    "vibe/knowledge/error-memory/README.md"
  ],
  "dependencies": ["docs/领域术语表.md", "docs/harness-command-integration.md"],
  "validators": [],
  "git_scope_prefixes": ["AGENTS.md", "CLAUDE.md", "vibe"]
}
```

## Goal And Scope

- Goal: determine whether this GitFork `codex-host` checkout already follows CodeNote AI programming rules; if not, initialize the adapter/rule/knowledge/process chain.
- In scope: short `AGENTS.md`/`CLAUDE.md`; `vibe/rules`; `vibe/knowledge`; `vibe/specs`; CodeNote catalog + this-host binding.
- Out of scope: application code; live Desktop/Gates; commit/push; migrating `docs/tasks/` or `openspec/`; overwriting unrelated dirty files.
- Success evidence: project audit green; adapters route to CodeNote master; former root coding rules preserved in `vibe/rules/project.md`.

## Decision

- Documentation level: `standard`
- Execution: `main-only`
- Automation lane: `not-applicable`
- Key decision and reason: apply wechat-download-api / starter-kit adapter shape; do not copy VibeAi body; do not enable intent-note, design-preference, or AI-DB; keep `docs/tasks/` as existing task authority.
- High-risk / DB boundary: none; no SQL; unrelated dirty files excluded.
- Plan-mode preflight completed before first edit: `yes`
- Plan artifact scope and documentation impact: `project-current`
- Verification map: absent — static analysis
- Provisional `VerificationImpactTrace` completed before verification commands: `yes`
- Verification-command provenance: `impact-trace`
- Test additions/execution: impact-selected only; no separate user enumeration required

## Prior Task Overlap

- Relationship: `reference-only`
- Prior authority and verified state: wechat-download-api `260824/1404-wechat-api-rules-init` already encodes the downstream adapter shape. This repo's `docs/tasks/260831-czz-dev-integration` is product integration, not rule initialization.
- Document governance: this repository had long root `AGENTS.md`/`CLAUDE.md` and no `vibe/` tree.
- Execution logic verification / residual gates: CodeNote catalog had no `codex-host` row.
- Traceability and decision: `new-task` with template delta (do not rerun those migrations; do not migrate existing `docs/tasks/`).

## Documentation Realization

- not applicable (initialization, not a runtime/rule correction)

## Optimization And Template Propagation

- Optimization promotion: `not-applicable`
- Applied project/template impact: this root only; starter-kit unchanged
- Parent task / excluded roots: none

## Rule Task Trace

- Registry scope: `project-local / not-admitted`
- Registry identity / row: none
- Requirement and implementation authority: this task card + project rules
- Propagation / delegation / Root acceptance: project-local

## Work And Verification

- Changed surface: converted adapters; new vibe tree; CodeNote project-index + workspace binding
- Verification: project-mode AI rule audit; relative-link resolution; resolver `--project codex-host`
- Unverified gaps: live Desktop, Gate probes, full `npm test`

### Verification Decision

- Route: `static`
- Reason: docs/rules only; no executable behavior change
- Impact source and freshness: inspected 2026-09-01 source tree
- Plan verification clauses reconciled before execution: `yes`
- Affected modules / boundaries: adapters, vibe tree, CodeNote catalog
- Checked: `audit_ai_rules.py --mode project` OK; resolver `--project codex-host` path matches this clone; `audit_code_links.py` remaining line-suffix repaired
- Skipped: `npm test`; `gate:*`; live Desktop
- Full-suite escalation: `none`
- Owner: this task card
- Residual risk: application dirty files remain unrelated

### Verification Impact Trace

| Changed surface / claim | Direct consumers | Material transitive or failure boundary | Selected evidence | Skipped suites / reason | Outcome / residual |
| --- | --- | --- | --- | --- | --- |
| New short `AGENTS.md` / `CLAUDE.md` / `vibe/rules` | future agents in this repo | broken relative link to CodeNote master | `audit_ai_rules.py --mode project` | app tests — no behavior change | OK |
| Former root coding rules | later implementation tasks | lost constraints | preserved in `vibe/rules/project.md` and `vibe/knowledge/architecture.md` | n/a | moved, not deleted |
| CodeNote `project-index.json` | workspace resolver | invalid identity/markers | resolver `--project codex-host` | full master audit — catalog row only | resolves to this clone |
| Application source | runtime | none this round | read-only | live Desktop/Gates | no code change |

## Authority Packet And Documentation Impact

- Authority refs read: session-title, routing, VibeAi, CodeNote project entry, starter-kit, migration playbook, wechat-download-api adapters, process/rules §1–3
- Decisive source evidence: this checkout had long root adapters and no `vibe/` tree
- `doc_drift`: none in this repository; CodeNote hub row added only if the file is clean
- Document impact: `project-current`
- Synchronized authorities and verification: this repo hubs + CodeNote catalog
- Root acceptance gate: `accepted` for this repository; commit/push not authorized

## Execution Journal

| Event ID | Local Time | Work Unit / Attempt | Actor / Surface | Event | Prior -> Resulting State | Trigger / Evidence | Root Decision / Next Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E1 | 2026-09-01 20:34 +08:00 | inspect | dsh | inventory | no `vibe/` -> confirmed uninitialized | glob/grep of adapters | initialize |
| E2 | 2026-09-01 20:34 +08:00 | adapters | dsh | write short routers + vibe tree | long root adapters -> CodeNote chain | wechat-download-api shape | run project audit |
| E3 | 2026-09-01 20:40 +08:00 | verify | dsh | project audit + resolver | unverified -> `audit_ai_rules.py --mode project` OK; `--project codex-host` resolves | code-link line suffix repaired | no commit |
| E4 | 2026-09-01 21:05 +08:00 | git | dsh | user authorized this-repo local commit | uncommitted adapters -> commit candidates `AGENTS.md` `CLAUDE.md` `vibe/` | exclude Composer dirty files and CodeNote mixed dirty tree | commit this repo only |

## Efficiency / Token Evidence

| Metric | Baseline | Observed | Delta | Confidence / Source |
| --- | --- | --- | --- | --- |
| runtime usage | n/a | usage unavailable | n/a | host does not expose counters |

## TaskExperienceObservation

- Result: `not applicable`

## Implementation Sync

- Authoritative current behavior: [architecture.md](../../../knowledge/architecture.md)
- Module / document mapping: former root `AGENTS.md` constraints now in [project.md](../../../rules/project.md)
- Evidence: source read 2026-09-01; runtime unproven

## Closeout

- Sidecar: `main-thread`
- Requirement / business / tech route: no product requirement delta; architecture map written
- Memory / error route: project knowledge created; error archive none
- Evolution Candidate: `none`

## 任务规则声明

- Global entry: CodeNote VibeAi + routing, loaded once
- Project entry: root `AGENTS.md` -> `vibe/rules/README.md`
- Sidecar mode: main-thread
- Document routing: `vibe/rules/documentation.md` + this task card
- High-risk gate: no SQL mutation; no overwrite of unrelated dirty files
