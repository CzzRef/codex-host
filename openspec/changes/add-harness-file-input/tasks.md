## 1. 契约与线上 schema（切片 1，行为零变化）

- [x] 1.1 `packages/harness-adapter/src/text-session.ts`：新增 `HostFileInput`（`type: "file"` / `path` / `mediaType` / `bytes`）与 `HostInput` 联合；`TurnStartCommand.input`、`TurnSteerCommand.input` 改为 `HostInput[]`。
- [x] 1.2 `packages/shared-contracts/src/harness-models.ts`：`harnessSessionCapabilitiesSchema` 新增可选 `input`（`attachFiles` / `mediaTypes?` / `maxBytes?`），保持 `.strict()`。
- [x] 1.3 `packages/harness-broker/src/validation.ts`：新增 `fileInputSchema`（`.strict()`），`turnStartSchema` / `turnSteerSchema` 的 `input` 改为联合数组。
- [x] 1.4 回归：八个适配器不声明能力时，全部既有测试保持通过，纯文本轮次形态不变。
- [x] 1.5 新增 `hostInputText` / `hostInputFiles` 帮助函数，八个适配器与 testing 夹具的 `command.input.map(...).join()` 统一改用它，避免每个适配器各写一次收窄。
- [x] 1.6 切片 1 实现中发现的缺口：`HostTurnSnapshot.input` 与 `AutonomousTurnStartedEvent.input` 仍是 `HostTextInput[]`，历史投影暂时只保留文本部件（antigravity / deepseek-harness / testing 三处已显式过滤并注释）。附件进历史属独立切片，必须在任一适配器声明能力**之前**完成，否则附件会在历史里丢失。**已在本批次补齐**：两处放宽为 `HostInput[]`，三处过滤回退为直通，Codex UI 投影把文件部件渲染为共享的降级文本行。

## 2. Host 侧校验

- [x] 2.1 `validateHostFileInputs()` 落在 `packages/harness-adapter/src/file-input-validation.ts`：绝对路径（含 `..` 上溯拒绝）、位于线程 cwd 内（按分隔符边界比较，`/work/repo-2` 不算在 `/work/repo` 内）、media type 命中 `mediaTypes`、存在且可读、**按实际探测到的字节数**而非部件自称的 `bytes` 比对 `maxBytes`。文件系统访问由调用方以 `probe` 注入，模块本身不引 Node 内建，`harness-adapter` 保持无 Node 依赖。
- [x] 2.2 首个不合格附件即拒绝整轮，返回 `invalidRequest`；有专门用例断言后面的附件不会被单独投出去。
- [x] 2.3 未声明能力、或声明 `attachFiles: false`，携带文件部件的轮次一律整体拒绝；纯文本轮次不受影响。
- [x] 2.4 `packages/harness-adapter/test/file-input-validation.test.ts` 十条用例覆盖上述全部分支，外加同前缀兄弟目录与「自称字节数与实际不符」两种。

## 3. native 级适配器

