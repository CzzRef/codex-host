## MODIFIED Requirements

### Requirement: 外部 Thread 的 Turn 方法路由
`turn/start` 与 `turn/interrupt` 保持既有外部路由；`turn/steer` SHALL 立即以空结果应答。当活跃 Turn 的 Session 声明 `turns.steer=true` 时，Host SHALL 对该活动 Turn 执行 `turn.steer`，MUST NOT 另开 Host Turn。插队被原生投递后，Host SHALL 把它投影为该 Turn 内的一条官方 `userMessage` item（id 稳定、按投递顺序排列），且该投影在实时流与重载后的历史读取中 SHALL 一致；Host MUST NOT 把插队文本并入 Turn 的首条 `userMessage`，也 MUST NOT 因插队在任何 Harness 的历史里另起一条 Host Turn。不支持原生 steer 时，Host SHALL 把消息作为 follow-up 入队，并在立即追加场景取消当前 Turn，待终态后按序启动。空闲 Thread 上的 steer SHALL 立即启动。入队的 steer 克隆不再欠 Desktop 任何后续响应。队列满时 steer SHALL 显式失败。用户 Stop（`turn/interrupt`）仍丢弃队列；steer 触发的取消 SHALL 保留队列。其余 `turn/*` 方法 SHALL 继续返回显式不支持错误，且 MUST NOT 转发给官方 app-server。

#### Scenario: 插队在同一 Host Turn 内可见
- **WHEN** 一个外部 Thread 的活跃 Turn 收到并原生投递了一条插队
- **THEN** 该 Turn 的 items 中出现一条额外的 `userMessage`，位于投递时刻之后的条目之前
- **AND** 重载后 `thread/read` 与 `codexhost thread read --view messages` 看到相同顺序

#### Scenario: 历史不再为插队另起 Turn
- **WHEN** Pi / OMP / Claude Code 的原生历史里存在一条被投递的 steer 用户消息
- **THEN** Host 的历史快照 SHALL 把它折叠进它所属的 Turn
- **AND** 不再把它算作新的 Host Turn，Fork / 回滚边界 SHALL 跳过它
