## Why

Desktop 侧栏的 Pinned 分区是官方 app-server 的 section 概念，只对原生 Codex Thread 有效。Host 托管的额外进程既不在 app-server 的 section 表里，也没有任何外部入口能把它放进去：用户可以在 Desktop 里给一条 Grok / Pi / Claude Code 会话点置顶，但 Host 不持久化这件事，重启后它就掉回按 recency 排的普通位置；EyPc 这类只能通过委派 CLI 接触外部线程的消费者，连"这条被置顶了"都读不到。

`thread rename` / `archive` / `unarchive` 已经按同一形态补齐——Host 持久化状态 + 发与 Desktop 相同的通知 + `thread list` 行上透出字段。置顶是这组里唯一缺的一格。

## What Changes

- 新增委派 CLI `codexhost thread pin [<thread>]` 与 `codexhost thread unpin [<thread>]`：Host 通过 `assignSection` 把额外进程移入 / 移出 Desktop 的 Pinned 分区并持久化。省略 `<thread>` 时使用 `CODEXHOST_THREAD_ID`。
- 控制契约新增 `ThreadPinInput { threadId, pinned? }` 与 `ThreadPinResult { threadId, pinned }`；`pinned` 缺省为 `true`，`false` 表示移出。控制服务新增 `/v1/thread/pin` 路由，注册表新增 `pin()`。
- 委托列表的外部行新增可选布尔字段 `pinned`；原生 Codex 行不携带该字段，它们的置顶权威仍在 app-server 的 section。
- 持久化 section 成员身份与 `pinned` 标记时**不改动 recency**，`thread/list` 支持按 `sectionId` 过滤与 `section_position` 排序，与官方回包对齐（空结果按官方形状返回）。
- 原生 Codex Thread 不接受该命令（`THREAD_NOT_FOUND`）。

## Non-goals

- 不新增 Adapter 契约，不改官方 app-server 的 `thread/section/move` 语义。
- 不引入 Pinned 之外的自定义分区。

## Capabilities

### New Capabilities

### Modified Capabilities

- `cross-harness-delegation`: 委派 CLI 可置顶 / 取消置顶外部 Thread，列举行透出 `pinned`。

## Impact

- Host Runtime `#pinDelegationThread`、`external-thread-repository` 的 `assignSection`、`DelegationThreadListItem` / `ThreadPinInput` / `ThreadPinResult`、`delegation-control-registry`、`delegation-control-server` 路由与 CLI 帮助文本。
- mapping-store `records.ts` 新增 section 字段并在 `mapping-store.ts` 持久化；protocol-core `thread-management.ts` 的 section 过滤 / 排序 / 投影。
- 聚焦测试：`delegation-cli`、`delegation-control-registry`、`delegation-control-server`、`external-thread-list`、`mapping-store`、`thread-management`。
- 消费者：EyPc 可按 `pinned` 把外部线程排到面板顶部。
