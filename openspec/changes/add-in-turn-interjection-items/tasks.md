## 1. 契约

- [ ] 1.1 `HostItem` 加 `userMessage` 条目；testing fake 支持发出该条目；文档化 id 稳定性要求。
- [ ] 1.2 Protocol Core：`projectItem` 支持 `userMessage`，实时与历史投影都产出额外官方 `userMessage` item（id `${turnId}-user-<n>`）。

## 2. 历史折叠（每家一条）

- [ ] 2.1 Grok：Turn 内 `user.text` → 剥 `<user_query>` 包装 → `userMessage` 条目；无包装保留原文。
- [ ] 2.2 Pi / OMP：`stopReason=toolUse` 之后的 user 条目折叠为条目；Fork / rollback 边界跳过折叠条目；撤回或收紧 `1 + deliveredSteers` 放宽。
- [ ] 2.3 Claude Code：持久化 steer `uuid`，历史按 uuid 折叠，缺失时用 tool_use 启发式。
- [ ] 2.4 DeepSeek Harness：实测 steer 的 `source.kind` 并折叠。
- [ ] 2.5 Cursor：re-prompt 段在实时路径发 `userMessage` 条目。

## 3. 实时路径

- [ ] 3.1 各 adapter 在原生投递插队时发出 `userMessage` 条目（Grok：包装 `user.text` 到达；Pi：`message_start role=user` 命中 steer 队列；Claude：pushed uuid 出现；DSH：steer 来源消息；Cursor：re-prompt）。

## 4. 验证

- [ ] 4.1 聚焦测试：每家历史折叠 + 实时条目顺序 + projector 多 `userMessage` 稳定 id；委派 `thread read --view messages` 按顺序含插队。
- [ ] 4.2 Desktop 重载后真机查看插队位置与文本（用户执行）。
