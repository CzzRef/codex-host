## ADDED Requirements

### Requirement: 外部 Thread 未读状态由 Host 拥有并经列表暴露
系统 SHALL 为外部 Harness Thread 维护 Host 拥有的未读状态，并在 `codexhost thread list` 的外部行上以可选布尔字段 `hasUnreadTurn` 暴露。原生 Codex 行 MUST NOT 携带该字段，其未读权威保留在 Desktop。

#### Scenario: 外部 Turn 完成后列表标记未读
- **WHEN** 一个外部 Thread 的非 ephemeral Turn 完成且 Desktop 尚未再次查看该 Thread
- **THEN** `thread list` 中该外部行 SHALL 返回 `hasUnreadTurn: true`

#### Scenario: Desktop 查看后未读被清除
- **WHEN** Desktop 对该外部 Thread 发起 `thread/resume` 或带 `includeTurns` 的 `thread/read`
- **THEN** 随后的 `thread list` 中该外部行 SHALL 返回 `hasUnreadTurn: false`

#### Scenario: 委派 CLI 读取保持非消费性
- **WHEN** 调用方通过委派 CLI 执行 `thread read` 或 `thread wait`
- **THEN** 外部 Thread 的未读状态 MUST NOT 因此改变

#### Scenario: Host 重启后的边界
- **WHEN** Host Runtime 重启
- **THEN** 外部 Thread 的未读状态 SHALL 以已读起始（内存态 v1 边界）
