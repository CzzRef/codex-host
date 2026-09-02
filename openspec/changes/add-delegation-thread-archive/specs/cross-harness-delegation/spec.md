## ADDED Requirements

### Requirement: 委派 CLI 可归档额外进程
`codexhost thread archive [<thread>]` SHALL 将 Host Thread 的归档状态持久化为 `archived: true`，并 SHALL 发送与 Desktop `thread/archive` 相同的 `thread/archived` 通知；`codexhost thread unarchive [<thread>]` SHALL 持久化 `archived: false` 并发送 `thread/unarchived`。省略 `<thread>` 时 SHALL 使用 `CODEXHOST_THREAD_ID`。该命令 MUST NOT 停止正在运行的 Turn，MUST NOT 关闭 Native Session。原生 Codex Thread 与未知 id SHALL 以 `THREAD_NOT_FOUND` 失败，其归档权威保持在 Desktop。

#### Scenario: 归档后活跃列表与侧栏同时收起
- **WHEN** 调用方对一个 Host 管理的额外进程执行 `thread archive`
- **THEN** Host SHALL 持久化 `archived: true`
- **AND** SHALL 发送 `thread/archived`
- **AND** 省略 `--archived` 的 `thread list` MUST NOT 再返回该行，`--archived true` SHALL 返回该行

#### Scenario: 取消归档恢复活跃视图
- **WHEN** 调用方对已归档的额外进程执行 `thread unarchive`
- **THEN** Host SHALL 持久化 `archived: false`
- **AND** SHALL 发送 `thread/unarchived`

#### Scenario: 原生 Thread 不接受
- **WHEN** 调用方对原生 Codex Thread 或未知 id 执行 `thread archive`
- **THEN** 命令 SHALL 以 `THREAD_NOT_FOUND` 失败
- **AND** MUST NOT 联系官方 app-server

#### Scenario: 缺少标识
- **WHEN** 调用方既未提供 `<thread>` 也没有 `CODEXHOST_THREAD_ID`
- **THEN** 命令 SHALL 以 `INVALID_ARGUMENT` 失败
- **AND** MUST NOT 联系 Runtime

### Requirement: 归档级联到 side 子对话
side 子对话是 `ephemeral` 的派生 Thread（带 `forkSource`），不出现在任何列表里，Desktop 把它嵌在来源 Thread 内展示。对来源 Thread 的归档 / 取消归档——无论来自 Desktop `thread/archive` 还是委派 CLI——SHALL 把同一归档状态持久化到其下全部 side 子对话（含嵌套）。子对话 MUST NOT 单独发送 `thread/archived` / `thread/unarchived`，来源 Thread 自己的通知已代表该手势。

#### Scenario: Codex 里归档主对话
- **WHEN** Desktop 对一个带 side 子对话的外部 Thread 执行 `thread/archive`
- **THEN** Host SHALL 持久化来源 Thread 与全部 side 子对话的 `archived: true`
- **AND** 取消归档时 SHALL 同样级联为 `archived: false`

### Requirement: side 子对话活动汇总到来源 Thread
`codexhost thread list` 的 `status` 与 `attention` SHALL 把运行中的 side 子对话计入来源 Thread：任一 side 子对话 `running` 时来源行 SHALL 为 `running`；side 子对话挂起提问或审批时来源行 SHALL 携带对应 `attention`。side 子对话自身仍 MUST NOT 出现在列表中。

#### Scenario: 子对话运行时来源行为 running
- **WHEN** 来源 Thread 自身空闲而其 side 子对话正在执行一个 Turn
- **THEN** `thread list` 中的来源行 SHALL 报告 `status: running`
- **AND** 子对话 Turn 结束后来源行 SHALL 回到自身终态
