# czz-dev 本机接入与开发说明

日期：2026-08-31。上游基线：`v0.4.0 / dea7498527b47eac4e12e977569588230d065a97`。

这是 CzzRef fork 的本地源码版，不是 npm 上游发行版。它可以在 codexhost 接管启动的 Codex Desktop 中选择其他 Harness，也可以通过 Host 委派接口调用其他 Harness。**一次性正常重启已完成，当前 Desktop 由本地 `czz-dev` 源码启动；回执、源码 Launcher、Host runtime、controller 与 descriptor 均已核对，用户确认已经接入。**

## 源码与安装位置

| 项目 | 本机值 |
|---|---|
| 源码 | `/Users/gdkmjd/work/czz/GitFork/codex-host` |
| 当前开发分支 | `czz-dev` |
| origin | `git@github.com:CzzRef/codex-host.git` |
| upstream | `https://github.com/BytePioneer-AI/codex-host.git` |
| 命令入口 | `/Users/gdkmjd/.local/bin/codexhost`，绑定此源码及安装时的 Node |
| Node | `/Users/gdkmjd/.nvm/versions/node/v24.14.0/bin/node` |
| 编译产物 | `target/debug/` 与各 `packages/*/dist/` |

完整 Git 历史已下载。Cursor、Host、Renderer、外部线程、OMP、源码启动保护、构建配置、首轮文档、预览格式和外部会话交互已在本地 `czz-dev` 分为十一批提交，本文所在提交完成最终文档收口；远端尚未推送，GitHub 默认分支仍为 `main`。后续远端推送和远端默认分支切换仍是分开的动作。

没有覆盖 `/Applications/ChatGPT.app`，没有改写现有 Codex 配置，也没有将其他 CLI 的密钥、OAuth 凭据或会话数据库复制给 Pi。Pi 订阅续作仅通过它自己的 OAuth 保存独立凭据。

## 本机 Agent 核验

| Harness | 使用的本机入口 | 当前证据与限制 |
|---|---|---|
| Claude Code | `~/.nvm/versions/node/v24.14.0/bin/claude` | 检出 5 个模型；Haiku/default 权限模式真实返回校验文本；原生 Turn identity、历史读取与恢复通过。 |
| Grok | `~/.grok/bin/grok` | 检出 2 个模型；ask 模式真实返回校验文本；原生 Turn identity、历史读取与恢复通过。 |
| Cursor | `~/.local/bin/cursor-agent` | 新增 ACP Adapter；ask 模式、GPT-5.4 Mini 真实返回校验文本；仅当前 Host 进程保留可读历史。 |
| DeepSeek Harness | 本机现有 `dsh` / Host | 检出 10 个模型；本次只验证发现与 inspection，未发送模型任务。 |
| Pi | 本机现有 `pi` | 0.84.3；Codex/Grok 独立订阅 OAuth 均已接入，gpt-5.6-sol 与 grok-4.6 原生 CLI 实测通过；默认仍为 `openai-codex/gpt-5.6-sol`，doctor 为 ready、11 个模型。Claude 额外付费未启用。 |
| OMP | `~/.local/bin/omp` | 官方 18.0.11 arm64；Codex Sol 最小调用通过；当前 43 模型目录含 Codex Sol、Grok 4.6、Claude Fable。角色路由为 Codex 顶层编排/核验、Claude 规划、Grok 执行；`anthropic/claude-fable-5` 与 `xai-oauth/grok-4.6` 已各通过一次隔离最小真实调用（`--no-session --no-tools`，低思考档）。 |

“CLI 可执行、inspection 就绪、真实回答、原生历史恢复、Desktop 界面验收”是不同层次。这里的真实调用发生在独立临时目录和本次创建的原生 Session 中；没有运行现有 Codex 任务。Desktop 已由源码激活，但 Agent 选择器、审批弹窗与实际跨 Agent 委派仍需独立验收。

## Pi 订阅续作

Pi 使用独立 OAuth 接入本机同一 ChatGPT Pro 账号和工作空间；只修正 `~/.pi/agent/settings.json` 的默认提供方，保留原 `gpt-5.6-sol` 模型。`~/.pi/agent/auth.json` 当前保存 Pi 自己的 `openai-codex` 与 `xai` OAuth，权限为 `0600`。初始备份位于 `~/.pi/agent/backups/20260831-150244-codexhost-subscriptions/`；新增 Grok 前另备份于 `~/.pi/agent/backups/20260831-153938-xai-subscription/`。

