---
id: codexhost-grok-interjection-persists-extra-native-turn
status: verified
scope: project
fingerprint: grok-turn-steer-native-interject__settle-from-history-expects-exactly-one-new-native-turn__host-turn-reported-failed
first_seen: 2026-09-02
last_verified: 2026-09-02
review_after: 2026-12-02
evidence:
  - packages/adapters/grok/src/grok-adapter.ts
  - packages/adapters/grok/test/grok-adapter.test.ts
tags:
  - grok
  - turn-steer
  - native-history
  - external-thread-status
---

# Grok 插队（steer）后 Host Turn 被判 failed：一条 Host Turn 落了两条 Native Turn

## 症状

对正在运行的 Grok 额外进程发 `turn.steer`（Desktop 侧「插队/立即追加」），Grok 原生接受了 interject，回答也正常完成，但 Host 把这条 Turn 标成 `failed`，错误文案 `Grok Turn persisted 2 new Native Turns; exactly one is required`。下游（Desktop 侧栏错误徽标、EyPc「待继续」）全部跟着变成失败态；线程也因此永远不会被 Desktop 读到，Host 未读无法清除。

## 错误假设

以为一条 Host Turn 在 Grok 原生历史里只会新增一条 Native Turn。这对普通 prompt 成立；对 `x.ai/interject` 不成立——Grok 会先结束当前 prompt 的 Native Turn，再把插队内容作为新的 user 事件开一条 Native Turn。

## 已验证根因

`#settleFromHistory` 在 Turn 结束后重读原生历史，把 `beforeNativeTurnKeys` 之外的 Native Turn 视为本 Host Turn 新增，并断言恰好一条。插队成功送达时新增为 `1 + 插队数`，断言抛错，成功的结果被改写成 `{ status: "failed", protocolError }`。

## 检测顺序

1. Host `thread list`/`read` 显示 `failed` 且 Desktop 回答完整时，先看 Host 诊断里是否有 `persisted N new Native Turns`。
2. 有则确认该 Turn 是否发过 `turn.steer` 且 `interject` 成功（`pendingSteers` 已清空、未走 cancel 回退）。
3. 原生历史里 `turn.completed` 的数量应等于 `1 + 送达的插队数`。

## 预防规则

- `ActiveTurn.deliveredInterjections` 记录本 Turn 内原生接受的插队数；结算时允许新增 Native Turn 数落在 `[1, 1 + deliveredInterjections]`，超出才是协议错误（[grok-adapter.ts](../../../packages/adapters/grok/src/grok-adapter.ts#L1177-L1191)）。
- Host Turn 的 `nativeTurnRef` 与 `checkpoint` 固定取 prompt 那条 Native Turn（`created[0]`），rewind/redo 仍回到整条 Host Turn 之前。
- 假传输（测试）必须模拟 Grok 的真实持久化：每条被接受的 interject 在 `finish` 时补一对 `user.text` + `turn.completed`，否则「恰好一条」的断言在测试里永远不会失败。
- 其他 Harness（Pi/OMP 有同形断言 `exactly one is required`）若也支持原生插队，需先实测其历史形态再决定是否套用同一放宽。

## 记录历史

| 日期 | 任务 | 触发 | 失败路线 | 恢复 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 2026-09-02 | 260902-插队感知验证（EyPc 联调） | 用户对运行中的 Grok 线程插队 | 结算断言恰好一条 Native Turn，成功 Turn 被改判 failed | 按送达插队数放宽上限；假传输补持久化；steer 用例断言 succeeded + prompt 的 nativeTurnRef | verified：修复前该用例失败（turn.completed 缺 nativeTurnRef 且 outcome failed），修复后 39/39 |
