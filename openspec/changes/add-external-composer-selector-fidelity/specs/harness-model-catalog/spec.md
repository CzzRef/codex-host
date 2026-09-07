## ADDED Requirements

### Requirement: 模型标签以 Harness 缩写为前缀
Host 投影给消费者的模型目录，其每条 `label` SHALL 形如 `<abbr>·<Model 名>`，其中 `<abbr>` 是该 Harness 的小写缩写、`·` 是 `HARNESS_MODEL_LABEL_SEPARATOR`。`label` MUST NOT 携带 Provider、Account 或 Harness 全名——Provider 归属另有其位，`ref` 才是模型身份的权威编码。

前缀 SHALL 由 Host 在已知 `harnessId` 的投影处统一施加，MUST NOT 由各 Adapter 各自拼接：Adapter 只产出 Model 名，新增 Harness 因而无需改动自身代码即可获得前缀。施加过程 SHALL 幂等——同一份目录经过两次投影 MUST NOT 得到叠加的前缀。

#### Scenario: 目录经 Host 投影后带上前缀
- **WHEN** 消费者对 `deepseek-harness` 请求 `harness/inspect`，Adapter 返回标签为 `DeepSeek V4 Flash` 的条目
- **THEN** 投影结果中该条目的 `label` SHALL 为 `ds·DeepSeek V4 Flash`

#### Scenario: 委派 CLI 与 Desktop 看到同一形态
- **WHEN** 调用方经委派控制平面 `inspect` 读取同一 Harness 的目录
- **THEN** 标签 SHALL 与 Desktop 侧一致地带同一前缀

#### Scenario: 重复投影不叠加
- **WHEN** 一份已带前缀的目录再次经过投影
- **THEN** `label` MUST NOT 变成 `pi·pi·…`

#### Scenario: 标签不再携带 Provider
- **WHEN** 多 Provider 路由型 Harness（DeepSeek Harness、OpenCode）投影目录
- **THEN** 条目 `label` SHALL 只含 Model 名
- **AND** 同名跨 Provider 的条目 MAY 呈现为文案相同的多行，其区分依据 SHALL 是 `ref`

#### Scenario: 非 ready 的检查结果不被改写
- **WHEN** `harness/inspect` 返回的状态不是 `ready`
- **THEN** 投影 MUST NOT 修改该结果

### Requirement: 每个 Harness 声明自己的缩写
缩写表 SHALL 是唯一权威，取值 SHALL 为 2–3 个小写字母且互不重复。当前八家的取值 SHALL 为 `antigravity=ag`、`claude-code=cc`、`cursor=cs`、`deepseek-harness=ds`、`grok=gk`、`omp=omp`、`opencode=oc`、`pi=pi`。新增 Harness SHALL 在该表登记一条；回归测试 SHALL 对预装清单里每个插件断言其存在。表中没有的 Harness SHALL 回退到确定性派生（复合名取各段首字母，单段名取前两字母，长度不超过 3），派生 MUST NOT 抛错。

#### Scenario: 预装 Harness 必须有登记
- **WHEN** `scripts/release/harness-plugins.json` 列出的插件的 `manifest.json` 声明了某个 `id`
- **THEN** 缩写表 SHALL 含有该 `id` 的条目

#### Scenario: 未登记的 Harness 仍可用
- **WHEN** 一个尚未登记的 Harness 投影目录
- **THEN** 实现 SHALL 按派生规则给出可用前缀，MUST NOT 使目录失败

### Requirement: 会话状态的已解析模型标签同样带前缀
Host 投影的会话状态字段 `resolvedModelLabel` SHALL 与目录标签用同一前缀规则，使同一个模型在选择器与委派输出里的称呼一致。施加同样 SHALL 幂等。

#### Scenario: 线程检查应答
- **WHEN** 消费者对一条外部 Thread 请求 `thread/inspect`，其会话状态的 `resolvedModelLabel` 为 `Fake Secondary`，Harness 为 `pi`
- **THEN** 投影结果 SHALL 为 `pi·Fake Secondary`

#### Scenario: 选择应答
- **WHEN** Model、Thinking 或 Permission Mode 选择成功后 Host 投影新的会话状态
- **THEN** 其中的 `resolvedModelLabel` SHALL 带同一前缀

#### Scenario: 委派输出
- **WHEN** 委派控制平面返回 `configuration.effective`
- **THEN** 其 `resolvedModelLabel` SHALL 带同一前缀
