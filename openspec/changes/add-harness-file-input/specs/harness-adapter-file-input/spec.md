## ADDED Requirements

### Requirement: Turn input is a discriminated union of text and file parts

`TurnStartCommand.input` 与 `TurnSteerCommand.input` SHALL 接受文本部件与文件部件构成的可辨识联合数组。文件部件 SHALL 以宿主绝对路径引用文件，SHALL NOT 内联文件字节。文本部件的既有形态与语义 SHALL 保持不变。

#### Scenario: Text-only input keeps today's shape

- **WHEN** 一个轮次只携带文本部件
- **THEN** 契约形态与线上 schema 与本变更之前完全一致
- **AND** 未声明附件能力的适配器行为不发生任何改变

#### Scenario: File part references an absolute path

- **WHEN** 一个轮次携带文件部件
- **THEN** 该部件 SHALL 提供宿主绝对路径、media type 与字节数
- **AND** SHALL NOT 携带 base64 或其它内联字节表示

#### Scenario: Wire schema stays strict

- **WHEN** Broker 校验一个携带文件部件的轮次
- **THEN** 文件部件 schema SHALL 保持 `.strict()`
- **AND** 未知字段 SHALL 被拒绝而不是被忽略

### Requirement: Harnesses declare file input capability

`HarnessSessionCapabilities` SHALL 新增可选的 `input` 段，用于声明该 Session 是否接受文件部件、接受哪些 media type、单文件字节上限。缺省未声明 SHALL 等价于只接受文本。

#### Scenario: Adapter does not declare the capability

- **WHEN** 一个适配器未声明 `input`
- **THEN** Host SHALL 视其为只接受文本
- **AND** 该适配器无需任何改动即可继续工作

#### Scenario: Adapter declares accepted media types

- **WHEN** 一个适配器声明了 `input.mediaTypes`
- **THEN** Host SHALL 只投递匹配其中之一的文件部件
- **AND** 未声明 `mediaTypes` SHALL 表示不限制 media type

#### Scenario: Adapter declares a size ceiling

- **WHEN** 一个附件的字节数超过该适配器声明的 `input.maxBytes`
- **THEN** Host SHALL 拒绝该轮次并给出包含该上限的错误

### Requirement: File parts are never silently dropped

Host 与适配器 SHALL 按 `native`、`path-text`、`rejected` 三级之一投递每个文件部件，并且 SHALL NOT 在任何一级静默丢弃附件。

#### Scenario: Native structured delivery

- **WHEN** 适配器的原生协议接受结构化输入部件
- **THEN** 适配器 SHALL 把文件部件转成原生结构化部件投递

#### Scenario: Degrade to a path reference for text-only harnesses

- **WHEN** 适配器的原生协议只接受纯字符串提示词
- **THEN** 适配器 SHALL 把文件部件降级为一行确定性文本引用该绝对路径，与用户文本一同发出
- **AND** 该降级文本 SHALL 使用固定格式并对路径转义，使用户输入无法伪造成附件引用

#### Scenario: Reject rather than drop

- **WHEN** 一个轮次携带文件部件而目标 Session 未声明附件能力
- **THEN** Host SHALL 以 `invalidRequest` 拒绝整个轮次
- **AND** SHALL NOT 剥掉文件部件后只投递文本

### Requirement: Host validates attachment paths before dispatch

Host SHALL 在派发前校验每个文件部件：绝对路径、存在、可读、位于允许根内、且未超出适配器声明的上限。任何一项不满足 SHALL 拒绝整个轮次，SHALL NOT 部分投递。

#### Scenario: Relative or missing path

- **WHEN** 文件部件的路径不是绝对路径，或校验时刻不存在
- **THEN** Host SHALL 以 `invalidRequest` 拒绝该轮次

#### Scenario: Path outside the allowed root

- **WHEN** 文件部件的路径不在线程 cwd 内
- **THEN** Host SHALL 拒绝该轮次
- **AND** 该校验 SHALL NOT 被表述为对 Agent 文件系统可达范围的限制

#### Scenario: Attachment disappears after validation

- **WHEN** 附件在校验通过之后、Agent 读取之前被删除
- **THEN** 契约 SHALL 只保证校验时刻的存在性
- **AND** Agent SHALL 按普通文件缺失处理
