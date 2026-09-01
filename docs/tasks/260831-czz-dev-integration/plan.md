# 实施计划与 Verification Impact Trace

执行：Root 唯一写入者；两个限定只读调查单元；预算 U，深度 1。

## 步骤

1. 新克隆与 czz-dev 分支；本机路径发现，读取项目 Adapter 合同。
2. Cursor 原生 ACP 能力、会话与历史证据；独立 Adapter 实现，配置与产品注册。
3. 构建源码并安装用户级安全入口；本机 Agent inspection 与限定合成会话验证。
4. 完成当前文档、变更和恢复说明；桌面切换等待用户后续回复。
5. 用户授权续作：核查 Pi 订阅支持与计费，备份配置，独立 OAuth，验证保存的默认模型与 Host 发现；Grok 二次验证需要用户完成，Claude 额外计费不自动启用。

## 核验影响分析

| 变化面 | 直接消费者与传播边界 | 最小核验 | 排除或停止条件 |
|---|---|---|---|
| Cursor command/ACP | 本机进程、协议握手、错误与有界关闭 | 专用命令发现、initialize、transport fixtures | 不读取其他会话、不升级 CLI、不改登录 |
| Cursor Session | create、native Session identity、stream、approval、cancel、live-only projection | Adapter/交互聚焦测试、独立真实回答；同进程连续对话/读取与重启后拒绝恢复 | 没有 native Turn/replay，故不支持持久化；不以随机或位置 ID 伪造恢复 |
| Harness 注册与 carrier | protocol-core、Host、Renderer、Desktop Control | 路由往返、坏 token、选择与恢复、受影响包类型检查 | 不更改其他 Harness 原生协议 |
| 源码安装与启动 | TS/Rust/Renderer bundle、用户级入口 | 构建、入口 help/inspect、纯启动保护测试与 Rust 状态测试 | 不执行任何 launch；不接管、不清理旧 Runtime、不杀进程、不重启 |
| 本机既有 Agent | Claude/Grok/Pi/DSH 原有 Adapter | 各自安装与 Model inspection；只在必要范围使用合成任务 | 不复制或展示账户凭据，不把目录可读当作模型成功 |
| Pi 订阅续作 | Pi 私有凭据与默认模型、本机 Pi Adapter | 同账号/工作空间匹配；独立 OAuth；模型层及无模型覆盖的 Pi CLI 请求；只读 doctor | 不碰原生 CLI 凭据、不启用额外付费；二次验证交给用户，失败轮询结束后重新授权；不启动 Desktop |
| 文档 | 当前接入说明、发现说明、开发入口与任务记录 | 本轮链接、限定 diff、运行态边界 | 不更新全局规则或个人记忆 |

全仓测试不是默认门禁。新增 Adapter 影响公共路由与产品组合，因此检查对应消费者；只有聚焦失败证明遗漏依赖时才扩展。

## Authority Packet 与决策

- 权威：仓库 AGENTS、docs/index、术语表、codexhost-add-harness Skill 与公共 Harness/Session 类型。
- prior-task-overlap：研究结论复用为版本基线，本次只做安装和 Cursor 接入增量；历史分析不冒充本机运行验收。
- document_impact：project-current + canonical；Root 同步当前能力、发现与启动说明、live-only 公共合同和默认委派权限合同。历史上游研究保持其时间快照。
- ACP 共享层暂不抽取；先验证第二个真实 Adapter 的语义差异，避免改变已工作的 Grok。
- 最终只读安全复核的两个发现均接受：底层竞态路径必须拒绝已有 Desktop/Runtime，launch 前必须确认源码 CLI wrapper 正确且可执行。Root 独占修复与核验。
