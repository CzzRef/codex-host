## Why

Codex Desktop 在 Turn 运行期间输入后续消息时发送 `turn/steer`（强制追加 / 立即追加）。外部 Harness 会话此前对所有非 start/interrupt 的 `turn/*` 显式返回 `-32076`，Desktop 因此弹出 "External Thread does not support turn/steer"。用户要求强制追加调用对应 Harness 的原生 steer，而不是等上一轮对话自然结束后再开新 Turn。

## What Changes

- 外部 Thread 的 `turn/steer` 立即空结果应答（composer 保持可追加）。
- Session 声明 `turns.steer` 时，Host 把消息注入**当前活动 Turn**（Claude：PushableInput；Grok：ACP `x.ai/interject` 在当前 Prompt 的下一个 tool/model 安全间隙注入，方法不可用时才取消当前 Prompt 并在同一 Host Turn 内立刻续跑下一条 Prompt）。Desktop 在运行中发出的 `turn/start` follow-up，对声明了 `turns.steer` 的 Session 也按这条路径注入，不再持有到本轮结束。连续多条 steer 按到达顺序注入同一 Turn，不得另开 Host Turn。
- 不支持原生 steer 的 Harness 才回退 follow-up 队列；立即追加时取消当前 Turn，使队列按序立刻启动。
- 外部 Thread 在活跃 Turn 期间持有的多条 `turn/start` follow-up，在当前 Turn **成功结束** 后合并为**一条**后续 Turn（文本按到达顺序用空行拼接），并给每条被持有的 RPC 返回同一个 Turn，避免 Desktop 把拒绝标成永久 paused。
- 用户 Stop（`turn/interrupt`）仍丢弃队列，与原生 Codex 一致。Steer 触发的取消保留队列。
- 其他非 start/interrupt/steer 的 `turn/*` 保持显式拒绝，不泄漏给官方 app-server。

## Capabilities

### New Capabilities

### Modified Capabilities

- `registered-harness-routing`: 外部 Thread 的 `turn/steer` 优先走原生 `turn.steer`；不支持时才取消后按序追加。`turn/start` follow-up 队列改为一次合并。

## Impact

- Host Runtime AppServerHost、HarnessSession `turn.steer`、Claude/Grok Adapter。
- 聚焦测试：原生 steer 注入同一 Turn、不支持时的 follow-up 回退、follow-up 合并、用户 Stop 丢弃队列。
