---
id: codexhost-harness-steer-settle-assumptions
status: verified
scope: project
fingerprint: turn-steer-native-delivery__adapter-settle-assumes-tool-boundary-or-second-result__host-turn-failed-or-never-completed
first_seen: 2026-09-02
last_verified: 2026-09-02
review_after: 2026-12-02
evidence:
  - packages/adapters/pi/src/pi-history.ts
  - packages/adapters/omp/src/omp-history.ts
  - packages/adapters/claude-code/src/sdk-transport.ts
  - packages/adapters/pi/test/pi-history.test.ts
  - packages/adapters/claude-code/test/sdk-transport.test.ts
tags:
  - turn-steer
  - pi
  - omp
  - claude-code
  - native-history
---

# 插队结算按猜测的原生形态写：Pi 无工具插队被判 failed，Claude 插队后 Host Turn 永不结束

## 症状

- Pi：对没有工具调用的一轮插队，回答正常，Host Turn 却报 `Pi Turn persisted 2 new User Entries; exactly one is required (1 steer(s) delivered)`。
- Claude Code：插队被模型接受并回答，但 `turn.completed` 永不到达，`readSnapshot` 报 `sessionBusy`，Desktop 一直转圈。

## 错误假设

1. 以为 Pi 只在 `stopReason: "toolUse"` 之后送达排队的 steer，所以历史折叠只看这一条线索（`f3b2e58`）。实测 Pi 0.84.4 在 assistant 以 `stop` 结束、且插队队列非空时同样继续 agent run 并送达，落一条无标记的 user entry。
2. 以为 Claude Code 对推入运行中 query 的用户消息总会另开一轮并再产生一条 `result`，于是每条插队都递减 `pendingSteers` 并继续等。实测 CLI 在工具边界前就把插队注入同一 query，只有一条 `result`；只有来不及注入的插队才在 `result` 后作为下一 CLI turn 再产生一条。

## 已验证根因

- Pi/OMP 会话文件里插队 entry 与普通 prompt 同形，唯一稳定线索是 `message.timestamp`（入队时刻）早于其前一条 assistant entry 的 `timestamp`（落盘时刻）；普通 prompt 在 assistant 落盘之后才创建。
- Claude Code 2.1.258 通过 `command_lifecycle`（`system init` 能力 `msg_lifecycle_v1`）按消息 uuid 报 `queued → started → completed`：mid-turn 注入的插队 `started` 早于 `result`，late 插队的 `started` 紧跟在 `result` 之后。

## 检测顺序

1. Pi/OMP：看会话文件里插队 user entry 前一条 assistant 的 `stopReason` 与两者 timestamp 的先后。
2. Claude：用 SDK 原始消息流看 `command_lifecycle.state` 与 `result` 的先后顺序，以及 `system init` 出现次数。

## 预防规则

- 原生插队形态只信真实二进制：用构建后的 Adapter + scratch cwd 的探针（`turn.start` 后延迟 `turn.steer`），分别验证有工具与无工具两种轮次。
- Pi/OMP 折叠规则：`stopReason: "toolUse"` 或 `queuedBeforeEntry`（`message.timestamp < assistant.timestamp`）；结算仍要求恰好一条新 Turn。
- Claude 结算：`result` 到达时仅当还有 `queued` 状态的插队才继续等，且用 `steerSettleTimeoutMs`（默认 3s）兜底没有 lifecycle 的 CLI。

## 记录历史

| 日期 | 任务 | 触发 | 失败路线 | 恢复 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 2026-09-02 | 260902-Steer插入核验 F-1/F-2 | 用户要求逐个核验各 Harness 插队 | Pi 无工具插队判 failed；Claude 插队后 Host Turn 挂起 | 折叠加入队时间戳线索；Claude 按 command_lifecycle 结算 | verified：真机探针 Pi succeeded 且 1 轮；Claude mid-turn 16.8s 完成、late 在第二条 result 后完成；vitest 188 文件 1626 过 |
