## Why

用户在 codexhost 的 Grok 线程里发现传不了文件，直觉归因到 Grok。实测下来与 Grok 无关：Host↔Harness 契约的轮次输入只有一种部件，`HostTextInput = { type: "text"; text: string }`，`TurnStartCommand.input` 与 `TurnSteerCommand.input` 都是 `HostTextInput[]`；Broker 线上 schema 的 `turnStartSchema` 是 `.strict()` 且 `input: z.array(textInputSchema)`，多出来的字段会被拒绝而不是忽略；`harnessSessionCapabilitiesSchema` 同样 `.strict()`，字段只有 configuration / history / subagents / autonomousTurns / turns，**没有任何一位可以让适配器声明自己支持附件**。

也就是说八个 Harness 全都传不了文件，不是某一个的缺陷。反而 Grok 是媒体支持最完整的适配器——它已经用 `HostToolOutput.content` 的 `image` 部件往外吐图，还独有 321 行的 `local-media-markdown.ts` 把产出的媒体路径解析到 cwd / session 目录 / `~/Downloads`。缺的只有输入方向。

## What Changes

- 输入部件从「只有文本」扩为可辨识联合：新增 `HostFileInput`，以**宿主绝对路径**引用文件，不内联字节。
- 能力矩阵新增可选的 `input` 段，适配器据此声明是否接受附件、接受哪些 media type、单文件上限。缺省不填即维持纯文本，八个适配器无需改动即可继续工作。
- 定义三级投递策略：原生结构化部件 / 降级为路径文本 / 明确拒绝。**任何一级都不允许静默丢弃附件。**
- Broker 线上 schema、Host 侧校验、以及四个具备原生结构化输入能力的适配器落地。

## Non-goals

- 不做 Composer 的上传交互。Composer 是 Codex Desktop 自己的 DOM，codexhost 靠 `renderer-composer-dom.ts` 挂入；渲染层的附件入口是后续切片。
- 不内联 base64 字节，不引入附件对象存储，不做跨机传输。
- 不扩大 Agent 的文件系统可达范围——附件只是把一个 Agent 本来就能读到的路径指给它。

## Capabilities

### New Capabilities

- `harness-adapter-file-input`：轮次输入携带文件部件的契约、能力声明与降级策略。

### Modified Capabilities

- `harness-adapter-text-session`：Session 接受的输入从纯文本放宽为文本加可选文件部件；文本部件的既有语义不变。

## Impact

- `packages/harness-adapter`：`HostTextInput` 之外新增 `HostFileInput`，`TurnStartCommand` / `TurnSteerCommand` 的 `input` 改为联合数组。
- `packages/shared-contracts`：`harnessSessionCapabilitiesSchema` 新增可选 `input` 段。
- `packages/harness-broker`：`textInputSchema` 旁新增 `fileInputSchema`，`turnStartSchema` / `turnSteerSchema` 接受联合；`.strict()` 保持不变。
- `packages/adapters/{grok,cursor,claude-code,opencode}`：原生结构化投递。
- `packages/adapters/{pi,omp,antigravity}`：降级为路径文本。
- `packages/adapters/deepseek-harness`：投递口未测定，先按拒绝处理，另行探测。
- 不改 Mapping Store 格式，不改官方 app-server 透传。
