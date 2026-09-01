# 变更清单

范围：czz-dev 的 Cursor Harness、本机源码安装入口、对应接线和文档；后续用户授权的 Pi 与 OMP 订阅配置单独记于文末。

## 主要代码与语义

| 变化 | 位置 | 结果 |
|---|---|---|
| Cursor Session 与能力边界 | [CursorAdapter](../../../packages/adapters/cursor/src/cursor-adapter.ts#L304-L313) | 仅 create，拒绝持久化恢复、无人值守扩权及独立 Thinking |
| 原生 Session 身份与快照 | [CursorSession](../../../packages/adapters/cursor/src/cursor-adapter.ts#L97-L108) | 保存 ACP 确认的 Session ID；原生快照明确 unsupported |
| 公共 live-only 合同 | [history capabilities](../../../packages/shared-contracts/src/harness-models.ts#L137-L157) | 原有 Adapter 默认 native；live-only 不允许 Fork/rollback |
| 当前进程投影与终态 | [ExternalThreadRuntime](../../../packages/host-runtime/src/external-thread-runtime.ts#L365-L405) | 直接读既有实时投影，不制造 NativeTurnRef 或第二份历史 |
| 委派权限 | [Coordinator](../../../packages/host-runtime/src/harness-delegation-coordinator.ts#L280-L287) | 默认使用目标原生权限，不强制 unattended-full-access |
| 源码入口检查 | [source CLI](../../../tools/local-source/cli.mjs#L31-L46) | 安装入口必须内容匹配、可执行；保留未知现有文件 |
| 启动与更新保护 | [source environment](../../../tools/local-source/cli.mjs#L217-L226)、[Rust precondition](../../../crates/launcher/src/main.rs#L597-L609) | 禁用自动更新；已有桌面或 descriptor 即拒绝 |
| 并发启动锁保护 | [ownership](../../../crates/launcher/src/desktop_attachment.rs#L52-L65) | 锁占用时拒绝；不 attach、不停旧实例、不重试 |
| OMP 默认权限 | [permission catalog](../../../packages/adapters/omp/src/omp-permission-modes.ts#L12-L38) · [create default](../../../packages/adapters/omp/src/omp-adapter.ts#L1893-L1898) · [resume/fork](../../../packages/adapters/omp/src/omp-adapter.ts#L1969-L1974) | 普通 create/resume/fork 默认 `write`；显式 unattended full access 仍可使用 `yolo` |
| macOS runtime 私有文件 | [guard](../../../crates/launcher/src/runtime_instance.rs#L172-L177) · [descriptor](../../../crates/launcher/src/runtime_instance.rs#L254-L269) · [test](../../../crates/launcher/src/runtime_instance.rs#L474-L503) | descriptor 临时文件与新建 guard 使用 `0600`；聚焦权限测试覆盖 |

Cursor 的 ACP 传输、configOptions 模型编码、流式 Turn 与权限/问题解释分别留在 `packages/adapters/cursor/src/` 的独立模块。其他变化为 protocol-core 的 carrier 路由、Host 注册、workspace/发布 bundle 依赖以及 Renderer 图标、选择状态、模型/模式和设置入口。Renderer 明示 `Cursor (live only)`。

核心合同片段：

```ts
if (input.kind !== "create") return failure("unsupported", HISTORY_MESSAGE);
```

该限制与 Host 当前进程内的 `thread/resume` 不矛盾：已加载 Session 可复用；Host 重启后必须重新调用 Adapter.open，届时明确失败。聚焦集成测试覆盖了这一区别及失败后不回落到官方 Codex。

```ts
executionPolicy: "default",
```

这是委派 Coordinator 的默认值；未删除其他 Adapter 已有的显式权限能力。初始实现轮次没有改本机账号配置，后续 Pi 授权续作见文末。

## 测试与文档传播

- Cursor Adapter/交互、carrier、Renderer、Host 实时历史与重启、委派和安全入口测试；最终 15 个 TypeScript/工具测试文件 245 项通过。
- Rust source precondition 新增 3 项纯状态回归通过；不启动真实 Desktop。
- README 三语言 fork 提示、docs/index、本机发现说明、ACP 现状、[接入指南](../../czz-dev.md)、OpenSpec live-only 与默认权限合同、Adapter 历史参考及本任务记录同步。
- [核验记录](verify.md) 记录当前真实 CLI、Desktop、源码及远端状态的分层边界。

## 仓库外变更

新增 `/Users/gdkmjd/.local/bin/codexhost`，内容只固定本机 Node 与当前 fork 的源码入口。未覆盖任何已有不同内容的命令。独立验证任务由各 Agent 正常生成自己的原生会话记录；本仓库不保存原始转录。

初始实现轮次排除：其他项目工作区、已有 Agent 账号配置、当前 Codex 进程、GitHub 远端 refs 与仓库设置。后续 Pi 续作只增量扩大到用户明确授权的 Pi 配置，不扩大到原生 Codex/Grok/Claude 凭据或当前进程。

## Pi 订阅授权续作

- 首次配置与新增 Grok 前分别备份 `~/.pi/agent/auth.json` 和 `settings.json`；用 Pi 原有 OAuth 保存独立 Codex、Grok 凭据，仅把默认提供方从 mirasim 修正为 openai-codex，保留 gpt-5.6-sol。
- Codex 的模型层与默认配置原生 Pi CLI 验证通过；用户完成二次验证后，Grok 独立 OAuth 及排除 API key 的 Pi 原生 grok-4.6 调用通过，doctor 识别 11 个模型；Claude 的 Pi extra usage 未启用。
- 本机接入指南及 spec/plan/tasks/verify/handoff/本清单同步；CodeNote 另保存无凭据的配置回执并更新当前入口。没有新增实现代码，没有重跑无关的全仓测试，也没有启动或重启 Desktop。

## Desktop 正常重启续作

- 用户已授权本次正常重启；重新执行当前源码完整构建通过，并核对 PID 84891、唯一 active 任务、受管入口及空的 runtime descriptor/launcher guard 状态。
- 仓库外新增单次恢复任务与结构化回执；它不保存 token、endpoint、原始输出或转录，不强制结束进程、不删除 descriptor、不循环重试。源码失败且无 Desktop 时只正常打开原应用。
- 单次恢复已完成，回执为 `source_launch_verified`；源码 Launcher PID 53779、Desktop PID 53781、Host runtime、controller 与 descriptor 匹配，用户确认已经接入。界面选择器逐项、审批 UI 和真实跨 Agent 委派仍须独立验收；没有提交或推送。

## OMP 安装与配置续作

- 安装官方 OMP 18.0.11 macOS arm64 Release 到 `~/.local/bin/omp`；Release digest 与本机 SHA-256 一致。本机 Bun 1.3.11 低于包要求，未升级 Bun。OAuth 前创建 `0700/0600` SQLite 恢复快照。
- OMP 独立 OpenAI Codex OAuth、Sol/Luna 模型角色、`high` Thinking 与 `write` 工具审批已落地；排除 API key、工具、扩展、技能、规则、LSP、PTY 和会话保存的默认模型调用通过。
- OMP 的 xAI 官方授权页面完成后，18.0.11 的设备令牌轮询仍未返回成功；provider 保持未认证，停止重试，不复制 Pi 的 Grok 凭据。doctor 将 OMP 判为 ready、8 个模型。
- `~/.omp` 敏感目录、数据库、配置、日志与备份权限已收口，浏览器任务空间关闭。当前 Desktop PID 53781 未因 OMP 配置重启；没有提交或推送。

## OMP 多订阅路由与第二次激活

- 用户完成后续接入并纠正目标：Codex Sol 顶层编排/核验、Claude Fable 规划、Grok 4.6 执行型 task/smol；Advisor 配置模型但保持关闭。Host 目录为 43 个模型，OMP 内实际调用仍只验收 Codex Sol。
- OMP Adapter 普通 create、resume、fork 默认权限改为 `write`；独立构建、26 项测试、lint 与格式检查通过。macOS descriptor/新建 guard 使用 `0600`，聚焦 Rust 权限测试与 Launcher 构建通过。
- 第二次正常激活后 Launcher PID 29444、Desktop PID 29446、descriptor 0600 与源码身份通过。回执保留自动校验的早期瞬态失败和后续 live refresh/doctor 通过证据；没有强制终止、descriptor 清理或自动重试。
- A-5 全工作区构建早期被并行 Renderer Models 页面类型改动阻断，本任务不修改该写集；并行 owner 完成后最终全量构建通过。路由变更前配置有 `0600` 备份，未提交或推送。

## 本地分批提交

- 用户于 2026-09-01 授权将当前代码变更分批提交；本轮只创建本地提交，没有 push 或修改远端默认分支。
- 前六批源码提交依次覆盖 Cursor Adapter（`293bcb8`）、Host/协议（`8970eed`）、Renderer（`8e7605b`）、外部线程（`70662f8`）、OMP 权限（`c8edadc`）和 Launcher（`f4d11a3`）；每批均核对暂存路径、空白检查与提交统计。
- 并行 Claude Code 在配置与文档写集完成后提交 Cursor 包/工作区接线（`440da5a`）、源码启动配置（`0b7dce6`）、首轮文档（`3123d61`）和预览格式（`0b67c08`）；Root 保留这些提交并重新盘点。
- 后续原生会话标题同步、外部线程后续回合排队与 Steer 显式拒绝在 `773290c` 提交；8 个受影响 Vitest 文件、345 项测试和完整 TypeScript/Renderer/Rust 构建通过。
- 本文所在提交只做最终文档收口。GitFork 预期不再保留未提交改动，所有批次仍未 push。

## A-7：卸载 Oh My Pi

- 用户要求卸载产品、中断进行中任务、保留源码。OMP RPC 进程组 31083 已 SIGTERM；删除 `~/.local/bin/omp` 与 `~/.omp`。doctor 回读 `notInstalled`。
- 更新本任务文档与 `docs/czz-dev.md` 的当前 Harness 状态；历史 U7/U8 安装记录保留。Adapter 源码未删。未提交、未推送。
