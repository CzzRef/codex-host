## 1. Runtime 实现

- [x] 1.1 `thread/start`：bypass（approvalPolicy never + danger-full-access）且无显式 Permission Mode 时传 `executionPolicy: "unattended-full-access"`；`unsupported` 时回退 default。
- [x] 1.2 委派列表外部行投影 `attention: "approval"`（源自挂起的 Desktop 审批表）。

## 2. 控制契约

- [x] 2.1 `DelegationThreadListItem` 新增可选 `attention`。

## 3. 验证

- [x] 3.1 聚焦测试：bypass 跟随、非 bypass 保持 default、Adapter 拒绝回退；审批挂起→attention、落定→消失。
- [x] 3.2 host-runtime `tsc -b` 与 `app-server-host.test.ts` 全量（119 例）通过。
- [ ] 3.3 Desktop 正常退出后 `codexhost launch` 重启激活（用户执行）。
