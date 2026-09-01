## Why

Codex Desktop 在 Turn 运行期间输入后续消息时发送 `turn/steer`。外部 Harness 会话此前对所有非 start/interrupt 的 `turn/*` 显式返回 `-32076`，Desktop 因此弹出 "External Thread does not support turn/steer"，用户对 Grok/Claude Code 等外部会话的正常追加被整体拒绝——而这些 Harness 本身支持后续 Turn，只是没有官方 Codex 的「中途注入」面。

## What Changes

- 外部 Thread 的 `turn/steer` 不再拒绝：消息进入既有的 follow-up 队列（活跃 Turn 完成后作为下一个 Turn 启动并以该 Turn 应答请求）；空闲 Thread 立即启动新 Turn。
- 其他非 start/interrupt/steer 的 `turn/*` 保持显式拒绝，不泄漏给官方 app-server。
- 语义边界：steer 在外部会话上是「排队的追加」，不是官方 Codex 的中途注入；正在运行的 Turn 内容不受影响。

## Capabilities

### New Capabilities

### Modified Capabilities

- `registered-harness-routing`: 外部 Thread 的 `turn/steer` 由拒绝改为 follow-up 队列语义。

## Impact

- Host Runtime AppServerHost（steer 路由到既有 `#startExternalTurn` 队列）。
- 聚焦测试：steer 排队/空闲即启双场景（原拒绝断言删除）。
