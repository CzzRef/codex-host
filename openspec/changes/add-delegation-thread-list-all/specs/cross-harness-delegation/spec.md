## MODIFIED Requirements

### Requirement: Thread 观察与列举命令接受用户提供的标识并覆盖两类 Thread
Thread 观察命令 SHALL 接受裸 Thread 标识与 Codex 深度链接两种形式，并可作用于外部 Harness Thread 与原生 Codex Thread，不限于调用方自己委派产生的 Thread。对原生 Codex Thread 的读取与等待 SHALL 通过对官方 App Server 的带外请求实现，且 MUST NOT 改变该 Thread 的状态。`codexhost thread list [--cwd <path>] [--all true|false] [--parent <thread>] [--limit <n>] [--cursor <cursor>] [--sort created-asc|created-desc|updated-asc|updated-desc|recency-asc|recency-desc]` SHALL 返回结构化会话页；`--parent` SHALL 只列举该父 Thread 的 Delegation 子 Thread。`--all true` SHALL 省略 cwd 过滤并列出全部额外进程，且 MUST NOT 与 `--cwd` 同时使用；省略 `--all` 或 `--all false` SHALL 继续默认限定在调用方 cwd。

#### Scenario: 列举会话
- **WHEN** 调用方未指定 `--cwd`、`--all`、`--limit` 或 `--sort`
- **THEN** 列举 SHALL 默认限定在调用方自身的工作目录、默认返回最多 25 条并按 `created-desc` 排序
- **AND** `--limit` SHALL 被限制为最多 100 条
- **AND** 响应 SHALL 包含 `threads` 与可选 `nextCursor`

#### Scenario: 列举全部额外进程
- **WHEN** 调用方执行 `codexhost thread list --all true`
- **THEN** 请求 MUST NOT 携带 cwd 过滤
- **AND** 结果 SHALL 包含各 cwd 下的额外进程（仍受 limit/cursor/sort 约束）

#### Scenario: 全部列举不得与 cwd 组合
- **WHEN** 调用方同时提供 `--all true` 与 `--cwd`
- **THEN** 命令 SHALL 以可辨识的参数错误失败
- **AND** MUST NOT 联系 Runtime
