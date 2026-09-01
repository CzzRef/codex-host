## 1. Runtime 实现

- [x] 1.1 `turn/steer` 对外部 Thread：立即空结果应答 + 消息以 null-id 克隆入 follow-up 队列（运行中排队、空闲即启）；克隆的后续响应全部抑制；队列满显式失败。
- [x] 1.2 首版「延迟应答」实测会冻结 Desktop composer（追加一次后输入栏卡死），已改为即时应答语义。

## 2. 验证

- [x] 2.1 聚焦测试：连续两次 steer 均即时应答、消息按序成轮、空闲即启；官方转发零泄漏。
- [x] 2.2 聚焦 `queues turn/start and turn/steer` 通过；rename 控制面落地后 `tsc -b` 已绿。
- [ ] 2.3 Desktop 正常退出 + `codexhost launch` 激活当前 dist（用户执行）。
