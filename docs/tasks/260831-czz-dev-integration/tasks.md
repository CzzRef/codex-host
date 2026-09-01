# 执行记录

## Work Units

| 单元 | 范围 | 状态 |
|---|---|---|
| U1 | Cursor 本机接口与官方 ACP 文档，只读 | accepted-static |
| U2 | codexhost 公共合同、注册和核验边界，只读 | accepted-static |
| U3 | Root：Cursor 实现、产品接线、源码安装 | accepted-local；实现、配置与文档分批提交完成，未 push |
| U4 | Root：验证、文档与桌面切换 | 源码/CLI 核验 accepted-local；Desktop source-launch-verified；具体 UI/委派待逐项验收 |
| U5 | 用户授权续作：Pi 订阅核查与配置 | Codex/Grok accepted-local；11 个模型可选；Claude extra-usage 未启用 |
| U6 | 用户授权续作：Desktop 正常重启与源码激活 | source-launch-verified；用户确认已接入；Launcher/Host/controller/descriptor 匹配 |
| U7 | 用户授权续作：OMP 安装与订阅配置 | OMP 18.0.11 ready；Codex OAuth 与默认模型调用通过；初始 xAI 设备令牌轮询未闭环 |
| U8 | 用户授权续作：OMP 多订阅路由、默认权限与第二次激活 | 43 模型目录；Codex/Claude/Grok 角色读回；write/0600/live runtime 通过；真实角色委派待验收 |
| U9 | 用户授权续作：当前代码分批提交 | 十一批代码、配置、文档与格式提交完成；最终文档收口待本文提交，未 push |
| U10 | 用户授权续作：卸载 Oh My Pi 并中断进行中任务 | 产品已卸载；doctor `notInstalled`；Adapter 源码保留；未 push |

## Material Execution Journal

- 已克隆 origin=CzzRef/codex-host，创建本地 czz-dev，保留上游更新来源；工作开始基线干净。
- 两个只读单元完成；专用 explorer_terra 角色在当前宿主不可用，按编排 Skill 用 default/Terra/medium 执行同一只读合同，未启动写入代理。
- 初始发现时本机已有 Claude/Grok/Pi/DSH/Cursor，OMP 未在 PATH 中；后续 U7 已安装 OMP。Cursor 必须使用 cursor-agent，agent 当前属于 Grok。
- npm ci 已完成；Cursor initialize 确认 ACP v1、loadSession 能力；模型目录与已有登录状态可读，尚不代表真实任务和恢复通过。
- 用户补充不可中断 Codex 进程；立即收窄运行态核验，桌面启动、注入和重启全部暂缓。
- CodeNote 自动规则路由报告既有 owner 大小/注册图漂移；本轮不修改规则。任务直接使用明确的用户安装/源码授权和已读取工程、安全、核验 owner，不以机器路由生成新权限。
- Cursor 原生 Session 可用，但 load 没有历史回放与稳定 Turn identity；据此改为显式 live-only 能力，不解析私有数据库、不制造 transcript、不宣传持久化恢复。
- Root 完成独立 Cursor Adapter、共享 carrier、Host 产品注册与实时投影、Renderer 选择器和设置入口。保留 Grok/Claude 原有原生接口；共享 ACP 层不抽取。
- 三个独立 Agent 的真实短回答均通过。Claude 初次 plan 模式只到原生流程终态，未通过预期文本检查；改用原生 default 模式后返回预期文本。此处不把首次流程终态当作内容验收。
- 初始安装核验中，Grok 与 Claude 原生历史读取、恢复通过；Cursor 明确拒绝原生快照。Pi 当时模型目录为空且 native state 为 unknown，尚未更改账号或配置；后续用户授权的 Pi 接入见 U5。当时 DSH 仅 inspection、OMP 未安装；OMP 后续状态见 U7。
- 完成源码构建并安装用户级受管 wrapper，help、原生只读 inspect 和委派 help 成功；当前 Desktop 根进程仍为 84891，没有执行 launch。
- 最后只读复核发现 CLI 预检后的底层 Attach 仍可强制重启，以及未安装 wrapper 的启动路径。Root 接受两项发现：增加独立 source-refusal 开关、启动锁/descriptor 的保守拒绝及可执行入口核验，不触碰旧进程或旧状态。
- 文档同步覆盖当前接入说明、三语言入口提示、发现规则、共享 live-only 合同、委派默认权限、任务核验与衔接；不改个人记忆或全局规则。
- 最终构建、typecheck、40 文件 lint、boundary、Host bundle 与 245 项 TypeScript/工具测试、3 项 Rust guard 测试通过；只读复核接受两项安全修复。实际安装 wrapper 验证与只读 Desktop 拒绝 guard 通过，未运行 launch；最终 doctor 仍报告原 PID 84891。
- 用户随后授权 Pi 三家订阅核查与配置：确认 Pi 0.84.3 的 Codex/xAI 订阅 OAuth；Claude 的 Pi 路径涉及 extra usage，本轮不启用。既有只读单元补核 Pi 接口，Root 独占配置写入。
- 原 Pi 配置已备份；同一 ChatGPT Pro 账号及工作空间通过 Pi 独立 OAuth 接入。默认提供方由 mirasim 修正为 openai-codex，保留 gpt-5.6-sol；模型层和无 provider/model 覆盖的原生 Pi CLI 请求通过，后者禁用工具、扩展、技能、上下文与会话保存。
- Grok 首次浏览器授权匹配原 CLI，但需要用户完成二次验证；当时授权轮询发生网络失败，没有保存 xai 凭据，因此交接浏览器并等待用户确认。
- 用户确认已授权后，恢复原浏览器任务，重新发起 Pi 独立 OAuth；一次页面按钮提交未被接受，改用该页面的原生点击后完成授权，不对原因作源码级断言。xai 凭据保存、订阅识别和 Pi 原生 grok-4.6 调用均通过；排除 API key、工具与上下文加载，Codex 默认设置保留，浏览器任务空间已关闭。
- 最终只读 doctor 将 Pi 判为 ready、11 个模型（Codex 7、Grok 4）；Codex/Grok 原生登录文件内容前后相同，Claude Max 保持原通路；当前 Desktop PID 84891 保留。Pi 配置成功不代表其余模型、历史、Fork、rollback 或 Desktop 委派已经验收。
- 用户于 2026-09-01 允许继续并重启。只读预检确认只有本任务 active、旧 Desktop PID 84891、受管入口匹配、runtime descriptor/launcher guard 不存在；按当前 dirty tree 重跑 TypeScript、Renderer、Rust 完整构建通过。
- U6 的一次性恢复任务已正常完成，`0600` 结构化回执为 `source_launch_verified`；源码 Launcher PID 53779、Desktop PID 53781、Host runtime、controller 与 descriptor 匹配。没有执行强制停止、旧状态清理或循环重试；用户确认已接入，UI 逐项与真实委派仍是独立门禁。
- U7 从官方 Release 安装 OMP 18.0.11 arm64 到 `~/.local/bin/omp`，本地 SHA-256 与 Release digest 一致；本机 Bun 1.3.11 不满足包要求，因此未升级或使用 Bun 安装路径。OAuth 前创建 SQLite 恢复快照。
- OMP 通过自己的 OAuth 独立接入 OpenAI Codex；写入 Sol/Luna 模型角色、`high` Thinking 和 `write` 工具审批。排除 API key、工具、扩展、技能、规则、LSP、PTY 与会话保存的默认模型最小调用返回精确标记，约 4.5 秒。
- OMP 的 xAI 官方授权页面多次完成，但 18.0.11 的设备令牌轮询没有闭环，`xai-oauth` 最终仍未认证；停止重试，不复制 Pi 凭据。doctor 将 OMP 判为 ready、8 个模型；安装前后 Desktop PID 53781 未变化。
- U7 将 `~/.omp` 敏感目录/文件收口到 `0700/0600`，关闭浏览器任务空间；不保存 token、设备码、原始提示词、输出或转录，未提交或推送。

