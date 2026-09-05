## Context

八个 Harness 的原生发送口形态差异很大，这决定了契约只能取它们的最小公约数。以下为本仓库实测（`packages/adapters/*/src`）：

| Harness | 原生发送口 | 结构化输入部件 |
| --- | --- | --- |
| grok | ACP `connection.prompt({ sessionId, prompt: [{ type: "text", text }] })` | 有：ACP `ContentBlock[]` |
| cursor | ACP，同上形态 | 有：同上 |
| claude-code | SDK `SDKUserMessage.message = { role: "user", content: text }`，`message: MessageParam` | 有：`MessageParam.content` 可为内容块数组 |
| opencode | SDK `session.promptAsync({ …, parts: [{ type: "text", text }] })` | 有：`parts` 数组；其模型目录本身就带 `capabilities.input.{image,pdf,…}` |
| pi | `#send("prompt", { message: text })` | 无：纯字符串 |
| omp | `#send("prompt", { message: text })` | 无：纯字符串 |
| antigravity | stdin 写入 `{ event: "user", message: { content: text } }` | 无：纯字符串 |
| deepseek-harness | 未测定（`commands/execute` 只收 `line: string`，属斜杠命令口，非轮次口） | 未测定 |

四个有结构化部件、三个只有纯字符串、一个待测。契约必须同时容纳这三类，且不能让第二类静默丢数据。

## Goals / Non-Goals

- Goals：一种输入部件形态覆盖八个 Harness；能力可声明；降级可预期；附件缺失时报错而非沉默。
- Non-Goals：Composer 交互、字节内联、跨机传输、扩大文件系统可达范围。

## Decisions

### 决策 1：以宿主绝对路径引用，不内联字节

`HostFileInput` 携带 `path` 而非 base64。

- **Why**：Broker 的 `textInputSchema` 已把文本上限设为 4 000 000 字符，一张普通截图 base64 后就逼近这个量级；内联会把 JSON-RPC 帧、Mapping Store 记录和历史投影一起撑大。
- **Why**：八个 Harness 全部是本机子进程，与 Host 共享同一个文件系统，路径是无损且零拷贝的句柄。
- **Why**：ACP 本身就有 `resource_link`（URI 形态）承接这种引用；OpenCode 的 `parts` 同样支持文件引用；Claude SDK 的 Agent 有文件读取工具。
- **关键收益**：对纯字符串的三个 Harness，路径可以降级成一行文本，Agent 用自己的读文件工具仍能拿到内容。**降级后仍然可用**，这是内联字节做不到的——内联在纯字符串 Harness 上只能被丢弃。
- **代价**：附件必须在 Agent 读取前一直存在于该路径。Host 校验时刻的存在性不保证投递后仍存在，这一点写进契约由调用方负责。

### 决策 2：能力位可选，缺省即纯文本

`harnessSessionCapabilitiesSchema` 新增 `input` 段并标记 `.optional()`：

- 缺省（不填）等价于「只接受文本」，八个适配器一行不改也不会失败。
- 填了才进入附件路径。这样切片可以逐个适配器推进，不需要一次性改完八个。
- `mediaTypes` 缺省表示不限制；`maxBytes` 缺省表示适配器不额外设限。

### 决策 3：三级投递，禁止静默丢弃

| 级别 | 适用 | 行为 |
| --- | --- | --- |
| `native` | grok / cursor / claude-code / opencode | 转成原生结构化部件投递 |
| `path-text` | pi / omp / antigravity | 追加一行确定性文本引用该绝对路径，与用户文本一同发出 |
| `rejected` | 未声明 `input.attachFiles` 的适配器 | Host 在派发前以 `invalidRequest` 拒绝整个轮次 |

静默丢弃被明确禁止：用户以为发出去了、Agent 从未见到，是比报错更糟的失败形态。`path-text` 之所以可接受，是因为它把附件降级成 Agent **仍能自己取到**的形式，而不是降级成无。

### 决策 4：Host 侧在派发前校验

路径必须是绝对路径、存在、可读、且位于允许根内（线程 cwd，或 Host 指定的附件暂存目录）。不满足则整轮 `invalidRequest`，不做部分投递。

这不是安全边界——Agent 本来就有文件系统访问权，附件不扩大它的可达范围。它的作用是把「路径写错」变成一条清楚的错误，而不是让 Agent 去猜一个读不到的路径。

## Risks / Trade-offs

- **风险：`path-text` 的文本注入**。降级文本会拼进用户提示词。必须用固定的、不可被用户文本伪造的格式，并对路径做转义；否则用户可以手打一行伪造的附件引用。缓解：格式与转义写进 spec 的 Scenario，并加针对性测试。
- **风险：附件在投递后被删除**。契约声明存在性只在校验时刻成立，Agent 读不到时按普通文件缺失处理。
- **权衡：不内联字节意味着远程 Harness 用不了**。当前八个都是本机子进程，可接受；将来若有远程 Harness，需要另加一种字节承载部件，届时 `HostFileInput` 的联合形态可以自然扩展。
- **未测定项：deepseek-harness**。先按 `rejected` 落地，探明轮次口后再决定归入哪一级。

## Migration Plan

1. 切片 1：契约 + Broker schema + 能力位，所有适配器保持不声明能力，行为与今天完全一致。
2. 切片 2：四个 `native` 适配器逐个落地，每个独立可验证。
3. 切片 3：三个 `path-text` 适配器落地。
4. 切片 4：探测 deepseek-harness 轮次口并归级。
5. 切片 5（本变更之外）：Composer 附件入口。

## Open Questions

- 附件暂存目录由谁拥有？Composer 切片才会产生真实需求，切片 1 先只允许线程 cwd 内的路径。
- `path-text` 的降级文本要不要对用户可见？倾向于可见，否则用户无法解释 Agent 为什么在读文件。
