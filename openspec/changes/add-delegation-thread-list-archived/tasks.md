## 1. 控制契约

- [x] 1.1 `ThreadListInput` 新增可选 `archived`；`#listDelegationThreads` 以 `archived ?? false` 组装内部 `thread/list`。
- [x] 1.2 `DelegationThreadListItem` 新增可选 `archived`；仅外部行投影 Host 持久化的归档状态。

## 2. CLI

- [x] 2.1 `thread list` 接受 `--archived true|false`；`true` 时请求体带 `archived: true`，非法值在联系 Runtime 前失败。
- [x] 2.2 帮助文本说明归档视图与外部行的 `archived` 字段。

## 3. 验证

- [x] 3.1 `app-server-host.test.ts`：外部行活跃时 `archived: false`；Desktop `thread/archive` 后活跃列表不含该行，`archived: true` 列表含该行并标记 `archived: true`。
- [x] 3.2 `delegation-cli.test.ts`：`--archived true` 请求体、`--archived false` 保持活跃请求体、`--archived yes` 参数错误。
- [ ] 3.3 Desktop 正常退出 + `codexhost launch` 激活当前 dist 后，用 `codexhost thread list --all true --archived true` 回读已归档外部线程（用户执行）。
- [ ] 3.4 EyPc 侧消费 `archived`（另一仓库）。
