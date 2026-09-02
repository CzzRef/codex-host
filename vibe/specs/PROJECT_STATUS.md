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
- Sibling task (claude session, 2026-09-02 14:12): delegation CLI `thread archive|unarchive` so EyPc can archive extra processes through the Host instead of the official app-server; see [task card](260902/1412-delegation-thread-archive/task-card.md). Live after the 15:22 source relaunch.
- Worktree checkbox routing is merged into `czz-dev` (`c9ee09b`): the checkbox drives Desktop `setComposerMode(worktree|local)`, and the workspace surface is the compact changed-file line. Tracked in [task card](260902/1340-worktree-checkbox-routing/task-card.md).
- In-turn interjection items (2026-09-02): `HostItem.userMessage` plus Grok live/history unwrap and Pi history folding are implemented; OMP/Claude/DSH/Cursor and Desktop reload remain. Tracked in [task card](260902/1437-in-turn-interjection-items/task-card.md).
- Grok steer + archived listing (2026-09-02 14:00): grok 1.0.13 has no `x.ai/interject`; the Adapter now calls `_x.ai/interject` with `{sessionId, text}`, settles on checkpoint identity after waiting for the persisted `turn_completed`, and the Grok `1 + deliveredInterjections` relaxation from `2155d93` is withdrawn. `codexhost thread list` gains `--archived true|false` and an `archived` field on external rows so EyPc can retire Desktop-archived Threads. Tracked in [task card](260902/1400-grok-interject-archived-list/task-card.md) and OpenSpec [add-delegation-thread-list-archived](../../openspec/changes/add-delegation-thread-list-archived/proposal.md).
- Cursor native history (2026-09-02 15:02): replace ACP live-only with Grok-style `cursor-agent acp` plus `~/.cursor/acp-sessions` resume/snapshot. Merged into `czz-dev` (`467d491` / `d9809a5`). Tracked in [spec](260902/1502-cursor-native-history/spec.md).

## Active Task Index

| Task | Status | Authoritative Doc | Verification | Notes |
| --- | --- | --- | --- | --- |
| Host last-turn Redo | `committed b939a81 3b0275d` | [spec](260901/2042-external-thread-redo/spec.md) | vitest 79 files 712 pass; typecheck pass | OpenSpec change not archived |
| Composer overlay + Turn actions | `committed 2f3a53b`; redesign `live-verified / this-commit` | [preview](../../packages/renderer-extension/src/composer-overlay.preview.html) | renderer vitest pass; Playwright composer surface 1 pass; typecheck pass | Cluster now sticks inside the conversation viewport (`turnActionPlacement`); Redo is thread-level from Host inspect; official Redo fallback only for Codex-owned Threads |
| Workspace-bar slice 6 | `committed 18cfa10` | [tasks](../../openspec/changes/add-composer-workspace-bar/tasks.md) | thread-workspace vitest pass | sibling worktrees + `additional` roots |
| Worktree checkbox routing | `integrated c9ee09b` | [task card](260902/1340-worktree-checkbox-routing/task-card.md) | renderer workspace-bar + branch-toggle 10 pass; typecheck pass after merge | checkbox → Desktop `setComposerMode`; compact changed-file surface |
| Claude catalog refresh | `committed 63d359e` | [task-card](260902/1352-claude-catalog-refresh/task-card.md) | adapter+command vitest 94 pass; typecheck/eslint/prettier; real 2.1.252→2.1.258 swap re-inspects without refresh | `claude update` 2.1.252→2.1.258 done on request; 15:22 Host relaunch picks up identity-based cache |
| Grok interject + archived list | `committed 5c459fd a3c9f60` | [task-card](260902/1400-grok-interject-archived-list/task-card.md) | vitest 187 files 1601 pass; typecheck pass; boundaries pass; live grok 1.0.13 probes | `_x.ai/interject`, settle waits for `turn_completed`, `thread list --archived`; live after 15:22 relaunch |
| Launcher controller reap | `committed 09e0a66` | [task-card](260902/1349-launcher-controller-reap/task-card.md) | cargo platform+launcher tests, clippy, vitest desktop-control 68 pass, parent-kill runtime proof | signal flag in Launcher + parent watch in Controller |
| Launcher source-checkout CLI | `committed e12a5e8` | [task-card](260902/1312-launcher-source-checkout-cli/task-card.md) | cargo installation_layout 5 pass | delegation CLI fallback |
| Delegation thread archive | `committed a3c9f60` | [task-card](260902/1412-delegation-thread-archive/task-card.md), OpenSpec [add-delegation-thread-archive](../../openspec/changes/add-delegation-thread-archive/proposal.md) | delegation-cli / control-server / registry vitest pass; app-server-host `archiv` filter pass; `tsc -b` pass | `codexhost thread archive|unarchive [<thread>]`; shares Desktop archive persistence + `thread/archived`; live after 15:22 relaunch |
| In-turn interjection items | `implemented-partial / this-commit` | [task-card](260902/1437-in-turn-interjection-items/task-card.md), OpenSpec [add-in-turn-interjection-items](../../openspec/changes/add-in-turn-interjection-items/proposal.md) | focused vitest grok/pi/projector/fake 101 pass; typecheck pass | `HostItem.userMessage` + Grok 实时/历史剥壳 + Pi 历史折叠；OMP/Claude/DSH/Cursor 与 Desktop 重载待做 |
| AI rules init | `implemented-local / this-repo-commit-authorized` | [task-card](260901/2034-ai-rules-init/task-card.md) | `audit_ai_rules.py --mode project` OK | CodeNote catalog 另仓未提交 |
| czz-dev integration | existing / see task package | [docs/tasks/260831-czz-dev-integration](../../docs/tasks/260831-czz-dev-integration/spec.md) | see that verify | not migrated into `vibe/specs/` |
| Cursor native history | `integrated 467d491 / d9809a5` | [spec](260902/1502-cursor-native-history/spec.md) | cursor vitest 9 pass; tsc cursor+renderer; TS+renderer rebuilt | worktree removed, branch kept; Desktop quit but this agent cannot relaunch GUI — run `codexhost launch` in Terminal |

