## 1. CLI

- [x] 1.1 `thread list` 接受 `--all true|false`；`true` 时请求体不带 cwd，且不得与 `--cwd` 组合。
- [x] 1.2 帮助文本说明默认仍为调用方 cwd，`--all true` 列出全部额外进程。

## 2. 验证

- [x] 2.1 聚焦测试：`--all true` 省略 cwd；`--all false` 发送 cwd；非法值与 `--all true --cwd` 在联系 Runtime 前失败。
