## 1. 契约与线上 schema（切片 1，行为零变化）

- [x] 1.1 `packages/harness-adapter/src/text-session.ts`：新增 `HostFileInput`（`type: "file"` / `path` / `mediaType` / `bytes`）与 `HostInput` 联合；`TurnStartCommand.input`、`TurnSteerCommand.input` 改为 `HostInput[]`。
- [x] 1.2 `packages/shared-contracts/src/harness-models.ts`：`harnessSessionCapabilitiesSchema` 新增可选 `input`（`attachFiles` / `mediaTypes?` / `maxBytes?`），保持 `.strict()`。
- [x] 1.3 `packages/harness-broker/src/validation.ts`：新增 `fileInputSchema`（`.strict()`），`turnStartSchema` / `turnSteerSchema` 的 `input` 改为联合数组。
- [x] 1.4 回归：八个适配器不声明能力时，全部既有测试保持通过，纯文本轮次形态不变。
- [x] 1.5 新增 `hostInputText` / `hostInputFiles` 帮助函数，八个适配器与 testing 夹具的 `command.input.map(...).join()` 统一改用它，避免每个适配器各写一次收窄。
- [x] 1.6 切片 1 实现中发现的缺口：`HostTurnSnapshot.input` 与 `AutonomousTurnStartedEvent.input` 仍是 `HostTextInput[]`，历史投影暂时只保留文本部件（antigravity / deepseek-harness / testing 三处已显式过滤并注释）。附件进历史属独立切片，必须在任一适配器声明能力**之前**完成，否则附件会在历史里丢失。**已在本批次补齐**：两处放宽为 `HostInput[]`，三处过滤回退为直通，Codex UI 投影把文件部件渲染为共享的降级文本行。

## 2. Host 侧校验

- [ ] 2.1 派发前校验：绝对路径、存在、可读、位于线程 cwd 内、不超 `maxBytes`、media type 命中 `mediaTypes`。
- [ ] 2.2 任一项失败以 `invalidRequest` 拒绝整轮，不做部分投递。
- [ ] 2.3 目标 Session 未声明能力却收到文件部件时拒绝，且不得剥掉附件后只投文本。
- [ ] 2.4 测试覆盖：相对路径、不存在、越出 cwd、超限、media type 不匹配、能力未声明。

## 3. native 级适配器

- [x] 3.1 grok：`acp-transport.ts` 的 `prompt: [{ type: "text", text }]` 扩为 ACP `ContentBlock[]`，文件部件走 `resource_link`（`pathToFileURL` 生成 URI，带 name / mimeType / size）。
- [x] 3.1.1 grok 的 steer 例外：Grok 的 interjection 扩展只收文本，因此**被插队的**附件降级为路径行（`hostInputPromptText`），已启动轮次仍走原生 `resource_link`。这是操作级降级，不是 Session 级；不丢弃。
- [ ] 3.2 cursor：同上形态，与 grok 复用同一套构造逻辑。
- [ ] 3.3 claude-code：`sdk-transport.ts` 的 `message: { role: "user", content: text }` 扩为内容块数组，图片与文档各走对应块。
- [ ] 3.4 opencode：`session.promptAsync` 的 `parts` 追加文件部件；能力声明取自其模型目录已有的 `capabilities.input`。
- [ ] 3.5 每个适配器各自的聚焦测试：结构化部件确实到达原生调用，且纯文本轮次不受影响。

## 4. path-text 级适配器

- [ ] 4.1 确定降级文本的固定格式与路径转义规则，使用户输入无法伪造成附件引用。
- [ ] 4.2 pi：`#send("prompt", { message })` 前拼接降级文本。
- [ ] 4.3 omp：同上。
- [ ] 4.4 antigravity：stdin 的 `message.content` 前拼接降级文本。
- [ ] 4.5 针对性测试：伪造尝试不被识别为附件引用；降级文本对用户可见。

## 5. deepseek-harness

- [ ] 5.1 探明其轮次提交口（`commands/execute` 只收 `line: string`，属斜杠命令口，非轮次口）。
- [ ] 5.2 按探测结果归入 native 或 path-text；在此之前保持 `rejected`。

## 6. 验证与收尾

- [ ] 6.1 全仓类型检查与各包测试。
- [ ] 6.2 真机：至少在一个 native 适配器与一个 path-text 适配器上各跑一次带附件的轮次。
- [ ] 6.3 文档影响：`docs/领域术语表.md` 补附件相关术语；枢纽登记本批次。
