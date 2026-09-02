## 1. 契约

- [x] 1.1 `HostItem` 加 `userMessage` 条目；testing fake 支持发出该条目；文档化 id 稳定性要求。
- [x] 1.2 Protocol Core：`projectItem` 支持 `userMessage`，实时与历史投影都产出额外官方 `userMessage` item（id 使用 Host `itemId`，Turn 首条 prompt 仍为 `${turnId}-user`）。

## 2. 历史折叠（每家一条）

- [x] 2.1 Grok：Turn 内 `user.text` → 剥 `<user_query>` 包装 → `userMessage` 条目；无包装保留原文。
- [x] 2.2 Pi / OMP：`stopReason=toolUse` 之后的 user 条目折叠为条目；Fork / rollback 边界跳过折叠条目；结算恢复「恰好一条」（`deliveredSteers` 只进错误文案）。OMP 历史按 Pi 同规则落地。
- [x] 2.3 Claude Code：历史用 `stop_reason=tool_use` 启发式折叠，条目 id 直接取 transcript uuid（实时条目用同一 uuid，无需另行持久化）。
- [x] 2.4 DeepSeek Harness：`user/message` 的 `source.kind` 恒为 `user`（类型 `MessageSourceMap` 无 steer 变体），按事件顺序折叠——同一原生 Turn 内第二条起的 user/message 为插队条目。
- [x] 2.5 Cursor：re-prompt 段在实时路径发 `userMessage` 条目（live-only，无历史）。

## 3. 实时路径

- [x] 3.1 各 adapter 在原生投递插队时发出 `userMessage` 条目（Grok：包装 `user.text` 到达；Pi/OMP：`message_start role=user` 命中 steer 队列；Claude：push 即发出、id=uuid；DSH：同 Turn 内第二条 user/message；Cursor：re-prompt 前发出）。

## 4. 验证

- [x] 4.1 聚焦测试：Grok/Pi/OMP/DSH/Claude 历史折叠 + 五家实时条目 + projector 多 `userMessage`；委派 `thread read --view messages` 靠既有 `userMessage` 投影自动含插队（未单独加用例）。
- [ ] 4.2 Desktop 重载后真机查看插队位置与文本（用户执行）。已在真实 Host 上用委派 CLI 验过一半（2026-09-02 18:5x）：`thread send --steer true` 命中运行中的 Grok Turn，Grok 走原生 `interjected redirect_kind=interjection`，`thread read --view messages` 里插队以未包装原文出现在两段 agent 消息之间；Desktop 视觉位置待看。
