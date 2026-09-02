# codexhost Project Status

Tool: dsh
Date: 2026-09-02

## Purpose

Compact process hub for active AI work. This file routes current tasks to project docs without storing durable rules.

## Rule Links

- Project documentation: [../rules/documentation.md](../rules/documentation.md)
- Project knowledge: [../knowledge/README.md](../knowledge/README.md)
- Global process rules: [../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/process/rules.md](../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/process/rules.md#3-project-location)

## Current Focus

- Status: Host last-turn Redo is committed. Composer overlay layout is committed; the Turn-action cluster was redesigned locally on 2026-09-02: it anchors to the selected Turn but never leaves the conversation viewport, Redo enables only from Host `historyRedoAvailable`, Edit confirms only when later Turns exist, and official Desktop Redo is a fallback solely for Codex-owned Threads. Preview remains [composer-overlay.preview.html](../../packages/renderer-extension/src/composer-overlay.preview.html).
- Latest task docs: [spec](260901/2042-external-thread-redo/spec.md), [raw](260901/2042-external-thread-redo/raw-requirement.md), [changes](260901/2042-external-thread-redo/changes.md), OpenSpec [add-external-thread-last-turn-redo](../../openspec/changes/add-external-thread-last-turn-redo/proposal.md).
- Existing product/integration work remains under [../../docs/tasks/260831-czz-dev-integration/](../../docs/tasks/260831-czz-dev-integration/spec.md).
- Sibling tasks now documented: Composer workspace-bar slice 6 (sibling worktrees / `additional` roots) in the workspace-bar OpenSpec change; Launcher source-checkout delegation CLI fallback in [task card](260902/1312-launcher-source-checkout-cli/task-card.md). The unread-only `app-server-host` hunk belongs to the unread change and is committed separately.
- Active correction: the Composer Worktree checkbox currently persists display state but does not route the official branch menu. The authorized fix and requirement delta are tracked in [task card](260902/1340-worktree-checkbox-routing/task-card.md).

## Active Task Index

| Task | Status | Authoritative Doc | Verification | Notes |
| --- | --- | --- | --- | --- |
| Host last-turn Redo | `committed b939a81 3b0275d` | [spec](260901/2042-external-thread-redo/spec.md) | vitest 79 files 712 pass; typecheck pass | OpenSpec change not archived |
| Composer overlay + Turn actions | `committed 2f3a53b`; redesign `live-verified / this-commit` | [preview](../../packages/renderer-extension/src/composer-overlay.preview.html) | renderer vitest pass; Playwright composer surface 1 pass; typecheck pass | Cluster now sticks inside the conversation viewport (`turnActionPlacement`); Redo is thread-level from Host inspect; official Redo fallback only for Codex-owned Threads |
| Workspace-bar slice 6 | `committed 18cfa10` | [tasks](../../openspec/changes/add-composer-workspace-bar/tasks.md) | thread-workspace vitest pass | sibling worktrees + `additional` roots |
| Worktree checkbox routing | `active / isolated-worktree bootstrap` | [task card](260902/1340-worktree-checkbox-routing/task-card.md) | pending | wire persisted checkbox to Desktop-owned Worktree choice |
| Launcher source-checkout CLI | `committed e12a5e8` | [task-card](260902/1312-launcher-source-checkout-cli/task-card.md) | cargo installation_layout 5 pass | delegation CLI fallback |
| AI rules init | `implemented-local / this-repo-commit-authorized` | [task-card](260901/2034-ai-rules-init/task-card.md) | `audit_ai_rules.py --mode project` OK | CodeNote catalog 另仓未提交 |
| czz-dev integration | existing / see task package | [docs/tasks/260831-czz-dev-integration](../../docs/tasks/260831-czz-dev-integration/spec.md) | see that verify | not migrated into `vibe/specs/` |

## Verification State

- Last verified: 2026-09-02 (full vitest + typecheck + boundaries + cargo launcher + Playwright composer surface)
- Commands: `vitest run` 79 files 712 pass / 2 skipped; `npm run typecheck` pass; `node tools/check-boundaries.mjs` pass; `cargo test -p codexhost-launcher --bin codexhost installation_layout` 5 pass; Playwright `renderer-composer-workspace-surface` 1 pass
- Live Desktop 2026-09-02 13:25: normal quit via `com.openai.codex` (launcher 74334 exited, descriptor removed), relaunched by `tools/local-source/cli.mjs launch`; launcher 16647 / desktop 16649 / controller 16651 / host runtime 16789; descriptor `0600`. CDP measurement through the Electron inspector: selected 1644px Turn scrolled past the top keeps the action cluster at scroller top + 8 (y 55–83) below the Share control (y 9–37); Redo disabled without a Host slot; rail dots hidden outside the scroller; deselect clears the cluster. No rollback/redo was executed on a live Thread.
- Unverified gaps: live rollback→Redo on a real external Thread (covered by Host tests only), `gate:*`, full `npm test`
- Earlier source Desktop relaunch (08:18): launcher 16232 / desktop 16234 / controller 16240; superseded by the 13:25 relaunch above. No force-kill, no descriptor cleanup in either round.
- Latest Sidecar result: main-thread
- Latest Prior Task Overlap: last-message-edit rollbackLastTurn; decision `new-task`
- Latest Documentation Impact: `requirement-canonical` OpenSpec change plus this hub
- Latest Efficiency / Token Evidence: `usage unavailable`

## Open Risk Or Deploy Gates

- Gate: `app-server-host.ts` mixes Redo, unread fallback, and workspace `extraRoots` hunks; `renderer-turn-actions.ts` mixes Host-first Redo with overlay layout
- Blocking condition: resolved 2026-09-02 by patch-staged batches `3b0275d` / `18cfa10` / `43b6ca0`; overlay `2f3a53b` is the rollback point for the Turn-action redesign
- Worktree control: `codex/260901-composer-workspace-bar` is fully contained in `czz-dev` (merge-base = worktree HEAD); `czz-dev` pushed to `origin/czz-dev` on 2026-09-02 (`c70b40a..a5277fc`, 32 commits, includes the concurrent `a5277fc` worktree-checkbox task card)
- Rollback note: Redo is additive (`historyRedo` optional, Host method, Renderer Host-first with official click fallback)

## Governance Baseline

- Template propagation: accepted global baseline; this project keeps only project-specific routes and does not copy mother-board rules.
- Codex evolution: `v3-route-accepted`; no Hook, supervisor, or rollout change in this repository.
- Rule Task Trace: accepted global baseline; this initialization is project-local and does not add a CodeNote registry row.
- `w24-primary-objective-continuity-accepted`: primary user work remains ahead of advisory governance lanes.
- `w28-documentation-impact-accepted`: this round synchronized project-current adapters/hubs and CodeNote catalog.
- `w30-standard-requirement-owner-accepted`: Standard requirement ownership remains raw requirement plus the Spec owner. The current Redo task uses that owner; AI-rules-init remains Standard non-requirement.

## Memory Routing

- Task rule declaration: recorded on the task card
- Sidecar document route: main-thread
- Prior Task Overlap: wechat-download-api / starter-kit adapter shape
- Evolution Candidate: none
- Project rules: created this round from former root `AGENTS.md` / `CLAUDE.md`
- Knowledge: architecture created this round; glossary remains `docs/领域术语表.md`
- ADR: empty index only; OpenSpec stays the capability authority
- Error memory: one record — [Grok 插队后 Host Turn 被判 failed](../knowledge/error-memory/grok-interjection-persists-extra-native-turn.md#L1) (2026-09-02, verified; fix in `packages/adapters/grok`, uncommitted pending user commit authority)
- DB memory: not configured

## Cross-Repository Links

| Concern | Repository | Status Hub |
| --- | --- | --- |
| Rule kernel / catalog | CodeNote | [project-index.json](../../../../CzzProj/CodeNote/vibe/knowledge/project-index.json#L470) |
| Adapter shape reference | wechat-download-api | [wechat PROJECT_STATUS](../../../../wechat-download-api/vibe/specs/PROJECT_STATUS.md#L1) |

## Next Update Trigger

Update this hub when current focus, active task docs, verification status, open gates, sibling links, or memory routing changes.