- 用户随后完成 OMP 的 Grok/Claude 接入并纠正角色目标：default=Codex Sol xhigh，plan=Claude Fable xhigh，slow/advisor=Codex Sol，task/smol=Grok 4.6 xhigh；Advisor 不启用。Host refresh/doctor 读回 43 个模型，实际 OMP 文本调用仍只验收 Codex Sol。
- U8 将 OMP Adapter 普通 create、resume、fork 默认权限从 yolo 收紧为 write；显式 unattended full access 保留。Adapter 独立构建、26 项测试、lint/格式检查通过。
- macOS runtime descriptor 新建文件与新建 guard 使用 0600；聚焦 Rust 权限测试和 Launcher 构建通过。A-5 全工作区构建早期被并行 Renderer Models 页面类型改动阻断，Root 保留其写集；并行 owner 完成后最终全量构建通过。
- 第二次正常激活后 Launcher PID 29444、Desktop PID 29446、descriptor 0600 与源码命令匹配。自动 OMP 校验早期曾瞬态失败，随后 live refresh 与 doctor 复核通过；回执同时保留初始失败和后续核验证据。未强制终止、清理 descriptor、读取数据库/日志正文或保存原始输出。
- U9 先将已验收源码分为 Cursor Adapter、Host/协议、Renderer、外部线程、OMP 权限和 Launcher 六批本地提交。并行 Claude Code 在其写集完成后另提交 Cursor 包清单、源码启动配置、首轮文档与预览格式四批；Root 复核后再提交外部会话原生标题同步、后续回合排队与 Steer 拒绝一批。最终 8 个文件、345 项聚焦测试和全量构建通过；远端未 push。
- U10：用户要求卸载 Oh My Pi、中断进行中任务、保留源码。对 OMP RPC 进程组 31083 SIGTERM 后删除 `~/.local/bin/omp` 与 `~/.omp`。doctor 回读 `notInstalled`；Pi 与本仓 Adapter 源码未动；Desktop 未重启；未提交、未推送。

## 用量

子单元 observed_model 与可比 Token 数据未提供：usage unavailable。不据模型选择推断节省。
