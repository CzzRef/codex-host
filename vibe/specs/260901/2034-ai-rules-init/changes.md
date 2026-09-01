# Changes：codexhost AI 规则初始化

> Inventory only. This file answers which files changed and what each change was.

## 1. 概览

| 批次 | 提交 | 文件数 | 核心说明 |
| --- | --- | --- | --- |
| 规则初始化 | uncommitted | 见下表 | 把长根适配器改成 CodeNote 短路由，并写入 `vibe/`；未改业务代码 |

## 2. 交付物清单

| 对象 | 类型 | 核心说明 |
| --- | --- | --- |
| `AGENTS.md` | 改写 | 短路由适配器，链到 CodeNote master 与项目规则 |
| `CLAUDE.md` | 改写 | Claude 对等入口，双向指向 `AGENTS.md` |
| `vibe/rules/` | 新增 | 项目规则索引、栈/风险、命令、文档路由 |
| `vibe/specs/` | 新增 | 过程枢纽 + 本任务 card/changes |
| `vibe/knowledge/` | 新增 | 架构地图、空 ADR/error-memory 索引 |
| CodeNote `vibe/knowledge/project-index.json` | 改动 | 登记项目身份与 authority routes |
| CodeNote `vibe/knowledge/workspace-config/workspace.local.json` | 改动 | 本机 binding（该文件本就 gitignore） |
| CodeNote `vibe/specs/PROJECT_STATUS.md` | 改动 | 增加本仓规则初始化枢纽行 |

## 3. 逐批清单

### 规则初始化 uncommitted

| 文件 | 核心说明 |
| --- | --- |
| `AGENTS.md` / `CLAUDE.md` | 短路由适配器，不复制 VibeAi |
| `vibe/rules/project.md` | 原根 `AGENTS.md` 编码约束与边界 |
| `vibe/knowledge/architecture.md` | 原 `CLAUDE.md` 架构说明 |
| `vibe/specs/260901/2034-ai-rules-init/task-card.md` | Standard 任务卡 |

## 4. 明确没做的（分流，不是遗漏）

| 对象 | 数量 | 核心说明 |
| --- | --- | --- |
| 业务源码 | 0 | 本轮只读理解；未改 dirty Composer 文件 |
| `vibe/ai-db/` | 0 | 非 AI-DB 项目 |
| `vibe/requirements/` | 0 | 无需求增量 |
| `.cursor/rules/` | 0 | 本仓无既有 Cursor 项目规则，不新造 |
| `docs/tasks/` 迁移 | 0 | 既有任务权威保留在原路径 |

## 5. 用户可见行为变化

无。应用代码、Desktop 注入、Harness Adapter 均未改。

## 6. 顺手发现但未处理

| 位置 | 现象 | 核心说明 |
| --- | --- | --- |
| working tree | Composer workspace-bar 相关 TS/测试已 dirty | 与本任务无关，不覆盖、不提交 |
| `docs/tasks/260831-czz-dev-integration` | 既有 Controlled 风格任务包 | 不迁入 `vibe/specs/` |

## 7. 回归数字

| 批次 | 测试 | 构建 | 静态检查 |
| --- | --- | --- | --- |
| 规则初始化 | 未跑应用测试 | 未构建 | `audit_ai_rules.py --mode project` OK；`audit_code_links.py` OK；resolver `--project codex-host` OK |
