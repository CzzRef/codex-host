# codexhost Project Status

Tool: dsh
Date: 2026-09-01

## Purpose

Compact process hub for active AI work. This file routes current tasks to project docs without storing durable rules.

## Rule Links

- Project documentation: [../rules/documentation.md](../rules/documentation.md)
- Project knowledge: [../knowledge/README.md](../knowledge/README.md)
- Global process rules: [../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/process/rules.md](../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/process/rules.md#3-project-location)

## Current Focus

- Status: CodeNote AI rule chain initialized (short adapters + `vibe/rules` + knowledge/process hubs). Application code not changed in this task.
- Latest task docs: [task card](260901/2034-ai-rules-init/task-card.md), [changes](260901/2034-ai-rules-init/changes.md).
- Existing product/integration work remains under [../../docs/tasks/260831-czz-dev-integration/](../../docs/tasks/260831-czz-dev-integration/spec.md).
- Unrelated dirty Composer workspace-bar files are retained and not part of this task.

## Active Task Index

| Task | Status | Authoritative Doc | Verification | Notes |
| --- | --- | --- | --- | --- |
| AI rules init | `implemented-local / this-repo-commit-authorized` | [task-card](260901/2034-ai-rules-init/task-card.md) | `audit_ai_rules.py --mode project` OK | CodeNote catalog 另仓未提交 |
| czz-dev integration | existing / see task package | [docs/tasks/260831-czz-dev-integration](../../docs/tasks/260831-czz-dev-integration/spec.md) | see that verify | not migrated into `vibe/specs/` |

## Verification State

- Last verified: 2026-09-01 (docs/rules)
- Commands: CodeNote `audit_ai_rules.py --mode project` OK; resolver `--project codex-host` returns this clone
- Unverified gaps: live Desktop, Gate probes, full `npm test`
- Latest Sidecar result: main-thread
- Latest Prior Task Overlap: wechat-download-api adapter shape; decision `new-task`
- Latest Documentation Impact: `project-current` plus CodeNote catalog and this-host binding
- Latest Efficiency / Token Evidence: `usage unavailable`

## Open Risk Or Deploy Gates

- Gate: unrelated dirty Composer workspace-bar files
- Blocking condition: this task must not overwrite or commit those files
- Rollback note: adapters and `vibe/` are new or converted routing files; original coding rules live in `vibe/rules/project.md`

## Governance Baseline

- Template propagation: accepted global baseline; this project keeps only project-specific routes and does not copy mother-board rules.
- Codex evolution: `v3-route-accepted`; no Hook, supervisor, or rollout change in this repository.
- Rule Task Trace: accepted global baseline; this initialization is project-local and does not add a CodeNote registry row.
- `w24-primary-objective-continuity-accepted`: primary user work remains ahead of advisory governance lanes.
- `w28-documentation-impact-accepted`: this round synchronized project-current adapters/hubs and CodeNote catalog.
- `w30-standard-requirement-owner-accepted`: Standard requirement ownership remains raw requirement plus the Spec owner; this task is Standard non-requirement (task card).

## Memory Routing

- Task rule declaration: recorded on the task card
- Sidecar document route: main-thread
- Prior Task Overlap: wechat-download-api / starter-kit adapter shape
- Evolution Candidate: none
- Project rules: created this round from former root `AGENTS.md` / `CLAUDE.md`
- Knowledge: architecture created this round; glossary remains `docs/领域术语表.md`
- ADR: empty index only; OpenSpec stays the capability authority
- Error memory: empty index; `错误归档: 无，原因=本轮无已验证可复用失败`
- DB memory: not configured

## Cross-Repository Links

| Concern | Repository | Status Hub |
| --- | --- | --- |
| Rule kernel / catalog | CodeNote | [project-index.json](../../../../CzzProj/CodeNote/vibe/knowledge/project-index.json#L470) |
| Adapter shape reference | wechat-download-api | [wechat PROJECT_STATUS](../../../../wechat-download-api/vibe/specs/PROJECT_STATUS.md#L1) |

## Next Update Trigger

Update this hub when current focus, active task docs, verification status, open gates, sibling links, or memory routing changes.
