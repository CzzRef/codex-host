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
