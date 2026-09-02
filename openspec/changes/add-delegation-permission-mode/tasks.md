## 1. Runtime 实现

- [x] 1.1 `DelegationStartInput.permissionModeId` 经 `harness inspect` 目录校验后传给 `adapter.open`，并进入 `requestedPermissionModeId` 与结果 `configuration.requested/effective`。
- [x] 1.2 无目录 Harness、目录外 id 以 `INVALID_ARGUMENT` 拒绝（附 `validPermissionModeIds`）；原生 Codex 目标拒绝该选项。
- [x] 1.3 选项存在而 `--model` 缺省时 transport id 借用目录默认 Model；模式参与隐式去重摘要。

## 2. 控制契约

- [x] 2.1 `codexhost delegate start … [--permission-mode <mode-id>]`，帮助文本说明 CLI 子线程无审批人的后果与拒绝条件。
- [x] 2.2 委派 Skill 说明何时传该选项。

## 3. 验证

- [x] 3.1 聚焦测试：协调器三例（应用 / 目录外 / 无目录与原生 Codex）、CLI 请求体；`npm run typecheck`。
- [x] 3.2 真机：Host 重启后 Grok 子线程 `4cd13fa2` 以 `--permission-mode always-approve` 起跑并 `completed`（8 次 allow、单一原生 Turn、插队同轨），Host 行 `hasUnreadTurn: true`；EyPc discovery 已收录（6→7），分组视觉待用户前台核验。
