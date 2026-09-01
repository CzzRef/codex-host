## ADDED Requirements

### Requirement: 委派 CLI 可改名额外进程
`codexhost thread rename [<thread>] --name <title>` SHALL 将 Host Thread 标题持久化为 `titleSource: native`，并 SHALL 发送与 Desktop `thread/name/set` 相同的 `thread/name/updated` 通知。省略 `<thread>` 时 SHALL 使用 `CODEXHOST_THREAD_ID`。该命令 MUST NOT 覆盖 Desktop 手改名：手改名是 `titleSource=desktop`、存在可用 preview 证据（投影字段或已刷新历史中的首条用户消息）、且存储名不是该 Thread 首条消息兜底形的标题。Desktop 首条消息兜底——包括 reload 后 `titleSource=desktop` 但没有可用 preview 证据的情况——SHALL 允许被该命令替换。

#### Scenario: 改名通知 Desktop 侧栏
- **WHEN** 调用方对一个 Host 管理的额外进程执行有效的 `thread rename`
- **THEN** Host SHALL 持久化新标题
- **AND** SHALL 发送 `thread/name/updated`
- **AND** 侧栏 SHALL 无需重启即可显示新标题

#### Scenario: 无 preview 的 desktop 兜底可被改名
- **WHEN** 存储标题的 `titleSource` 为 `desktop` 且 loaded Thread 没有可用 preview
- **THEN** `thread rename` SHALL 成功替换该标题

#### Scenario: 有 preview 证据的手改名不被覆盖
- **WHEN** 用户已通过 Desktop `thread/name/set` 写入一个与首条消息 preview 不同的名字
- **THEN** `thread rename` SHALL 以 `INVALID_ARGUMENT` 失败
- **AND** 存储标题 MUST NOT 改变
