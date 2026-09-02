# Task Card

> Standard non-requirement work only.

Tool: claude
Date: 2026-09-02
Task: 1437-in-turn-interjection-items

## Task Documentation Sync Group

- Group key: `dsg:codex-host:1437-in-turn-interjection-items`
- Group owner: this `task-card.md`
- Git document prefixes: `vibe/specs/260902/1437-in-turn-interjection-items/`, `openspec/changes/add-in-turn-interjection-items/`, `vibe/specs/PROJECT_STATUS.md`
- Declared code/config dependencies: `packages/harness-adapter/src/text-session.ts`, `packages/harness-adapter/src/testing.ts`, `packages/protocol-core/src/codex-ui-projector.ts`, `packages/adapters/grok/src/grok-adapter.ts`, `packages/adapters/grok/src/grok-history.ts`, `packages/adapters/grok/src/grok-interject.ts`, `packages/adapters/pi/src/pi-history.ts`, `packages/adapters/claude-code/src/claude-history.ts`, `packages/adapters/deepseek-harness/src/history.ts`
- Linked authorities: [proposal](../../../../openspec/changes/add-in-turn-interjection-items/proposal.md), [steer queue change](../../../../openspec/changes/add-external-turn-steer-queue/proposal.md), [1400 task card](../1400-grok-interject-archived-list/task-card.md)
- Excluded unrelated dirty documents: `docs/tasks/WORKTREE_TASKS.md`（并行 Pi 会话）

```json documentation-sync-group-v1
{
  "schema": "documentation-sync-group-v1",
  "group_key": "dsg:codex-host:1437-in-turn-interjection-items",
  "group_owner": "vibe/specs/260902/1437-in-turn-interjection-items/task-card.md",
  "documents": [
    "vibe/specs/260902/1437-in-turn-interjection-items/task-card.md",
    "openspec/changes/add-in-turn-interjection-items/proposal.md",
    "openspec/changes/add-in-turn-interjection-items/tasks.md",
    "openspec/changes/add-in-turn-interjection-items/specs/harness-adapter-text-session/spec.md",
    "openspec/changes/add-in-turn-interjection-items/specs/registered-harness-routing/spec.md",
    "vibe/specs/PROJECT_STATUS.md"
  ],
  "dependencies": [
    "packages/harness-adapter/src/text-session.ts",
    "packages/harness-adapter/src/testing.ts",
    "packages/protocol-core/src/codex-ui-projector.ts",
    "packages/adapters/grok/src/grok-adapter.ts",
    "packages/adapters/grok/src/grok-history.ts",
    "packages/adapters/grok/src/grok-interject.ts",
    "packages/adapters/pi/src/pi-history.ts",
    "packages/adapters/claude-code/src/claude-history.ts",
    "packages/adapters/deepseek-harness/src/history.ts"
  ],
  "validators": [],
  "git_scope_prefixes": [
    "vibe/specs/260902/1437-in-turn-interjection-items",
    "openspec/changes/add-in-turn-interjection-items",
    "vibe/specs/PROJECT_STATUS.md"
  ]
}
```

## Goal And Scope

- Goal: 插队在所有 Harness 上同轨——属于它进入的那条 Host Turn，以 Turn 内 `userMessage` 条目出现在实际投递位置；实时与历史一致。
- Decision source: 用户 2026-09-02 裁决「同轨」（对 D-2 的回答）。
- In scope: `HostItem.userMessage` 契约、projector、五家历史折叠与实时条目、Pi/OMP 结算放宽回收、Fork/回滚边界。
- Out of scope: Desktop 侧渲染改动（只验收官方 item 顺序）；EyPc 消费。

## Decision

- Documentation level: `standard`
- Execution: `main-only`
- Key decisions: 同轨而非分轨——实时路径已是同一 Turn，历史必须对齐；剥壳与折叠是同一条规则的两个表现（Grok 剥壳，Pi/OMP/Claude 折叠）。
- Facts checked (2026-09-02): Grok 包装模板见 `grok-adapter.test.ts` 假传输（按探针形态建模）；Pi steer 以普通 user 消息在 `toolUse` 之后投递（`agent-session.js` `_queueSteer`）；Claude steer 由 adapter 生成 uuid 推送（`sdk-transport.ts` `steer`）；DSH 历史目前只收 `source.kind=user`；官方 `userMessage` item 由 projector 从 Turn input 生成（`codex-ui-projector.ts` `#projectInput`）。
- High-risk / DB boundary: none.

## Work And Verification

- Status: `implemented-partial / this-commit`.
- Done: `HostItem.userMessage` 契约、testing fake `emitUserMessage`、projector 额外官方 `userMessage`（id 用 Host `itemId`）、Grok 实时投递 + 历史剥壳、Pi 历史折叠（`toolUse` 后的 user 为 steer；`model_change` 仍是新 prompt）与 Fork 边界跳过折叠条目。
- Remaining: OMP 历史（与 Pi 同规则）、Claude uuid / DSH `source.kind` / Cursor re-prompt、Pi/OMP 实时条目与 `1+deliveredSteers` 回收、Grok 实时 UUID 与历史 stableId 对齐、Desktop 重载真机。
- Verification: focused vitest grok-adapter/history、pi-history、codex-ui-projector、harness-adapter text-session 101 pass / 1 prior fail fixed; `npm run typecheck` pass.

## Closeout

- Sidecar: `main-thread`
- Memory / error route: none yet（实现后若发现启发式误判再登记）。
- Evolution Candidate: `none`
