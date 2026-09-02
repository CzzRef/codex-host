## ADDED Requirements

### Requirement: 委派启动可指定权限模式
`codexhost delegate start` SHALL 接受 `--permission-mode <mode-id>`，其值 SHALL 取自目标 Harness `harness inspect` 返回的 `permissionModes.modes[].id`；子线程 SHALL 从第一个 Turn 起以该模式打开，并 SHALL 在结果 `configuration.requested.permissionModeId` 与 `configuration.effective.effectivePermissionModeId` 中回显。

#### Scenario: 以目录内模式启动
- **WHEN** 调用方对支持权限模式选择的 Harness 传入目录内的模式 id
- **THEN** Host SHALL 以该 `permissionModeId` 打开目标会话
- **AND** 结果 SHALL 回显请求与生效的模式

#### Scenario: 目录外模式
- **WHEN** 传入的模式 id 不在目标 Harness 的目录里
- **THEN** 命令 SHALL 以 `INVALID_ARGUMENT` 失败并附 `validPermissionModeIds`
- **AND** MUST NOT 创建子线程

#### Scenario: 不支持权限模式的目标
- **WHEN** 目标 Harness 没有权限模式目录，或目标是原生 Codex
- **THEN** 命令 SHALL 以 `INVALID_ARGUMENT` 失败
- **AND** MUST NOT 创建子线程

#### Scenario: 无审批人的默认模式
- **WHEN** 调用方省略 `--permission-mode` 且目标在默认模式下发起受保护的工具调用
- **THEN** Host 的既有行为保持：该调用被拒，Turn 以 `interrupted` 收尾
- **AND** 帮助文本 SHALL 说明这一后果
