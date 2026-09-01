## 1. Runtime 实现

- [x] 1.1 AppServerHost 维护外部 Thread 未读集合：非 ephemeral Turn 完成置未读。
- [x] 1.2 Desktop 侧 `thread/resume` 与 `thread/read`（includeTurns）清未读；委派 CLI 读取路径保持非消费性。

## 2. 控制契约

- [x] 2.1 `DelegationThreadListItem` 新增可选 `hasUnreadTurn`；`#listDelegationThreads` 仅对外部行投影该字段。

## 3. 验证

- [x] 3.1 `app-server-host.test.ts` 新增未读生命周期聚焦用例（完成置未读 → Desktop 视图清除；原生行不携带字段）。
- [x] 3.2 host-runtime `tsc -b` 与受影响测试文件（app-server-host / delegation-cli / delegation-control-registry，136 例）通过。
- [ ] 3.3 Desktop 经正常退出后由 `codexhost launch` 重启以激活（需用户执行单实例门禁流程）。
