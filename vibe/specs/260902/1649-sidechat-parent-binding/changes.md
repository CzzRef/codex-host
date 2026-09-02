# Changes：1649-sidechat-parent-binding

> Inventory only. This file answers which files changed and what each change was.

## 1. 概览

| 批次 | 提交 | 文件数 | 核心说明 |
| --- | --- | --- | --- |
| host-runtime | `f09642f` | 4 | 派生行默认列表省略、deep link 保留主会话导航 |
| renderer-extension | `ae8955f` | 4 | projectless fork 停留源会话、rebind 保留外部 overlay |
| 文档 | 见第 3 节 | 8 | 本任务包 + openspec change + 枢纽同步 |

## 2. 交付物清单

| 对象 | 类型 | 核心说明 |
| --- | --- | --- |
| `vibe/specs/260902/1649-sidechat-parent-binding/` | 新增 | Standard requirement 任务包 |
| `openspec/changes/add-sidechat-parent-navigation/` | 新增 | fork/list 能力增量 |
| `packages/host-runtime/src/external-thread-list.ts` | 改动 | 默认列表省略 ephemeral 派生 Thread |
| `packages/host-runtime/src/external-thread-repository.ts` | 改动 | 导航身份取 forkSource |
| `packages/renderer-extension/src/renderer-fork-control.ts` | 改动 | projectless Fork 后不打开子对话 |
| `docs/czz-dev.md` | 改动 | Side Chat 导航归属 |
| `vibe/specs/PROJECT_STATUS.md` | 改动 | 枢纽索引 |

## 3. 逐批清单

### 260902 提交批次

| 批次 | 提交 | 文件 | 核心说明 |
| --- | --- | --- | --- |
| host-runtime | `f09642f` | `external-thread-list.ts` / `external-thread-repository.ts` / `app-server-host.ts` + 测试 | 列表省略 ephemeral 派生行；导航身份取 forkSource |
| renderer-extension | `ae8955f` | `renderer-fork-control.ts` / `renderer-binding-probe.ts` + 测试 | Fork 后停留源会话；rebind 保留外部 overlay |
| 文档 | 本提交 | 第 2 节对象 + `changes.md` | openspec change、任务包、`czz-dev.md`、`PROJECT_STATUS.md` |

## 4. 明确没做的（分流，不是遗漏）

| 对象 | 数量 | 核心说明 |
| --- | --- | --- |
| 跨 Harness 父 transcript 注入 | 0 | 已确认产品意图，本切片只做绑定与跳转 |
| 把 Fork 写成 Subagent `parentThreadId` | 0 | 现行 list 契约禁止把 Fork 血缘当 Subagent |
| 重开外部 Thread `gitInfo` | 0 | 仍显式关闭；归属靠留在主对话而不是伪造 gitInfo |
| 独立 extra-process 主会话 | 0 | 非 ephemeral 派生的 Pi/Grok 主 Thread 仍可单独列出 |

## 5. 用户可见行为变化

| 位置 | 变化 | 核心说明 |
| --- | --- | --- |
| Desktop 侧栏 | ephemeral Side Chat 派生行不再作为独立会话出现 | 避免无项目孤儿对话 |
| projectless Fork | 不再点进子 Thread | 留在主对话 |
