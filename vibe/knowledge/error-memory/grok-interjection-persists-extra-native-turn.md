---
id: codexhost-grok-interjection-persists-extra-native-turn
status: verified
scope: project
fingerprint: grok-turn-steer-native-interject__settle-from-history-expects-exactly-one-new-native-turn__host-turn-reported-failed
first_seen: 2026-09-02
last_verified: 2026-09-02
review_after: 2026-12-02
evidence:
  - packages/adapters/grok/src/grok-interject.ts
  - packages/adapters/grok/src/grok-adapter.ts
  - packages/adapters/grok/test/grok-adapter.test.ts
  - ~/.grok/logs/unified.jsonl（shell.cancel.received → prompt received，无 interject 记录）
  - ~/.grok/sessions/<cwd>/<session>/events.jsonl（turn_ended mid_turn_abort + turn_started redirect_kind=cancel_then_send）
tags:
  - grok
  - turn-steer
  - native-history
  - external-thread-status
---

# Grok 插队（steer）后 Host Turn 被判 failed：interject 方法名错误 + 结算早于 Grok 落盘

## 症状

对正在运行的 Grok 额外进程发 `turn.steer`（Desktop 侧「插队/立即追加」），第一轮被打断、后续消息以新 prompt 续跑，最后 Host 把整条 Turn 标成 `failed`，错误文案 `Grok Turn persisted 2 new Native Turns; exactly one is required`。下游（Desktop 侧栏错误徽标、EyPc「待继续」）全部跟着变成失败态。

## 错误假设

1. 以为 Grok 原生接受了 interject 并把插队内容另开一条 Native Turn，于是把结算上限放宽到 `1 + 已送达插队数`（`2155d93`）。实测不成立：Adapter 调的 `x.ai/interject` 在 grok 1.0.13 上是 `-32601 Method not found`，从未送达；真正的 `_x.ai/interject` 把插队作为 `synthetic_reason: "interjection"` 的用户消息注入**同一条** Native Turn，`turn_completed` 仍只有一条。放宽对失败场景（送达数为 0）也不起作用。
2. 以为结算时读到的原生历史已经完整。实际 Grok 先应答 `session/prompt`，稍后才把 `turn_completed` 追加进 `updates.jsonl`。

## 已验证根因

- `x.ai/interject` Method not found → `#injectSteer` 走 `transport.cancel()` 回退：Grok 记 `turn_ended mid_turn_abort`，Adapter 在同一 Host Turn 内用新 prompt 续跑（Grok 记 `turn_started redirect_kind=cancel_then_send`，chat_history 带 `prior_turn_interrupt`）。
- 续跑前的结算读历史早于 `turn_completed` 落盘：该 Native Turn 先按用户事件 eventId 计键进「已持久化」集合，下一次结算时它已按 prompt_id 计键，被当成新增，加上真正的新一条恰好是 2，触发「恰好一条」断言，成功结果被改写为 `{ status: "failed", protocolError }`。

## 检测顺序

1. Host 报 `persisted N new Native Turns` 时，先看 `~/.grok/logs/unified.jsonl`：紧跟 steer 应答出现 `shell.cancel.received` 再 `prompt received`，且无 interject 记录，就是回退路径。
2. 会话 `events.jsonl` 出现 `turn_ended cancelled mid_turn_abort` + `turn_started redirect_kind=cancel_then_send`；真正的插队应是 `interjected redirect_kind=interjection`，且不产生新的 `turn_started`。
3. 对照 `updates.jsonl` 里 `turn_completed` 的 `agentTimestampMs` 与 Adapter 结算时间，判断是否命中落盘滞后。

## 预防规则

- Grok ACP 扩展方法一律带 `_x.ai/` 前缀；interject 参数是 `{ sessionId, text }`，响应 `{ result: { status } }`（[grok-interject.ts](../../../packages/adapters/grok/src/grok-interject.ts#L1-L38)）。新接原生方法先用 bogus sessionId 探测：`-32601` 是方法不存在，`-32602` / `-32002` 才说明方法已路由。
- 结算用 checkpoint（prompt index）作为「已持久化 Native Turn」的身份，并在有界时间内等待 `turn_completed` 落盘再计数（`#awaitPersistedTurn`，`nativeHistorySettleTimeoutMs` 默认 1.5s）；仍要求恰好一条新 Native Turn。
- 假传输（测试）按真实形态模拟：interject 在当前 prompt 内追加一条 `user.text`，不另开 turn；`finishLagging` / `appendLaggingTerminal` 模拟终止记录滞后落盘。
- Pi/OMP 的 `1 + 已送达插队数` 放宽是它们各自实测的 User Entry 形态，不要反推到 Grok。

## 记录历史

| 日期 | 任务 | 触发 | 失败路线 | 恢复 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 2026-09-02 | 260902-插队感知验证（EyPc 联调） | 用户对运行中的 Grok 线程插队 | 结算断言恰好一条 Native Turn，成功 Turn 被改判 failed | 按送达插队数放宽上限；假传输补持久化；steer 用例断言 succeeded + prompt 的 nativeTurnRef | superseded：放宽基于「interject 已送达并另开 Native Turn」的假设，与 grok 1.0.13 实测不符（`2155d93`） |
| 2026-09-02 | 260902-Steer插入核验 | 同一线程的 Grok/Desktop 日志回读 + scratch 会话探针 | `x.ai/interject` -32601 → 取消续跑回退；结算读历史早于 `turn_completed` 落盘 | 方法改 `_x.ai/interject {sessionId,text}`；结算改 checkpoint 身份 + 等待终止记录；撤回 Grok 放宽 | verified：临时用例复现 `persisted 2 new Native Turns`，修复后 grok 测试全过 |