## Verification State

- Last verified: 2026-09-02 (1437 focused vitest + typecheck; post-merge renderer workspace tests 10 pass + typecheck; earlier full vitest + typecheck + boundaries + cargo launcher + Playwright composer surface)
- Commands: `vitest run` 79 files 712 pass / 2 skipped; `npm run typecheck` pass; `node tools/check-boundaries.mjs` pass; `cargo test -p codexhost-launcher --bin codexhost installation_layout` 5 pass; Playwright `renderer-composer-workspace-surface` 1 pass
- Live Desktop 2026-09-02 15:22: source relaunch after a clean quit; launcher 25474 / desktop 25476 / controller 25478 / host runtime 25634; descriptor `0600`. Supersedes 13:25 (16647/16649) and 08:18. CDP measurement from 13:25 still stands for the Turn-action cluster.
- Unverified gaps: live rollback→Redo on a real external Thread (covered by Host tests only), `gate:*`, full `npm test`
- 2026-09-02 14:09 (Grok interject + archived list): `vitest run` 187 files 1601 pass / 7 skipped; `npm run typecheck` pass; `node tools/check-boundaries.mjs` pass; live `_x.ai/interject` on scratch grok sessions (deleted). Host code is live after the 15:22 relaunch.
- Latest Sidecar result: main-thread
- Latest Prior Task Overlap: last-message-edit rollbackLastTurn; decision `new-task`
- Latest Documentation Impact: `requirement-canonical` OpenSpec change plus this hub
- Latest Efficiency / Token Evidence: `usage unavailable`

## Open Risk Or Deploy Gates

- Gate: `app-server-host.ts` mixes Redo, unread fallback, and workspace `extraRoots` hunks; `renderer-turn-actions.ts` mixes Host-first Redo with overlay layout
- Blocking condition: resolved 2026-09-02 by patch-staged batches `3b0275d` / `18cfa10` / `43b6ca0`; overlay `2f3a53b` is the rollback point for the Turn-action redesign
- Worktree control: `codex/260901-composer-workspace-bar` remains parked/contained; `codex/260902-worktree-checkbox-routing` is contained by `czz-dev` via merge `c9ee09b` (child HEAD `142fcfb`). `codex/260902-cursor-native-history` is contained by merge `467d491` (child HEAD `d9809a5`).
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
- Error memory: one record — [Grok 插队后 Host Turn 被判 failed](../knowledge/error-memory/grok-interjection-persists-extra-native-turn.md#L1) (2026-09-02, verified; root cause corrected the same day: `x.ai/interject` Method not found plus settle-before-persist, superseding the `2155d93` relaxation, fix committed `5c459fd`; native steer and `thread send --steer true` committed `658e905` / `a3c9f60`, live after 15:22 relaunch)
- DB memory: not configured

## Cross-Repository Links

| Concern | Repository | Status Hub |
| --- | --- | --- |
| Rule kernel / catalog | CodeNote | [project-index.json](../../../../CzzProj/CodeNote/vibe/knowledge/project-index.json#L470) |
| Adapter shape reference | wechat-download-api | [wechat PROJECT_STATUS](../../../../wechat-download-api/vibe/specs/PROJECT_STATUS.md#L1) |

## Next Update Trigger

Update this hub when current focus, active task docs, verification status, open gates, sibling links, or memory routing changes.
