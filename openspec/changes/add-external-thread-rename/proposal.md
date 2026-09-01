## Why

外部 Harness 会话的侧栏标题此前只能靠 Desktop 首条消息兜底，或等 Adapter 在回合结束时同步原生标题。Pi 额外进程没有原生标题事件，Grok 等会话在 reload 后也会把 `titleSource=desktop` 且没有 preview 的兜底名误当成手改名，导致 `codexhost thread rename` 无法把原生标题写进 Desktop。

## What Changes

- 新增委派 CLI `codexhost thread rename [<thread>] --name <title>`：持久化 Host Thread 标题并发送与 Desktop 改名相同的 `thread/name/updated` 通知，侧栏无需重启即可更新。省略 `<thread>` 时使用 `CODEXHOST_THREAD_ID`。
- Desktop 手改名（`titleSource=desktop`、有非空 preview、且不是首条消息兜底形）不被覆盖。
- Desktop 首条消息兜底——包括 reload 后 `titleSource=desktop` 但没有可用 preview 的情况——允许被 CLI 改名。

## Capabilities

### New Capabilities

### Modified Capabilities

- `cross-harness-delegation`: 委派 CLI 可改名额外进程，并区分手改名与首条消息兜底。

## Impact

- Host Runtime AppServerHost（`#renameDelegationThread`、手改名判定）、委派 CLI / 控制服务。
- 聚焦测试：无 preview 的 desktop 兜底可改名；有 preview 的手改名拒绝。
