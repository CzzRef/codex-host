## ADDED Requirements

### Requirement: Desktop bypass 跟随进外部会话创建
当 Desktop `thread/start` 携带 approval policy `never` 与 `danger-full-access` Sandbox、且调用方未显式选择 Permission Mode 时，系统 SHALL 以 `executionPolicy: "unattended-full-access"` 创建外部 Harness Session。Adapter 拒绝该策略（`unsupported`）时系统 SHALL 以其原生默认策略重试创建，MUST NOT 因此使 Thread 创建失败。

#### Scenario: bypass 会话不再逐条审批
- **WHEN** Desktop 在 bypass 配置下新建外部 Harness 会话
- **THEN** 支持该策略的 Adapter SHALL 以 unattended full access 初始化其原生 Session

#### Scenario: 显式 Permission Mode 优先
- **WHEN** 调用方显式选择了 Permission Mode
- **THEN** 系统 MUST NOT 覆盖该选择注入 executionPolicy

#### Scenario: 不支持的 Adapter 回退
- **WHEN** Adapter 以 `unsupported` 拒绝 unattended full access
- **THEN** 创建 SHALL 以默认策略完成，权限语义保持该 Adapter 原生默认

### Requirement: 挂起审批以注意态暴露
系统 SHALL 在 `thread list` 外部行上以可选字段 `attention: "approval"` 暴露「当前 Turn 阻塞在挂起的 Desktop 审批」状态；审批落定（接受、拒绝或失效）后该字段 SHALL 消失。

#### Scenario: 审批挂起期间列表可见注意态
- **WHEN** 外部 Turn 的审批请求已转发给 Desktop 且尚未响应
- **THEN** `thread list` 中该外部行 SHALL 返回 `status: "running"` 且 `attention: "approval"`

#### Scenario: 审批落定后注意态消失
- **WHEN** Desktop 对该审批作出响应
- **THEN** 随后的 `thread list` 中该外部行 MUST NOT 携带 `attention`

### Requirement: 挂起提问以输入注意态暴露
系统 SHALL 在 `thread list` 外部行上以可选字段 `attention: "input"` 暴露「当前 Turn 阻塞在挂起的 Desktop 提问/提示」状态（Claude AskUserQuestion、Pi user question 等）；提问落定后该字段 SHALL 消失。同一 Turn 同时挂起提问与审批时，SHALL 投影 `input`。

#### Scenario: 提问挂起期间列表可见输入注意态
- **WHEN** 外部 Turn 的提问已转发给 Desktop 且尚未响应
- **THEN** `thread list` 中该外部行 SHALL 返回 `status: "running"` 且 `attention: "input"`

#### Scenario: 提问落定后注意态消失
- **WHEN** Desktop 对该提问作出响应
- **THEN** 随后的 `thread list` 中该外部行 MUST NOT 携带 `attention`

### Requirement: 外部列表保留完整 Turn 状态
系统 SHALL 在 `thread list` 外部行上投影 `creating | running | completed | failed | interrupted`，MUST NOT 把非 running 一律写成 `completed`。`failed` 与 `interrupted` 分别对应最近 Turn 失败与中断。

#### Scenario: 中断 Turn 列表为 interrupted
- **WHEN** 外部 Turn 以 interrupted 结束且 Session 不再 running
- **THEN** `thread list` 中该外部行 SHALL 返回 `status: "interrupted"`

#### Scenario: 失败 Turn 列表为 failed
- **WHEN** 外部 Turn 以 failed 结束且 Session 不再 running
- **THEN** `thread list` 中该外部行 SHALL 返回 `status: "failed"`
