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
