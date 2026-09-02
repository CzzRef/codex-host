## ADDED Requirements

### Requirement: 委托列表透出外部 Thread 的归档状态
`codexhost thread list` SHALL 接受 `--archived true|false`。省略或 `false` 时列举 SHALL 保持活跃 Thread 视图；`true` 时 SHALL 列举已归档 Thread，并与 Desktop `thread/list` 的 `archived` 语义一致（原生 Codex 行来自官方归档列表，外部行来自 Host 持久化的归档状态）。外部 Thread 行 SHALL 携带布尔字段 `archived`；原生 Codex 行 MUST NOT 携带该字段，其归档权威保持在 Desktop。

#### Scenario: Desktop 归档后活跃列表不再包含该行
- **WHEN** Desktop 对一个外部 Thread 执行 `thread/archive` 且 Host 已持久化 `archived: true`
- **THEN** 省略 `--archived` 或 `--archived false` 的 `thread list` MUST NOT 返回该行

#### Scenario: 归档视图返回该行并标记
- **WHEN** 调用方执行 `codexhost thread list --archived true`
- **THEN** 结果 SHALL 包含该外部行
- **AND** 该行 SHALL 返回 `archived: true`

#### Scenario: 活跃外部行显式标记未归档
- **WHEN** 活跃列表包含一个外部 Thread 行
- **THEN** 该行 SHALL 返回 `archived: false`

#### Scenario: 非法归档参数
- **WHEN** 调用方提供 `--archived` 的值不是 `true` 或 `false`
- **THEN** 命令 SHALL 以可辨识的参数错误失败
- **AND** MUST NOT 联系 Runtime