Pi 官方支持 xAI 的 Grok/X 订阅登录；用户完成二次验证后，已用与原 Grok CLI 相同的账号重新完成独立 OAuth，排除 API key 的 Pi 原生 grok-4.6 调用通过，没有复制 CLI 刷新令牌。Pi 可选目录为 Codex 7 个、Grok 4 个，合计 11 个模型。Pi 的 Claude Pro/Max 登录依其官方说明走额外按量计费，本次不启用；原生 Claude Code Max 通路继续保留。来源：[Pi Providers](https://pi.dev/docs/latest/providers)。

Codex/Grok 原生登录文件内容前后相同，Claude Max 保持登录。A-2 的 Pi 配置没有重启当时 PID 84891；A-3 首次切换到源码 PID 53779/53781，A-5 第二次正常激活后的当前 Launcher PID 29444、Desktop PID 29446。Pi CLI 核验禁用工具、扩展、技能、上下文文件与会话保存；Codex 测试使用保存的默认配置，Grok 测试显式选择 xai/grok-4.6 且未改变默认设置。模型目录不等于逐模型调用通过；Pi 历史、Fork、rollback 与 Desktop 委派均未实测。

## OMP 续作

OMP 18.0.11 通过官方 macOS arm64 Release 安装到 `~/.local/bin/omp`；本地 SHA-256 `88b4a3e68e19904b8fcc1ba4b319ef68795f4fe06a6d101d564fc482cb0cc252` 与 Release digest 相同。本机 Bun 1.3.11 低于 OMP 包声明的要求，因此没有升级或使用 Bun 安装路径。

当前 OMP 角色路由：

```yaml
modelRoles:
  default: openai-codex/gpt-5.6-sol:xhigh
  task: xai-oauth/grok-4.6:xhigh
  smol: xai-oauth/grok-4.6:xhigh
  slow: openai-codex/gpt-5.6-sol:max
  plan: anthropic/claude-fable-5:xhigh
  advisor: openai-codex/gpt-5.6-sol:xhigh
```

`advisor.enabled=false`，所以顶层编排/核验使用 Codex、规划使用 Claude、执行型 task/smol 使用 Grok，但不会自动产生逐轮 Advisor 调用。`tools.approvalMode=write`；本分支 OMP Adapter 对普通 create、resume、fork 也默认传 `write`，显式 unattended full access 才映射 `yolo`。

Host refresh 与 doctor 读回 OMP `ready`、43 个模型、默认 `openai-codex/gpt-5.6-sol:xhigh`、权限 `write`。OMP 内 Codex Sol、`anthropic/claude-fable-5`、`xai-oauth/grok-4.6` 各通过一次隔离最小真实调用（后两者在临时目录、`--no-session --no-tools --no-extensions --no-skills --no-rules`、低思考档下返回校验文本）；其余模型仍只是目录读回。初始 OAuth 前备份位于 `~/.omp/backups/20260901-080843-codexhost-subscriptions/`，角色调整前备份位于 `~/.omp/backups/20260901-0849-role-routing/`，敏感目录/文件保持 `0700/0600`。

Codex 的模型隐藏设置只维护 Renderer 的可见 deny-list，不会禁止 OMP 按 `modelRoles` 使用隐藏模型；但若隐藏 OMP 默认模型，新建 UI 任务会把第一个仍可见模型作为该任务的显式主模型。要禁止模型实际被调用，应修改 OMP 角色或禁用 Provider。

## 外部会话的 sidechat 修复

Codex Desktop 的 side chat 在协议层是「`thread/fork`（带 `ephemeral`、`sideConversation` 等参数）+ 紧随其后的 `thread/inject_items`（注入边界条目）」。此前 `thread/inject_items` 不在 Host 的外部线程显式方法集合里，被 `-32076` 拒绝，因此**所有外部 Harness 会话**（Claude Code / Grok / Pi / OMP / DSH）都打不开 side chat；原生 Codex 会话不受影响。

2026-09-01 修复：`thread/inject_items` 进入显式集合，外部线程校验 `items` 为数组后以空结果确认。外部 Fork 派生的原生 Session 本就携带完整父上下文，注入的 Codex 边界条目没有原生表示，因此不投影进外部历史、不转发官方 app-server、不发给 Harness；契约见 [external-thread-fork-routing](../openspec/specs/external-thread-fork-routing/spec.md)。该修复需要在下一次正常退出后经 `codexhost launch` 重启 Desktop 才生效。

已知边界：Cursor 会话仍无法打开 side chat——其历史为 `live-only` 且 `fork: false`，fork 会先被 `-32076` 拒绝，这是 Cursor 缺稳定 checkpoint API 的既有能力限制，不是本次回归。若外部会话最后一轮缺 `nativeCheckpointRef`（如 mapping-store 写入失败），fork 仍会以 `-32080` 显式失败。

## 外部会话的 Pin、标题同步与排队消息（2026-09-01）

三个修复都在 Host/Adapter 层，需要下一次正常退出后经 `codexhost launch` 重启 Desktop 生效：

- **Pin**：此前外部会话的 `thread/metadata/update`（isPinned）一律回 `-32078`，且外部行被排除在「已固定」列表之外。现在 pin 状态持久化到 mapping-store（`pinned` 字段），投影与 `thread/list` 的 `isPinned` 过滤按持久化状态生效；gitInfo 等其余元数据仍显式关闭。契约：[external-thread-list-archive-routing](../openspec/specs/external-thread-list-archive-routing/spec.md)。
- **标题同步**：外部线程的名字此前只在创建时由 Desktop 兜底写入（首条消息截断），原生会话改名后不同步。现在 Adapter 把原生标题放进 `session.state.changed`（`HarnessSessionState.nativeTitle`），Host 持久化（`titleSource: native`）并发 `thread/name/updated`。来源：Claude Code 用 SDK sessionInfo 的 `customTitle ?? summary`（每轮结束轮询）；Grok 读 `summary.json` 的 `session_summary` + `title_is_manual`（每轮结束）；OMP 取会话文件最后一条 `type:"title"` 记录（轮次落盘识别时）；DSH 处理 `session/title` 事件（实时推送）。Pi 额外进程走委派 CLI `codexhost thread rename`（`/v1/thread/rename`），同一条 `thread/name/updated` 通知 Desktop；Cursor 仍无原生标题。归属规则：原生 user 改名总是覆盖；generated 标题只覆盖空名、原生已接管的名字或首条消息兜底名，不覆盖用户在 Desktop 里改出的自定义名。契约：[versioned-renderer-agent-routing](../openspec/specs/versioned-renderer-agent-routing/spec.md)。
- **排队消息**：Desktop 会把 `turn/start` 的任何拒绝标成永久 paused 的红色芯片；运行中点 Retry/Steer 实际发 `turn/steer`，而旧闸门只拦 `thread/*` 前缀，`turn/steer` 带外部线程 ID 会静默漏给官方 app-server。现在活动轮次内的 `turn/start` 由 Host 入队（上限 8 条，延迟应答，轮次完成后按序真正启动；中断轮次后按原生语义丢弃并显式报错，会话故障/删除同样显式清空），`turn/steer` 等其余 `turn/*` 方法对外部线程显式回 `-32076` 不再漏发。真正的轮内 steering（Claude SDK 的 PushableInput 可行）留作后续能力。契约：[registered-harness-routing](../openspec/specs/registered-harness-routing/spec.md)。

## 安全入口与常用命令

```bash
cd /Users/gdkmjd/work/czz/GitFork/codex-host
codexhost --help
codexhost inspect
codexhost doctor
codexhost build
```

`inspect` 只读取 Codex 安装与进程信息。`doctor` 检查本地 Harness，不发送模型提示词、不创建 Cursor Session；Cursor 的冷启动 inspection 因此不会虚构模型目录。`build` 只编译，不启动或停止 Desktop。

安装/修复入口：

```bash
npm ci
npm run build
npm run install:source
```

安装器只写入本任务自己的命令入口；如果同名文件不是当前安装器生成的内容，会保留原文件并报错。Node 路径改变时，需要核对旧入口后重新安装，不能直接覆盖未知文件。

当前源码 Desktop 正在运行，不要再次执行启动命令。后续源码升级或切回时，先取得对应授权并正常退出 Codex，再执行：

```bash
codexhost launch
```

`npm start` 也走这个安全入口。先验证本机入口确实指向当前源码，再检查 Desktop；检测到 Codex 仍在运行或无法可靠检查进程时直接拒绝。源码入口设置 `CODEXHOST_REFUSE_RUNNING_DESKTOP=1`，Rust 在取得启动锁前和启动状态处理前再次检查；锁被占用或存在 runtime descriptor（包括过期记录）也会拒绝，不进入 attach、强制退出或旧实例清理。过期记录需要后续人工核对，不自动删除。没有后台重启或定时重试。

2026-09-01 用户授权的两次正常激活均已完成。最新回执位于 `/Users/gdkmjd/.local/state/codexhost/restarts/01a055a0-cc69-7d41-8896-ae5fd7522fed-omp-v2/receipt.json`，状态为 `source_launch_verified_after_live_recheck`；当前源码 Launcher PID 29444、Desktop PID 29446，Host runtime/controller/Renderer 与源码命令匹配，runtime descriptor 为 schema-valid 普通文件且权限 `0600`。自动脚本早期的 OMP 目录瞬态失败保留在回执中，随后现场 refresh 与 doctor 复核通过；未使用 force terminate、kill、旧 descriptor 清理或自动重试。后续更新仍要重新遵守正常退出和单实例门禁。

不要运行旧开发脚本 `tools/dev-desktop/run.mjs`：上游脚本包含主动停止现有 Desktop 的行为。本分支的默认 `npm start` 已不调用它。

源码入口设置 `CODEXHOST_DISABLE_UPDATES=1`；Host 不准备自动更新，Launcher 不启动待应用的更新，也不因更新停止 Desktop。后续更新必须在本地审阅、合并和重新构建；不要用 `npx @codexhost/cli` 代替本入口，否则运行的可能是上游包。

## Cursor 的明确能力边界

本机 Cursor CLI 版本为 `2026.05.05-84a231c`。公开 ACP 的 initialize、newSession、prompt、cancel、set_config_option 可用；原生 `session/load` 能载入上下文，但实测没有回放历史，也没有返回稳定的 NativeTurn identity。因此没有解析私有 `store.db`、没有复制转录，更没有用随机 ID 冒充原生 Turn。

本分支新增 `capabilities.history.transcript`：省略或 `native` 保留原有严格历史合同；Cursor 显式报告 `live-only`。

- 当前 Host 运行期间可连续对话、流式显示文本/推理/工具、处理审批与问题、读取当前任务投影。
- Host 退出后，原记录仍保留外部归属，但恢复明确返回 unsupported；不回退到 Codex，不创建空会话冒充恢复。
- Cursor 不支持本分支里的 Fork、Rollback、持久化历史回放、独立 Thinking 选项或 Usage 计量。
- Cursor 第一个真实 Session 创建后，才从原生 configOptions 得到当前账号的模型/模式目录；初次选择时先使用 Cursor 原生默认模型。原生模型里的 reasoning/effort 参数作为完整模型 ID 保留。
- 使用专用 `cursor-agent`，绝不把通用 `agent` 当作 Cursor：本机该名称实际属于 Grok。
- 不自动调用 authenticate 或打开登录浏览器；登录缺失时提示用户通过 Cursor CLI 登录。
- 不加 `--force`、`--trust` 或关闭 sandbox 的参数；原生权限请求、问答、计划审批通过 Host 显式处理。

该适配是受限接入，不能声称已经具备与 Claude/Grok 相同的持久化能力。未来如果 Cursor 发布稳定的 transcript/replay API，应据原生 identity 升级 Adapter，而不是建立第二份 Host 历史存储。

## 在 Codex 里调用

当前源码 Host 中可以选择对应 Agent，或在支持委派的任务里要求当前 Agent 把独立工作交给 `@claude-code`、`@grok`、`@cursor`、`@pi`、`@omp`。Host 内的 CLI 示例：

```bash
codexhost delegate --help
codexhost harness inspect cursor
codexhost harness inspect omp
codexhost delegate start --harness cursor --task "检查当前改动的边界风险"
```

这些委派命令需要当前 codexhost Host 注入的 Runtime endpoint/token/thread 环境；`delegate start` 使用调用方当前工作目录。安装命令本身不意味着普通 Shell 已经连接到当前 Codex。不要把 token 写进仓库或复制到文档。

本分支委派默认使用原生 `default` 执行策略，不再强制 `unattended-full-access`；委派给原生 Codex 也不再覆盖其审批和 sandbox 设置。因此任务可能等待用户审批。发起方使用不能访问 loopback 的沙箱时仍可能报 `RUNTIME_UNREACHABLE`，不会静默扩大权限。

## 后续优化与回退

新增 Cursor 的主要代码在 `packages/adapters/cursor/`；共享能力在 `packages/shared-contracts/`；Host 注册/投影在 `packages/host-runtime/`；界面入口在 `packages/renderer-extension/`。修改后运行 `codexhost build`，再在用户安排的正常退出时机启动新版本。构建成功不会热替换现有 Codex 进程。

同步上游前先检查本地改动，只 fetch 不会改变工作区：

```bash
git status --short --branch
git fetch upstream
git log --oneline --left-right czz-dev...upstream/main
```

本次已完成本地分批提交，但未 push；本文所在收口提交完成后，GitFork 工作区应无未提交改动。不要执行 `reset --hard` 或直接切回 main。先审查本地提交，再决定 merge/rebase 或推送；远端默认分支另行处理。

回退到普通 Codex 时，正常退出将来由 codexhost 管理的那次 Desktop，然后从原有 `/Applications/ChatGPT.app` 启动。若要卸载，先核对 `~/.local/bin/codexhost` 是本任务生成的入口，再移除该入口即可；源码、Agent 登录、原生历史和原应用都不需要删除。

## 验收资料

[任务规格](tasks/260831-czz-dev-integration/spec.md)、[验证记录](tasks/260831-czz-dev-integration/verify.md)、[后续接手](tasks/260831-czz-dev-integration/handoff.md)。Cursor 官方协议说明见 [Cursor ACP](https://cursor.com/docs/cli/acp)；支持边界以本机实测及本分支代码为准。
