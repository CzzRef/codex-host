## Why

Desktop 之外的消费者只能通过委派 CLI 接触 Host 托管的额外进程。EyPc 这类轮询消费者要归档一条 Grok / Pi / Claude Code 会话时，此前只能把 `thread/archive` 发给自己拉起的官方 `codex app-server`，而官方进程根本不认识这些 id，请求在预检就失败；Host 已经持久化 `archived` 并按它过滤 `thread list`，缺的只是一个可从外部调用的写入口。

## What Changes

- 新增委派 CLI `codexhost thread archive [<thread>]` 与 `codexhost thread unarchive [<thread>]`：持久化 Host Thread 归档状态，并发送与 Desktop `thread/archive` / `thread/unarchive` 相同的 `thread/archived` / `thread/unarchived` 通知，侧栏与活跃列表同时收起或恢复。省略 `<thread>` 时使用 `CODEXHOST_THREAD_ID`。
- 归档不停止正在运行的 Turn，与 Desktop 语义一致。
- 原生 Codex Thread 不接受该命令（`THREAD_NOT_FOUND`），其归档权威保持在 Desktop。

## Capabilities

### New Capabilities

### Modified Capabilities

- `cross-harness-delegation`: 委派 CLI 可归档 / 取消归档额外进程，与 Desktop 归档共用同一条持久化与通知路径。

## Impact

- Host Runtime AppServerHost（`#archiveDelegationThread`、与 Desktop 路径共用的 `#applyExternalArchiveState`）、控制服务 `/v1/thread/archive`、委派 CLI 与帮助文本。
- 聚焦测试：CLI 参数解析与请求体；控制服务分发；注册表按归属路由；Host 通过委派 API 归档 / 取消归档并发通知，原生 id 拒绝。
