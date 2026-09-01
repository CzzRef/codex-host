## 1. Runtime 实现

- [x] 1.1 `turn/steer`：立即空结果应答；`turns.steer` 时注入当前 Turn；否则入队并在立即追加时取消当前 Turn；空闲即启；克隆响应抑制；队列满失败。
- [x] 1.2 多条被持有的 `turn/start` 在成功结束后合并为一条后续 Turn，每条 RPC 返回同一 Turn。
- [x] 1.3 用户 `turn/interrupt` 丢弃队列；steer 触发的取消保留队列。
- [x] 1.4 Claude PushableInput 与 Grok 同 Host Turn 续 Prompt 实现 `turn.steer`。

## 2. 验证

- [x] 2.1 聚焦测试：原生 steer 注入同一 Turn、不支持时的 follow-up 回退、follow-up 合并、用户 Stop 丢弃、空闲 steer 即启。
- [ ] 2.2 Desktop 正常退出 + `codexhost launch` 激活当前 dist（用户执行）。
