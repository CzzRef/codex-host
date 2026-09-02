## Why

插队（Desktop Composer 的 steer / 立即追加、委派 CLI `thread send --steer true`）在实时路径上已经是「同一条 Host Turn 内继续」：`turn/steer` 立即应答、不开新 Turn。但落盘后的历史投影各家不一致：Grok 把插队的合成 user 消息（带 `The user sent a message while you were working:\n<user_query>…</user_query>` 包装）直接拼进 Turn input；Pi / OMP / Claude Code 的历史映射一遇到人类 user 消息就切出一条新 Host Turn；DeepSeek Harness 只收 `source.kind=user` 的消息。重载或 `thread read` 之后，用户看不出插队发生在哪一步，包装文本还会原样露出。

用户裁决（2026-09-02）：**同轨**。插队属于它所进入的那条 Host Turn，在所有 Harness 上都以 Turn 内的用户条目出现在它实际送达的位置；不再切新 Turn，也不再拼进 input。

## What Changes

- `HostItem` 新增 `userMessage` 条目（`{ type: "userMessage", itemId, text }`）。实时路径上，adapter 在原生真正投递插队时发出 `item.started` + `item.completed`；历史路径上，各 Harness 的 history 映射把插队条目折回它所属的 Host Turn。
- Protocol Core 投影：Turn 的首条 `userMessage` 仍由 Turn input 生成（id `${turnId}-user`）；Turn 内的插队条目投影为额外的官方 `userMessage` item，id 与顺序保持稳定，Desktop 与委派 `thread read --view messages` 按时间顺序看到它。
- 各 Harness 的历史折叠规则：
  - Grok：Turn 进行中再出现的 `user.text` 是插队；剥掉 `<user_query>` 包装取内文，识别不到包装时保留原文。
  - Pi / OMP：紧跟在 `stopReason=toolUse` 的 assistant 条目之后的 user 条目是插队（steer 在工具调用结束、下一次模型调用前投递）；紧跟 `stop` 之后的才是新 prompt。
  - Claude Code：adapter 记住它通过 PushableInput 推送的 steer `uuid`，随 Turn 身份持久化；历史映射按 uuid 折叠，缺失时回退到「前一条 assistant 仍有未回填的 tool_use」启发式。
  - DeepSeek Harness：实测 steer 消息的 `source.kind`（当前只收 `user`），把 steer 来源折叠为 Turn 内条目。
  - Cursor：原生 `acp-sessions` 历史按 user/assistant 对投影；实时打断-重载的第二段 prompt 仍作为同一 Host Turn 的 `userMessage` 条目发出，历史折叠留给本变更。
- 结算与边界：折叠后一条 Host Turn 在 Pi / OMP 历史里重新回到「恰好一条」，`1 + deliveredSteers` 的放宽退回为兼容容差或移除；Fork / 回滚 / Redo 的边界只认 prompt 条目，跳过折叠进 Turn 的插队条目。

## Capabilities

### New Capabilities

### Modified Capabilities

- `harness-adapter-text-session`：新增 Turn 内 `userMessage` 条目与其生命周期。
- `registered-harness-routing`：外部 Thread 的插队在实时与历史两条路径上都保持同一 Host Turn，并以 Turn 内用户条目投影。

## Impact

- `packages/harness-adapter`（HostItem 联合体、testing fake）、`packages/protocol-core`（projector）、五个 adapter 的 history / 实时映射、`packages/host-runtime`（Claude steer id 持久化、Fork/回滚边界）、Desktop 重载后的实际显示（待真机验收）。
- 关联：[add-external-turn-steer-queue](../add-external-turn-steer-queue/proposal.md)（实时路径），1400 任务卡列出的 out-of-scope 项「历史映射把插队包装文本拼进 Turn input」由本变更接手。
