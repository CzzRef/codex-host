## Why

Desktop 归档一个外部 Harness Thread 时，Host 已把 `archived: true` 写进 mapping-store 并正常应答 `thread/archive`，但 `codexhost thread list` 内部固定按 `archived: false` 聚合，归档行只是从列表里消失，行上也没有任何归档字段。EyPc 这类靠轮询 `thread list --all true` 感知外部线程的消费者拿不到“它被归档了”的信号，只能让任务永远停在「已完成未读」。2026-09-02 实测：线程 `260901-新增发现测试` 在 05:24:29 归档落盘后，`thread list --all true` 的 31 行里没有它，且没有一行带 `archived`。

## What Changes

- `codexhost thread list` 增加 `--archived true|false`：`true` 列出已归档 Thread（外部与原生一致，走同一条 `thread/list archived` 聚合），省略或 `false` 保持现有的活跃列表。
- 委托列表的外部行新增布尔字段 `archived`（Host 持久化的归档状态）；原生 Codex 行不携带该字段，归档权威仍在 Desktop。
- 控制平面 `ThreadListInput.archived` 透传给 Host 内部 `thread/list`；缺省 `false`，请求体形状对旧调用方不变。

## Capabilities

### New Capabilities

### Modified Capabilities

- `cross-harness-delegation`: 列举命令可切到归档视图，外部行透出 `archived`。

## Impact

- Host Runtime `#listDelegationThreads`（查询透传 + 行投影）、`DelegationThreadListItem` / `ThreadListInput`、委托 CLI 参数与帮助。
- 聚焦测试：Desktop 归档后活跃列表不含该行、`--archived true` 列表含该行且 `archived: true`；CLI `--archived` 的请求体与非法值。
- 消费者：EyPc `codexhost-discovery` 需要再拉一次 `--archived true` 并把返回的外部行走既有的归档处理，才能真正把任务从面板收起。
