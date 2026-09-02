## Why

委派 CLI 起的子线程没有 Desktop 审批人：目标 Harness 在默认权限模式下一碰受保护的工具调用，Host 就以 deny 回应，Turn 以 `permission_rejected` 收尾为 `interrupted`。2026-09-02 的 Grok 插队探针两次都因此停在「待继续」，Agent 无法用 CLI 交付一个真正跑完的子任务。Desktop 侧已有 Harness 权限模式目录与 `codexhost/thread/permission-mode/select`，CLI 侧却没有入口。

## What Changes

- `codexhost delegate start` 新增 `--permission-mode <mode-id>`：取 `harness inspect` 返回的 `permissionModes.modes[].id`，子线程从第一个 Turn 起就以该模式打开（`CreateSessionInput.permissionModeId`）。
- 校验与 `--model` / `--thinking` 同路：Harness 不支持权限模式选择或目录里没有该 id 时以 `INVALID_ARGUMENT` 拒绝，并回 `validPermissionModeIds`；原生 Codex 目标拒绝该选项。
- 请求的模式进入 `configuration.requested.permissionModeId`，会话实际模式进入 `configuration.effective.effectivePermissionModeId`；模式参与隐式去重摘要。
- 只给选项不给 `--model` 时，transport id 借用目录默认 Model 编码选择，供 Desktop 重启恢复；此前 `--thinking` 单独出现会在编码处抛裸错误，现同样走这条回退。
- 帮助文本与委派 Skill 说明：CLI 子线程无审批人，默认模式下受保护工具调用被拒并打断 Turn。

## Capabilities

### New Capabilities

### Modified Capabilities

- `cross-harness-delegation`: 委派启动可指定目标 Harness 的权限模式。

## Impact

- Host Runtime `HarnessDelegationCoordinator`（校验、open、transport 编码、结果）、`delegation-cli.ts`（选项、帮助）、`delegation-types.ts`、`delegation-skill.ts`。
- 聚焦测试：协调器对显式模式的 open 输入与结果、目录外 id 与无目录 Harness / 原生 Codex 的拒绝；CLI 请求体。
- 真机：Grok 子线程以 `always-approve` 起跑，完成后 Host 标未读，EyPc 进「已完成未读」。