- [x] 3.1 grok：`acp-transport.ts` 的 `prompt: [{ type: "text", text }]` 扩为 ACP `ContentBlock[]`，文件部件走 `resource_link`（`pathToFileURL` 生成 URI，带 name / mimeType / size）。
- [x] 3.1.1 grok 的 steer 例外：Grok 的 interjection 扩展只收文本，因此**被插队的**附件降级为路径行（`hostInputPromptText`），已启动轮次仍走原生 `resource_link`。这是操作级降级，不是 Session 级；不丢弃。
- [x] 3.2 cursor：同上形态。构造逻辑**各自一份**而非跨包复用——Harness 协议按项目约束留在各自适配器内。cursor 的 steer 是 interrupt-then-re-prompt、走回 `runTurn`，因此被插队的附件保持原生 `resource_link`，不像 grok 那样被迫降级（`pendingSteerFiles` 随 `pendingSteer` 一起排队）。
- [x] 3.3 claude-code：`sdk-transport.ts` 的 `message: { role: "user", content: text }` 扩为内容块数组，图片走 `image`、PDF 走 `document`，均为 base64 源。
- [x] 3.3.1 claude-code 是第一个需要**字节**的适配器：Messages API 不收路径，所以适配器按契约给的路径读盘再编码。这正是决策 1「契约走路径、由适配器各自转换」的兑现点。能力据此声明 `mediaTypes`（jpeg/png/gif/webp/pdf，API 实际接受的全集）与 `maxBytes`（5 MB，取图片侧较紧的那条）。
- [x] 3.3.2 两处防御性降级：不在 `mediaTypes` 内的、以及校验通过后文件消失的，都降级为路径行而不是让整轮失败——Agent 报告文件缺失比传输层报错有用得多。
- [x] 3.4 opencode：`session.promptAsync` 的 `parts` 追加 `FilePartInput`。该类型是 URL 形态（`mime` / `filename` / `url`），所以 Host 路径直接转 `file://`，不读盘也不重编码——与 claude-code 必须读字节形成对照，同一个路径契约在两种原生协议上各走各的最优路径。
- [x] 3.4.1 能力只声明 `attachFiles: true`，不加 `mediaTypes` / `maxBytes`：OpenCode 侧不需要我们代它设限。原计划说取自模型目录的 `capabilities.input`，实测那是**每个模型**的能力而非 Session 能力，与本契约的 Session 级声明不同层，未采用。
- [x] 3.5 四个 native 适配器各有聚焦用例（grok / cursor / claude-code 断言文件部件到达 Transport 或转成原生块，opencode 直测 `openCodeParts`），纯文本轮次形态不变。

## 4. path-text 级适配器

- [x] 4.1 降级格式定为 `[attachment] <path> (<mediaType>, <bytes> bytes)`，由 `hostFileInputLine` / `hostInputPromptText` 独家拥有（切片 1.6 已提前落地，供 Codex UI 投影共用）。原写的「使用户输入无法伪造」是过度承诺，已按实际能力改写：codexhost 只生成、从不解析回文件部件，没有可被骗的解析器；能保证的是路径不引入额外行。
- [x] 4.2 pi：轮次与插队两处改用 `hostInputPromptText`。
- [x] 4.3 omp：同上，两处。
- [x] 4.4 antigravity：stdin 的 `message.content` 走 `hostInputPromptText`。
- [x] 4.5 测试：`hostFileInputLine` 的换行折叠有独立单测；pi 与 omp 各有一条适配器级用例断言原生提示词确实收到路径行；antigravity 只断言能力声明——它的测试要拉起真实 shim 进程、捕获 stdin 成本过高，其降级路径由共享帮助函数的单测覆盖，此处如实记为较弱的一环。

## 5. deepseek-harness

- [x] 5.1 已由 upstream v0.5.0 合并解答：DSH 的轮次口是 `session/prompt`，`commands/execute` 确实只是斜杠命令口。上游把适配器拆成 `legacy/` 与 `modern/` 两代，两代都走 `session/prompt`。
- [x] 5.2 归入 **path-text**：`session/prompt` 的 `content` 只接受文本部件，因此两代都声明 `attachFiles: true` 并把附件降级为路径行；modern 侧的 `promptContent()` 让每个 Host 文本部件仍是独立 wire part。

## 6. 验证与收尾

- [ ] 6.1 全仓类型检查与各包测试。
- [ ] 6.2 真机：至少在一个 native 适配器与一个 path-text 适配器上各跑一次带附件的轮次。
- [ ] 6.3 文档影响：`docs/领域术语表.md` 补附件相关术语；枢纽登记本批次。
- [x] 2.5 接线：`harness-broker` 的 `session.execute` 在 `turn.start` / `turn.steer` 派发前调用校验，`cwd` 取自会话记录、`capability` 取自 `session.capabilities.input`、`probe` 用 `statSync` 判定是文件并取真实大小。
- [ ] 2.6 进程内路径（`app-server-host`）**暂未接线**：它今天只构造纯文本输入，没有任何生产者能产出文件部件，接上去会是一段无法被测试触发的死分支。等 Composer 或其它入口能产出附件时随该入口一起接。
