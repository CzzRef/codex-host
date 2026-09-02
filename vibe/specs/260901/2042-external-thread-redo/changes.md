# Changes：Host 全局 last-turn 对话 Redo

> Inventory only. Judgement lives in [spec.md](spec.md). Rows from `git diff --stat` / `git status` on 2026-09-01.

## 1. 概览

| 批次 | 提交 | 文件数 | 核心说明 |
| --- | --- | --- | --- |
| process | `b939a81` | 8 | Standard requirement + OpenSpec 增量 |
| implementation | `3b0275d` + `2f3a53b` | 16 | Store 槽、Host resume、client、Fake resume 在 `3b0275d`；注入按钮 Host-first 与 overlay 布局在 `2f3a53b` |

## 2. 交付物清单

| 对象 | 类型 | 核心说明 |
| --- | --- | --- |
| `vibe/specs/260901/2042-external-thread-redo/raw-requirement.md` | 新增 | 原始需求 |
| `vibe/specs/260901/2042-external-thread-redo/spec.md` | 新增 | Standard requirement 过程 owner |
| `vibe/specs/260901/2042-external-thread-redo/changes.md` | 新增 | 本清单 |
| `vibe/specs/PROJECT_STATUS.md` | 改动 | 当前焦点切到 Redo 任务 |
| `openspec/changes/add-external-thread-last-turn-redo/proposal.md` | 新增 | OpenSpec 提案 |
| `openspec/changes/add-external-thread-last-turn-redo/design.md` | 新增 | 设计决策 |
| `openspec/changes/add-external-thread-last-turn-redo/tasks.md` | 新增 | 实现任务 |
| `openspec/changes/add-external-thread-last-turn-redo/specs/external-thread-mapping-store/spec.md` | 新增 | Store 槽增量 |
| `openspec/changes/add-external-thread-last-turn-redo/specs/external-thread-fork-routing/spec.md` | 新增 | Host Redo 路由增量 |
| `packages/mapping-store/src/records.ts` | 改动 | `historyRedo` V1 字段 |
| `packages/mapping-store/src/mapping-store.ts` | 改动 | stash / restore / clear |
| `packages/mapping-store/src/index.ts` | 改动 | 导出 Redo input 类型 |
| `packages/mapping-store/test/index.test.ts` | 改动 | 槽测试 |
| `packages/host-runtime/src/external-thread-redo.ts` | 新增 | Host redo 执行 |
| `packages/host-runtime/src/external-thread-rollback.ts` | 改动 | 导出配置恢复辅助 |
| `packages/host-runtime/src/external-thread-repository.ts` | 改动 | `commitLastTurnRedo` |
| `packages/host-runtime/src/app-server-host.ts` | 改动 | `codexhost/thread/redo` + inspect 标志；文件中另有无关 unread hunk |
| `packages/host-runtime/test/app-server-host.test.ts` | 改动 | rollback→redo→continue；无槽拒绝 |
| `packages/shared-contracts/src/harness-models.ts` | 改动 | `historyRedoAvailable` |
| `packages/shared-contracts/test/harness-models.test.ts` | 改动 | inspect 解析 |
| `packages/harness-adapter/src/testing.ts` | 改动 | Fake resume-after-close |
| `packages/renderer-extension/src/renderer-model-client.ts` | 改动 | `redoThread` |
| `packages/renderer-extension/src/versioned-renderer-adapter.ts` | 改动 | 转发 `redoThread` |
| `packages/renderer-extension/src/renderer-turn-actions.ts` | 改动 | Host-first Redo + 官方 fallback |
| `packages/renderer-extension/test/renderer-model-client.test.ts` | 改动 | Redo RPC |
| `packages/renderer-extension/test/renderer-workspace-bar.test.ts` | 改动 | Redo copy |

## 3. 逐批清单

### process `b939a81`

| 文件 | 核心说明 |
| --- | --- |
| `vibe/specs/260901/2042-external-thread-redo/*` | 过程文档 |
| `openspec/changes/add-external-thread-last-turn-redo/*` | 能力增量 |
| `vibe/specs/PROJECT_STATUS.md` | 焦点切换 |

### implementation `3b0275d` / `2f3a53b`

| 文件 | 核心说明 |
| --- | --- |
| mapping-store 四文件 | 持久化槽 |
| host-runtime redo/rollback/repository/app-server-host | 执行与路由 |
| renderer 三源文件 + 两测试 | 按钮与 client |
| shared-contracts + harness-adapter testing | inspect 标志与 Fake resume |

## 4. 明确没做的（分流，不是遗漏）

| 对象 | 数量 | 核心说明 |
| --- | --- | --- |
| 官方 `thread/redo` | 0 | Desktop 无此方法 |
| Adapter `open(redo)` | 0 | 复用 `resume` |
| 项目文件 Redo | 0 | Desktop Undo/Reapply |
| Grok 原地 rewind 前进 | 0 | 同 Native Session ID 不写槽 |
| Cursor / DSH | 0 | 无 `rollbackLastTurn` |
| Composer workspace-bar | 1 组脏文件 | 排除，不属本任务 |
| `app-server-host` unread hunk | 1 | 预先存在的无关改动，单独提交为 `43b6ca0` |

## 5. 用户可见行为变化

| 位置 | 变化 | 核心说明 |
| --- | --- | --- |
| Composer Redo | 点官方按钮 → 先走 Host 恢复 last-turn 槽 | Pi/OMP/Claude 等 distinct Session 回滚后可恢复 |
| 官方 Codex Thread | Host 拒绝后仍点官方 Redo | 不拦截官方动作栈 |

## 6. 顺手发现但未处理

| 位置 | 现象 | 核心说明 |
| --- | --- | --- |
| 注入 `thread/rollback` | Desktop 不一定把 RPC 结果写回对话 DOM | 与现有注入 Rollback 相同；Native Session 为准 |

## 7. 回归数字

| 批次 | 测试 | 构建 | 静态检查 |
| --- | --- | --- | --- |
| implementation | vitest 79 files / 712 pass（2026-09-02 全量） | `tsc -b` pass；boundaries pass | 未跑 eslint / `npm test` / `gate:*` |
