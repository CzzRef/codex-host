## 1. Runtime 实现

- [x] 1.1 `turn/steer`：立即空结果应答；`turns.steer` 时注入当前 Turn；否则入队并在立即追加时取消当前 Turn；空闲即启；克隆响应抑制；队列满失败。
- [x] 1.2 多条被持有的 `turn/start` 在成功结束后合并为一条后续 Turn，每条 RPC 返回同一 Turn。
- [x] 1.3 用户 `turn/interrupt` 丢弃队列；steer 触发的取消保留队列。
- [x] 1.4 Claude PushableInput 与 Grok 同 Host Turn 续 Prompt 实现 `turn.steer`。
- [x] 1.5 结算放宽：Pi/OMP 一条 Host Turn 允许 `1 + 已送达插队数` 条 User Entry，身份取 prompt 那条（2026-09-02）。Grok 撤回该放宽：`_x.ai/interject` 落在同一条 Native Turn，结算改为 checkpoint 身份并等待 `turn_completed` 落盘（`nativeHistorySettleTimeoutMs`，默认 1.5s）。
- [x] 1.8 Grok interject 改为 `_x.ai/interject` + `{sessionId, text}`，解析 `result.status`（2026-09-02，实测 grok 1.0.13）。
- [x] 1.9 Claude Code 结算改按 `command_lifecycle`（`msg_lifecycle_v1`）追踪插队：`result` 时仍 `queued` 的插队才等下一条 result（`steerSettleTimeoutMs` 默认 3s 兜底），已 `started` 的插队与本轮共用一条 result（2026-09-02 19:05，修复挂起）。
- [x] 1.10 Pi/OMP 历史折叠补「user entry `message.timestamp` 早于前一条 assistant entry `timestamp`」线索，无工具调用的插队也折回原 Turn（2026-09-02 19:05）。
- [x] 1.6 Pi/OMP `turn.steer` → RPC `steer`；DeepSeek Harness `turn.steer` → `session.prompt mode:"steer"`；三者声明 `turns.steer`（2026-09-02）。
- [x] 1.8 Cursor `turn.steer`：cancel 当前 ACP prompt，cancelled 落定后同一 Host Turn 内 re-prompt 新内容；用户 cancel 优先于竞态中的 steer（2026-09-02）。
- [x] 1.7 委派 `thread send --steer true`：外部 Thread 走 `turn.steer`，原生 Codex 走 `turn/steer`；无原生 steer 保持 THREAD_BUSY（2026-09-02）。

## 2. 验证

- [x] 2.1 聚焦测试：原生 steer 注入同一 Turn、不支持时的 follow-up 回退、follow-up 合并、用户 Stop 丢弃、空闲 steer 即启。
- [x] 2.3 聚焦测试（2026-09-02）：Grok/Pi/OMP 插队后多 Native Turn 仍 succeeded 且 nativeTurnRef 为 prompt 条目；DSH steer 走 prompt mode steer；coordinator/CLI/官方 `--steer` 路径与无原生 steer 的 THREAD_BUSY。
- [x] 2.4 真实 grok 1.0.13 探针（2026-09-02，scratch 会话已删）：`x.ai/interject` → -32601；`_x.ai/interject {sessionId,text}` → `{"result":{"status":"queued"}}`，当前模型响应结束后同一 prompt 内注入，events `interjected redirect_kind=interjection`，仅一条 `turn_completed`；Adapter 假传输按此形态重写，新增终止记录滞后落盘的三条结算用例。
- [x] 2.5 真实二进制插队探针（2026-09-02 14:45 / 18:10 / 19:05，构建后的 Adapter + scratch cwd）：Pi 0.84.4 `steer` 在当前 assistant 轮结束后、同一 agent run 内送达，即使该轮无工具调用也送达并落一条 user entry，`f3b2e58` 只折叠 `stopReason: "toolUse"` 之后的插队曾把 Host Turn 判 failed，1.10 修复后同一探针 succeeded 且快照 1 轮；DSH 0.1.1-rc.2 `session.prompt mode:"steer"` 在下一 step 送达，同一 `turn:1`、单条 `turn/end`；Claude Code 2.1.258 在同一 query 内、工具结束后注入并只产生一条 result，旧 `pendingSteers` 曾让 `turn.completed` 永不到达，1.9 修复后 mid-turn 16.8s 完成、late 插队在第二条 result 后完成；OMP 本机未安装；Cursor 无原生原语，仍为取消后续跑。
- [ ] 2.2 Desktop 正常退出 + `codexhost launch` 激活当前 dist（用户执行）。
