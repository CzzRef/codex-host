# 会话衔接

源码：`/Users/gdkmjd/work/czz/GitFork/codex-host`；当前分支 `czz-dev`；本地命令 `~/.local/bin/codexhost` 指向此 checkout。完整操作和回退说明见 [czz-dev 接入指南](../../czz-dev.md)。

## 已完成与当前边界

- 独立 Cursor ACP Adapter、公共 carrier/能力、Host 与 Renderer 接线、源码构建和受管入口安装。
- Claude Code、Grok、Cursor 的独立真实回答通过；Claude/Grok 原生历史与恢复通过。
- Cursor 仅当前 Host 保留实时投影；跨进程恢复、快照、Fork、rollback 明确不支持。
- DSH 仅 inspection。Pi 已接入 Codex、Grok 两个独立订阅 OAuth；gpt-5.6-sol 与 grok-4.6 原生 CLI 均通过，默认仍为 openai-codex/gpt-5.6-sol，doctor 识别 11 个模型。Oh My Pi 已按用户要求卸载，doctor 为 `notInstalled`；本仓 OMP Adapter 源码保留。
- 用户已经完成 Grok 二次验证；重新授权与 Pi 实际调用完成，无须再等待该授权，浏览器任务空间已关闭。Claude 的 Pi 额外计费未启用，原生 Claude Code Max 保留。
- 当前 fork 的已验收代码、配置、首轮文档与格式已分十一批本地提交，本文所在提交完成最终收口；未推送。origin=CzzRef，upstream=BytePioneer-AI，GitHub 默认分支未改。

## A-3 Desktop 正常重启结果

用户于 2026-09-01 明确允许继续并重启。重启前旧 Desktop 为 PID 84891，应用内只有本任务 active；`czz-dev` 当前源码重新完整构建通过，重启前 runtime descriptor 与 launcher guard 均不存在。

一次性恢复任务已正常完成，结构化回执位于 `/Users/gdkmjd/.local/state/codexhost/restarts/01a055a0-cc69-7d41-8896-ae5fd7522fed/receipt.json`，状态为 `source_launch_verified`。源码 Launcher PID 53779、Desktop PID 53781、Host runtime、controller 与 descriptor 匹配；过程没有启动第二实例、注入旧应用、使用上游 dev-desktop 脚本、kill、清理 descriptor 或循环重试。

当前源码启动和 Host runtime 为 `source-launch-verified`，用户确认已经接入。Agent 选择器各入口、审批 UI 与真实跨 Agent 委派仍需分别验收；回执与 doctor 不能替代这些行为证据。OMP 产品已卸载，不再作为本机可运行 Harness。

用户要求在 Pi 配置之后提醒继续安装 codexhost；实际源码版已经安装并启动，因此不重复克隆、覆盖本地 czz-dev 或再次重启。本次是用户明确授权后的单次 Desktop 切换，不创建定时、循环或登录自启任务。

## A-4 OMP 初始安装边界（已由 A-5 取代）

OMP 位于 `/Users/gdkmjd/.local/bin/omp`。默认/轻量/深度/规划角色分别使用 `openai-codex/gpt-5.6-sol`、`gpt-5.6-luna:medium`、Sol `max`、Sol `xhigh`，默认 Thinking 为 `high`，工具审批为 `write`。排除 API key 与上下文加载的无工具、无会话最小调用通过；当前 Desktop PID 53781 未因安装 OMP 重启。

OMP 的 `xai-oauth` 在官方授权完成后仍卡在 18.0.11 的设备令牌轮询，最终 provider 未认证。不要复制 `~/.pi` 的 xAI 凭据、读取 OMP 数据库/日志正文或继续自动重试；Pi 的 Grok 通路保持已验证状态。OAuth 前备份位于 `/Users/gdkmjd/.omp/backups/20260901-080843-codexhost-subscriptions/`。

## 恢复工作时

先读 [Spec](spec.md)、[核验](verify.md) 与 [执行记录](tasks.md)，检查分支和工作区，再处理未通过的门禁。不要重复克隆、覆盖 dirty work、升级 Agent 或更换用户账号。外部会话原生标题、后续回合排队与 Steer 拒绝已在 `773290c` 提交并完成聚焦测试和全量构建。源码修改与生效需要分别确认；后续远端推送、远端默认分支变更是分开的动作。

最终安全回归结果已记入 verify.md；外部会话置顶已 Desktop 回测通过。剩余工作是按需验收具体 Agent 选择、审批、真实委派，以及标题同步/steer/未读的独立 UI；不再为置顶重复安装或重启。

## A-5 OMP 多订阅路由与当前运行态

用户纠正的目标是“Codex/Claude 负责编排、规划和核验，Grok 负责实际执行”。当前 `modelRoles`：default=Codex Sol xhigh，plan=Claude Fable xhigh，slow=Codex Sol max，advisor=Codex Sol xhigh，task/smol=Grok 4.6 xhigh；Advisor 未启用。模型隐藏只影响 Renderer 可见列表和新任务显式主模型，不会禁用 OMP 内部角色。

`czz-dev` 已把 OMP 普通 create/resume/fork 默认权限收紧到 `write`，并把 macOS runtime descriptor 新建文件收紧到 `0600`。OMP Adapter 26 项测试和 Rust 聚焦权限测试通过；A-5 早期全工作区构建被并行 Renderer Models 页面类型改动阻断，待并行 owner 完成后最终 `npm run build` 已全量通过。构建不会热替换当前 Desktop。

A-5 当时源码 Launcher PID 29444、Desktop PID 29446，descriptor 为 schema-valid 普通文件、`0600`。最新回执 `/Users/gdkmjd/.local/state/codexhost/restarts/01a055a0-cc69-7d41-8896-ae5fd7522fed-omp-v2/receipt.json` 为 `source_launch_verified_after_live_recheck`；自动 OMP 校验的早期瞬态失败保留在嵌套记录，随后 live refresh 与 doctor 确认 OMP ready、43 模型、Sol xhigh、permission write。

## A-7 卸载 Oh My Pi

用户于 2026-09-01 要求卸载 Oh My Pi、中断进行中任务、保留源码。OMP RPC 进程组已结束；`~/.local/bin/omp` 与 `~/.omp` 已删除。doctor 回读 `notInstalled`。Pi 与 Adapter 源码保留；Desktop 未因卸载重启；未提交或推送。

## U11 外部会话置顶回测

用户确认当前源码 Desktop 上外部会话置顶不再弹回。实现提交 `f21d2b7`。回测时源码 Launcher PID 82349；mapping-store 两条 Grok 外部会话位于 pinned section `01984de2-8f74-7c91-a3b2-5c5e937cf318`。标题同步、steer、未读仍按独立 UI 验收。未 push。
