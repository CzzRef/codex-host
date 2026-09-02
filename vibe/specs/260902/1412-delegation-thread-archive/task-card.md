# Task Card

> Standard non-requirement work only.

Tool: claude
Date: 2026-09-02
Task: 1412-delegation-thread-archive

## Task Documentation Sync Group

- Group key: `dsg:codex-host:1412-delegation-thread-archive`
- Group owner: this `task-card.md`
- Git document prefixes: `vibe/specs/260902/1412-delegation-thread-archive/`, `openspec/changes/add-delegation-thread-archive/`, `vibe/specs/PROJECT_STATUS.md`, `docs/czz-dev.md`
- Declared code/config dependencies: `packages/host-runtime/src/delegation-cli.ts`, `packages/host-runtime/src/delegation-types.ts`, `packages/host-runtime/src/delegation-control-registry.ts`, `packages/host-runtime/src/delegation-control-server.ts`, `packages/host-runtime/src/app-server-host.ts`
- Linked authorities: [OpenSpec change](../../../../openspec/changes/add-delegation-thread-archive/proposal.md), [rename change](../../../../openspec/changes/add-external-thread-rename/proposal.md), [archived list change](../../../../openspec/changes/add-delegation-thread-list-archived/proposal.md)
- Excluded unrelated dirty documents: Composer overlay files, Worktree checkbox routing, `thread list --archived` hunks of the sibling session in the same files

```json documentation-sync-group-v1
{
  "schema": "documentation-sync-group-v1",
  "group_key": "dsg:codex-host:1412-delegation-thread-archive",
  "group_owner": "vibe/specs/260902/1412-delegation-thread-archive/task-card.md",
  "documents": [
    "vibe/specs/260902/1412-delegation-thread-archive/task-card.md",
    "openspec/changes/add-delegation-thread-archive/proposal.md",
    "openspec/changes/add-delegation-thread-archive/tasks.md",
    "openspec/changes/add-delegation-thread-archive/specs/cross-harness-delegation/spec.md",
    "vibe/specs/PROJECT_STATUS.md",
    "docs/czz-dev.md"
  ],
  "dependencies": [
    "packages/host-runtime/src/delegation-cli.ts",
    "packages/host-runtime/src/delegation-types.ts",
    "packages/host-runtime/src/delegation-control-registry.ts",
    "packages/host-runtime/src/delegation-control-server.ts",
    "packages/host-runtime/src/app-server-host.ts"
  ],
  "validators": [],
  "git_scope_prefixes": [
    "vibe/specs/260902/1412-delegation-thread-archive",
    "openspec/changes/add-delegation-thread-archive"
  ]
}
```

## Goal And Scope

- Goal: Desktop 之外的消费者（EyPc 归档按钮）能真实归档 Host 托管的额外进程，而不是把 `thread/archive` 发给不认识该 id 的官方 app-server。
- Symptom: EyPc 对额外进程归档 6 次全部在预检 `thread/read` 失败（`protocol-error`），Host 记录与 Desktop 侧栏都不变；只有在 Codex App 里归档才生效。
- In scope: `thread archive [<thread>]` / `thread unarchive [<thread>]` 委派动词；控制服务路由 `/v1/thread/archive`；注册表归属路由；Host `#archiveDelegationThread` 与 Desktop 路径共用的 `#applyExternalArchiveState`；帮助文本与 OpenSpec 增量。第二轮（同日 18:10）：归档级联到 `ephemeral` side 子对话（`#cascadeSideChatArchiveState`）；`thread list` 的 status / attention 汇总运行中的 side 子对话到来源行（`#sideChatRootId` / `#sideChatRunningUnder`）。
- Out of scope: Desktop 归档 UI；原生 Codex Thread 归档；EyPc 侧消费（其仓库 RAW-199）。

## Decision

- Documentation level: `standard`
- Execution: `main-only`（与同 checkout 的并行会话共用工作树，改动全部为锚点式追加，不重排既有代码）
- Key decision: 归档语义与 Desktop `thread/archive` 完全一致——不停止运行中的 Turn、不关闭 Session、同一条 `thread/archived` 通知；CLI 只是多了一个入口，不是第二套归档状态。
- High-risk / DB boundary: none.

## Work And Verification

- Changed surface: `delegation-types.ts`（`ThreadArchiveInput/Result`、API `archive`）；`delegation-control-registry.ts`（归属路由）；`delegation-control-server.ts`（`/v1/thread/archive`）；`delegation-cli.ts`（动词、帮助）；`app-server-host.ts`（`#archiveDelegationThread`、`#applyExternalArchiveState`、`#notifyExternalArchiveState`，`#setExternalThreadArchived` 改为复用；第二轮 `#cascadeSideChatArchiveState` / `#sideChatRootId` / `#sideChatRunningUnder`）。
- Verification: 见 PROJECT_STATUS 行；聚焦 vitest 四个文件 + `tsc -b`；第二轮 app-server-host `side chat|archiv` 过滤用例（来源行 completed→running→completed，归档级联到子对话记录）。
- Unverified gaps: 第一轮 CLI 归档已在 15:22 源码重启后生效。第二轮 side 子对话级联 / 列表汇总需一次包含本变更的 Desktop 重启后真机核验。EyPc 消费见其 RAW-199。

## Closeout

- Sidecar: `main-thread`
- Memory / error route: none（症状与决定记录在 EyPc 侧错误记忆与本卡）
- Evolution Candidate: `none`
