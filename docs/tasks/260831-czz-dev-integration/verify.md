# 核验记录

日期：2026-08-31，续作至 2026-09-01。源码安装、一次性正常重启和 Host runtime 身份核验通过；用户确认已经接入。具体 Agent 选择、审批 UI 与真实跨 Agent 委派仍不由编译、回执、doctor 或外部 CLI 回答替代。

## 本机交付

| 项目 | 证据 | 边界 |
|---|---|---|
| Fork 源码 | GitFork/codex-host 完整克隆，基线 dea7498527b47eac4e12e977569588230d065a97 | origin=CzzRef；upstream=BytePioneer-AI |
| 开发分支 | 当前 czz-dev | 本地改动未 stage/commit/push；远端默认仍 main |
| 依赖 | npm ci；新增 Cursor workspace link | 没有升级全局 Agent 或现有依赖版本 |
| 源码入口 | ~/.local/bin/codexhost 受管可执行 wrapper | 指向本地 Node 和本 fork，不是 npm 上游发行版 |
| 入口核验 | 已安装入口的 help、inspect、delegate help、doctor 结果就绪 | 指向当前 `czz-dev`，不是 npm 上游包 |
| 当前 Codex | `/Applications/ChatGPT.app` 26.825.51511 / build 7377，由源码 Launcher PID 29444 启动；Desktop PID 29446 | 没有覆盖或升级应用包；后续版本切换仍须正常退出和单实例门禁 |
| A-3 正常重启 | 用户已授权；重启前仅本任务 active；完整重建通过；一次性回执为 `source_launch_verified`；Launcher、Host runtime、controller、descriptor 与源码匹配 | 用户确认已经接入；Agent 选择、审批 UI 与真实委派仍为独立验收项 |

## Agent 分层核验

| Harness | Discovery / inspection | 本次真实 Session | 历史与恢复 |
|---|---|---|---|
| Claude Code | 就绪，5 个模型 | 独立临时目录，Haiku/default，预期校验文本通过，未请求工具审批 | 稳定 NativeTurnRef、1 个历史 Turn、重开后同一历史通过 |
| Grok | 就绪，2 个模型 | 独立临时目录，grok-4.6/ask，预期校验文本通过，未请求工具审批 | 稳定 NativeTurnRef、1 个历史 Turn、重开后同一历史通过 |
| Cursor | 专用 cursor-agent；已有登录；ACP v1；冷 inspection 不创建 Session、不伪造模型列表 | 独立临时目录，GPT-5.4 Mini/ask，预期校验文本通过，未请求工具审批；无需 authenticate | 公开 load 未回放历史，无稳定 NativeTurnRef；Adapter 显式 live-only，readSnapshot/resume/Fork/rollback unsupported |
| DSH | 就绪，10 个模型 | 未发送任务 | 未实测 |
| Pi | CLI 0.84.3；doctor 为 ready、11 个模型（Codex 7、Grok 4） | openai-codex/gpt-5.6-sol 模型层及默认设置的原生 CLI 请求通过；xai/grok-4.6 原生 CLI 请求通过且排除 API key；均无工具、无上下文文件、无保存会话 | 历史、Fork、rollback 与其余模型未实测；默认仍是 Codex；Claude 额外计费未启用 |
| OMP | 18.0.11；doctor 为 ready、43 个模型；Codex/Grok/Claude 所需模型均可发现 | 默认 Codex Sol 的无工具、无上下文、无会话最小调用返回精确标记，约 4.5 秒；Grok/Claude 本轮只做目录和路由读回 | Host 报告 native history、跨目录 Fork、rollback；实际角色触发、Grok/Claude 调用和这些历史能力未实测 |

Claude 初次 plan 模式虽到达原生 terminal，但没有返回预期校验文本，因此不计作内容验收；后续 default 模式的独立校验通过。原生状态、内容正确性与历史恢复分开记录。

所有真实核验只使用本次创建的临时工作目录与原生 Session。未复用现有工作 Session，未向已有 Codex 任务发送指令，未展示或复制凭据。原生 CLI 自己保留本次正常 Session 记录；本仓库不保存原始转录或运行日志。

## Pi 订阅配置续作

- Pi 独立 OAuth 使用与原 Codex 一致的 ChatGPT Pro 账号和工作空间；未开启设备代码授权安全选项，改用浏览器 OAuth 完成。默认配置为 `openai-codex/gpt-5.6-sol`，Pi 凭据文件权限 `0600`，原配置有 `0700` 目录内的 `0600` 备份。
- 模型层最小请求返回预期校验结果，共 37 tokens；原生 Pi CLI 无 provider/model 覆盖时也通过，退出码 0、无 stderr。没有启用工具、扩展、技能、上下文文件或会话保存，也没有复用当前工作任务。
- Grok 首次授权因二次验证与轮询网络失败未完成；用户确认已授权后，同账号重新完成 Pi 独立 OAuth，xai 凭据保存成功。Pi 原生 grok-4.6 请求通过，约 2.2 秒、退出码 0、无 stderr；测试排除 API key 环境变量，禁用工具与上下文加载，默认设置未变。完成页面和凭据保存均核对后关闭浏览器任务空间，没有复制 CLI 凭据或绕过二次验证。
- Claude Max 原生登录有效；Pi 官方声明其 Claude 第三方 Harness 登录计入额外按量使用，本次未启用。原生 Claude Code / Agent SDK 与 Pi 直连的计费说明分开处理。
- Codex/Grok 原生登录文件内容前后相同；A-2 的订阅配置完成时 Desktop 根进程仍为 84891，订阅配置本身没有重启 Codex。后续 A-3 的一次正常重启由用户单独授权并已完成。
- 续作的 14 份 Markdown 共 238 个本地链接及行范围通过；两个仓库的代码路径引用核验和任务改动空白检查通过。CodeNote 项目状态只更新本任务行，其他并行改动保留。

