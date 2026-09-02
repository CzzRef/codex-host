# Changes：Cursor native history 变更清单

> Inventory only. Judgement lives in `spec.md`; this file answers which files changed.

## 1. 概览

| 批次 | 提交 | 文件数 | 核心说明 |
| --- | --- | --- | --- |
| planned | — | — | Cursor 从 live-only 改为 Grok 式 ACP + 原生磁盘历史 |

## 2. 交付物清单

| 对象 | 类型 | 核心说明 |
| --- | --- | --- |
| `packages/adapters/cursor/src/cursor-history.ts` | 新增 | 解析 `~/.cursor/acp-sessions` 的 meta/store 并投影 Host snapshot |
| `packages/adapters/cursor/src/acp-transport.ts` | 改动 | create/load/resume 与磁盘历史读取 |
| `packages/adapters/cursor/src/cursor-adapter.ts` | 改动 | resume、readSnapshot、NativeTurnRef |
| `packages/adapters/cursor/src/cursor-models.ts` | 改动 | `history.transcript` 改为 native |
| `packages/renderer-extension/src/renderer-agent-icon.ts` | 改动 | 去掉 `(live only)` 标签 |
| `docs/czz-dev.md` | 改动 | 当前 Cursor 能力 |
| `.agents/skills/codexhost-add-harness/references/thread-lifecycle-and-history.md` | 改动 | Cursor 不再作为 live-only 示例 |

## 3. 明确没做的（分流，不是遗漏）

| 对象 | 数量 | 核心说明 |
| --- | --- | --- |
| Fork / rollback / side chat | 0 | Cursor 仍无稳定 checkpoint API |
| 抽取公共 ACP Transport | 0 | 与 Grok 仍保持独立 Adapter |
| 解析 IDE `~/.cursor/chats` | 0 | Host 只用 ACP session store |
| 编辑器 `cursor` CLI | 0 | 仍只发现 `cursor-agent` |
