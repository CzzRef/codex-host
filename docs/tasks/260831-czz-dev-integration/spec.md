# czz-dev 本机安装与 Cursor 接入

日期：2026-08-31，续作至 2026-09-01；状态：源码安装、限定核验、正常激活与本地分批提交完成；外部会话置顶已 Desktop 回测通过；未推送。决定来源：explicit-current-request。

## 目标与授权

- 将 CzzRef/codex-host 放入现有 GitFork 目录，以 czz-dev 作为本地开发分支，保留 origin 与 upstream 的区别。
- 安装可供后续修改、重建的本地源码版，接入本机已经安装的 Claude Code、Grok、Cursor，以及已有的 Pi/DSH。
- Cursor 使用独立 HarnessAdapter，经官方 ACP 协议接入；不得用 Grok 的 agent 别名或模型名称冒充 Cursor。
- 复用现有登录与配置；不复制凭据，不安装未请求的新模型或账户，不扩大权限。
- 用户补充：不得中断任何当前 Codex 相关进程；需要重启时暂停，等待后续明确通知。不注入、关闭、重启当前桌面，不设置延时或自动重启。
- 初始授权不提交、不推送，不改变 GitHub 仓库设置；2026-09-01 用户另行授权将当前代码改动分批本地提交，但未授权 push，远端默认分支与本地当前开发分支继续分开记录。
- 后续明确授权：核查 Pi 对本机 Grok、Claude Code、Codex 订阅的支持，并直接配置可用的订阅通路；不把该请求推断为购买额外按量额度、绕过二次验证或允许重启。采用 Pi 原有 OAuth，不复制原生 CLI 的刷新令牌。

## 设计与边界

- 基线为上游 v0.4.0，提交 dea7498527b47eac4e12e977569588230d065a97。
- ACP 传输、Cursor 扩展、原生历史、模型和审批解释留在 Cursor 包内；Host 与 Renderer 继续消费公共协议。
- 新适配支持 create、文本流、工具状态、审批/问题、原生模型与模式选择、取消和有界关闭。调查确认 Cursor 没有可用的原生 Turn identity/replay，因此显式标记 `history.transcript=live-only`；跨进程 resume、原生快照、Fork、rollback、独立 Thinking 和 Usage 不支持。
- Host 当前进程读取既有实时投影，不新增历史存储，不制造 native identity；原生持久化 Adapter 的默认合同保持不变。
- 新启动入口必须拒绝在已有 Codex 桌面运行时启动，而不是执行上游开发启动脚本的强制进程清理。
- Rust 在取得启动锁前与状态处理前再次拒绝已有桌面/descriptor，锁被占用时不尝试 attach 或清理。源码入口禁用自动更新，只允许用户后续安排的正常退出与启动。
- 编译、协议握手、模型目录、原生会话和 Desktop UI 分层验收；用户后续明确允许正常重启，源码 Desktop 已激活，具体 UI 与真实委派仍待独立验收。

## 相关产物

- [计划与影响分析](plan.md)
- [执行记录](tasks.md)
- [核验](verify.md)
- [衔接](handoff.md)
- [变更清单](changes.md)