## 源码与协议检查

| 检查 | 结果 | 覆盖范围 |
|---|---|---|
| TypeScript + Renderer + Rust 完整构建 | 通过，包含最终启动保护补丁 | 构建产物与原 Desktop 激活不同 |
| 聚焦 TypeScript/工具测试 | 15 个文件、245 项通过 | Cursor、carrier、Host lifecycle/delegation、Renderer 注册、源码入口保护；含同进程两轮对话/读取与重启后拒绝恢复 |
| Rust source launch guard | 3 项通过 | 已有 Desktop、stale/active descriptor、clean start、无 flag 的上游策略；不运行真实 launch |
| 类型检查 | 通过 | 全部 TypeScript package 及测试类型 |
| 局部 lint 与代码边界 | 40 个任务代码文件 lint 通过；boundary audit 通过 | 不改无关代码 |
| 格式与文档链接 | Prettier、Rust 格式、diff whitespace 通过；18 份任务 Markdown 的 62 个本地链接与源码行号范围通过 | 仅任务写集 |
| Host 发布 bundle 审计 | 通过 | 本地 bundle 构建，无发布或推送 |
| 双层拒绝保护 | 真实只读 PID 检查、合成 guard、Rust 状态回归通过 | 不通过运行 launch 验证；底层竞态和锁分支另经只读审查 |
| 第二次源码启动回执 | `source_launch_verified_after_live_recheck`；Launcher PID 29444、Desktop PID 29446、Host runtime/controller/Renderer 匹配，descriptor `0600` | 自动 OMP 校验曾瞬态失败并被保留；现场 refresh 与 doctor 复核通过，仍不证明真实委派 |
| OMP 安装、角色与 Adapter | Release digest、arm64 文件、Codex 最小调用、43 模型目录、最终角色读回、默认 `write` 与 26 项 Adapter 测试通过 | OMP 内 Grok/Claude 实际调用、角色触发、历史/Fork/rollback 未逐项运行 |

全仓测试、完整 Rust 测试集、Windows/Linux、远程 SSH Harness、Desktop Agent 选择器逐项检查、审批 UI、当前 Codex 内真实委派和热恢复未运行。核验范围按 [Verification Impact Trace](plan.md) 选择。

## OMP 续作核验

- 官方 `v18.0.11` macOS arm64 发布件安装到 `~/.local/bin/omp`；本地 SHA-256 与 Release digest 一致，本机 Bun 1.3.11 未升级。
- 当前 43 模型目录含 `openai-codex/gpt-5.6-sol`、`xai-oauth/grok-4.6`、`anthropic/claude-fable-5`。用户要求的角色读回为：default=Codex Sol xhigh，plan=Claude Fable xhigh，slow=Codex Sol max，advisor=Codex Sol xhigh，task/smol=Grok 4.6 xhigh；Advisor 保持 disabled。
- OMP Adapter 普通 create、resume、fork 的默认权限已从 `yolo` 改为 `write`，显式 unattended full access 仍保留；独立构建、26 项测试、lint 和格式检查通过。
- macOS runtime descriptor 的新建临时文件使用 `0600`，新建 launcher guard 也使用私有模式；聚焦 Rust 测试和 Launcher 构建通过。当前 descriptor 实测为普通文件、schema valid、`0600`。
- 第二次正常激活后的源码 Launcher PID 29444、Desktop PID 29446。一次性脚本的 OMP 早期目录判断曾超时，原始失败码保留；随后相同 live Host 的 refresh 与 doctor 读回 OMP ready、43 模型、Sol xhigh、permission write，整体回执更新为 live-recheck verified。
- 全工作区构建在 A-5 早期被并行的 Renderer Models 页面类型改动阻断，本任务没有修改该写集；并行 owner 完成后再次执行 `npm run build`，TypeScript、Renderer 四个 bundle 与全部 Rust 包通过。构建不等于当前进程热替换，运行态证据仍来自第二次激活。
- `~/.omp` 敏感目录/文件保持 `0700/0600`。初始 OAuth 前备份在 `~/.omp/backups/20260901-080843-codexhost-subscriptions/`，角色变更前配置备份在 `~/.omp/backups/20260901-0849-role-routing/`；没有打开日志或数据库正文。

## 剩余运行态验收项

第二次源码启动、进程身份、descriptor 0600 与 OMP 角色目录已经通过。后续按需检查 Agent 选择、显式审批、真实跨 Agent 委派、OMP 是否实际以 Claude 规划/Codex 核验/Grok 执行，以及 Cursor live-only 与重启后明确失败的行为。模型隐藏不是禁用；真正禁止调用需调整 OMP 角色或禁用 Provider。
