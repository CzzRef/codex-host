## MODIFIED Requirements

### Requirement: External turn starts queue behind the active Turn
Codex Desktop queues follow-up messages and treats any `turn/start` rejection as a permanently paused follow-up. When `turn/start` references an external Thread whose Turn is running and the Session declares `turns.steer=true`, Host SHALL execute `turn.steer` on that active Turn, MUST NOT open a new Host Turn, and SHALL answer the `turn/start` with the current in-progress Turn. Host SHALL hold `turn/start` only when the Session does not declare native steer. When the active Turn completes successfully, Host SHALL start **one** follow-up Turn whose input is every held `turn/start` text concatenated in arrival order (separated by a blank line), SHALL answer each held request with that same Turn, and SHALL NOT dispatch those follow-ups as separate Turns. Host SHALL NOT dispatch held `turn/start` requests after a user `turn/interrupt`; those held requests SHALL fail explicitly. Requests beyond the bound SHALL be rejected explicitly. Session fault and Thread deletion SHALL also fail held requests explicitly.

#### Scenario: Follow-up arrives during a steerable Turn
- **WHEN** `turn/start` references an external Thread whose Turn is running and the Session declares `turns.steer=true`
- **THEN** Host executes `turn.steer` on the active Turn
- **AND** answers the `turn/start` with that same in-progress Turn
- **AND** MUST NOT start a new Host Turn

#### Scenario: Follow-up arrives during an active Turn
- **WHEN** `turn/start` references an external Thread whose Turn is running and the Session does not declare native steer
- **THEN** Host holds the request without responding

#### Scenario: Multiple follow-ups append as one Turn
- **WHEN** the active Turn completes successfully and two or more `turn/start` requests are held
- **THEN** Host starts one Turn whose input concatenates those texts in arrival order
- **AND** each held request receives that same started Turn as its response

#### Scenario: Active Turn is interrupted by the user
- **WHEN** the active Turn completes as interrupted because Desktop sent `turn/interrupt`
- **THEN** Host SHALL fail every held `turn/start` request explicitly instead of dispatching it

### Requirement: 外部 Thread 的 Turn 方法路由
`turn/start` 与 `turn/interrupt` 保持既有外部路由；`turn/steer` SHALL 立即以空结果应答。当活跃 Turn 的 Session 声明 `turns.steer=true` 时，Host SHALL 对该活动 Turn 执行 `turn.steer`，MUST NOT 另开 Host Turn。不支持原生 steer 时，Host SHALL 把消息作为 follow-up 入队，并在立即追加场景取消当前 Turn，待终态后按序启动。空闲 Thread 上的 steer SHALL 立即启动。入队的 steer 克隆不再欠 Desktop 任何后续响应。队列满时 steer SHALL 显式失败。用户 Stop（`turn/interrupt`）仍丢弃队列；steer 触发的取消 SHALL 保留队列。其余 `turn/*` 方法 SHALL 继续返回显式不支持错误，且 MUST NOT 转发给官方 app-server。

#### Scenario: 支持原生 steer 的运行中 Session
- **WHEN** `turn/steer` 引用一个正有活跃 Turn 且 `turns.steer=true` 的外部 Thread
- **THEN** Host SHALL 立即以空结果应答该请求
- **AND** SHALL 对当前活动 Turn 执行 `turn.steer`
- **AND** MUST NOT 再为该消息启动新的 Host Turn

#### Scenario: 连续多次原生 steer
- **WHEN** 活跃 Turn 期间连续发送多条 `turn/steer` 且 Session 支持原生 steer
- **THEN** 每条 SHALL 立即应答并按到达顺序注入同一 Turn

#### Scenario: 不支持原生 steer 的立即追加
- **WHEN** `turn/steer` 引用一个正有活跃 Turn 但不声明 `turns.steer` 的外部 Thread
- **THEN** Host SHALL 立即应答并把消息作为 follow-up 入队
- **AND** 立即追加时 SHALL 取消当前 Turn，使队列在该 Turn 终态后按序立刻启动

#### Scenario: 空闲 Thread 收到 steer
- **WHEN** `turn/steer` 引用一个无活跃 Turn 的外部 Thread
- **THEN** Host SHALL 立即应答并随即以其消息启动新 Turn

#### Scenario: 其他 turn 方法仍显式拒绝
- **WHEN** 非 start/interrupt/steer 的 `turn/*` 引用外部 Thread
- **THEN** Host SHALL 返回显式不支持错误且不转发官方 app-server
