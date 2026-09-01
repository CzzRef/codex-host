## MODIFIED Requirements

### Requirement: 外部 Thread 的 Turn 方法路由
`turn/start` 与 `turn/interrupt` 保持既有外部路由；`turn/steer` SHALL 立即以空结果应答并把消息作为 follow-up 入队（与原生 steering 的即时应答一致，composer 保持可用、可重复追加）：活跃 Turn 运行时消息在其完成后按序作为下一个 Turn 启动，空闲 Thread 立即启动；入队的 steer 克隆不再欠 Desktop 任何后续响应。队列满时 steer SHALL 显式失败。其余 `turn/*` 方法 SHALL 继续返回显式不支持错误，且 MUST NOT 转发给官方 app-server。

#### Scenario: 运行中收到 steer
- **WHEN** `turn/steer` 引用一个正有活跃 Turn 的外部 Thread
- **THEN** Host SHALL 立即以空结果应答该请求
- **AND** 其消息 SHALL 在活跃 Turn 完成后按序作为下一个 Turn 启动
- **AND** 该消息的后续启动 MUST NOT 再向 Desktop 发送响应帧

#### Scenario: 连续多次 steer
- **WHEN** 活跃 Turn 期间连续发送多条 `turn/steer`
- **THEN** 每条 SHALL 立即应答并按序入队，队列满时显式失败

#### Scenario: 空闲 Thread 收到 steer
- **WHEN** `turn/steer` 引用一个无活跃 Turn 的外部 Thread
- **THEN** Host SHALL 立即应答并随即以其消息启动新 Turn

#### Scenario: 其他 turn 方法仍显式拒绝
- **WHEN** 非 start/interrupt/steer 的 `turn/*` 引用外部 Thread
- **THEN** Host SHALL 返回显式不支持错误且不转发官方 app-server
