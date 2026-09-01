## Why

`codexhost thread list` 默认只列调用方 cwd 下的额外进程。EyPc 等跨工具消费者、以及需要在任意工作目录查看全部外部会话的发起方 Agent，无法在不猜测 cwd 的情况下拿到完整列表。Runtime 的 `thread/list` 在省略 cwd 时已经返回全部记录，缺的是 CLI 开关。

## What Changes

- `codexhost thread list` 增加 `--all true|false`。`--all true` 省略 cwd 过滤，列出全部额外进程。`--all true` 不得与 `--cwd` 同时使用。`--all false` 与省略该选项相同，仍默认调用方 cwd。

## Capabilities

### New Capabilities

### Modified Capabilities

- `cross-harness-delegation`: 列举命令支持跨 cwd 的全部额外进程视图。

## Impact

- 委派 CLI 帮助、参数校验与 `/v1/thread/list` 请求体。
- 聚焦测试：`--all true` 省略 cwd；`--all false` 保留 cwd；与 `--cwd` 组合及非法值在联系 Runtime 前失败。
