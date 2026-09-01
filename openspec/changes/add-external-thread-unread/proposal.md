## Why

Codex Desktop 只为原生 Thread 持久化未读状态（`unread-thread-ids-by-host-v1` 实测不含任何外部 Thread），外部 Harness 会话的未读点只存在于 Desktop 渲染层。任何外部消费者（如 EyBell/EyPc 悬浮任务面板）都无法得知一个外部会话是否有未读的已完成 Turn，导致跨工具的任务状态无法对齐。Host 是外部 Turn 生命周期的唯一拥有者，因此外部未读应由 Host 建模并经委派 CLI 暴露。

## What Changes

- Host Runtime 为外部 Thread 维护内存态未读集合：非 ephemeral Turn 完成时置未读；Desktop 侧对该 Thread 的 `thread/resume` 或 `thread/read`（includeTurns）视图请求清未读。
- `codexhost thread list` 的外部 Thread 行新增可选字段 `hasUnreadTurn`；原生 Codex 行不携带该字段（未读权威仍在 Desktop）。
- 委派 CLI 的 `thread read` / `thread wait` 保持非消费性：它们不清除未读。
- 内存态实现：Host 重启后外部 Thread 以已读起始（v1 边界，持久化留待后续需要时经 mapping-store 扩展）。

## Capabilities

### New Capabilities

### Modified Capabilities

- `cross-harness-delegation`: `thread list` 外部行暴露 Host 拥有的未读状态。

## Impact

- Host Runtime AppServerHost（未读集合、Desktop 视图清除点、委派列表投影）。
- Delegation 控制类型 `DelegationThreadListItem`。
- 聚焦测试：`app-server-host.test.ts` 未读生命周期用例。
