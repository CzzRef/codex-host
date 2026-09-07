## ADDED Requirements

### Requirement: 模型目录标签只标识 Model
Harness 模型目录条目的 `label` SHALL 只呈现 Model 的名称，MUST NOT 在其中拼接 Provider、Account 或 Harness 名。目录条目的 `ref` 编码不属于本要求，保持不变。

#### Scenario: Pi 与 OMP 的标签
- **WHEN** Pi 或 OMP 适配器投影模型目录
- **THEN** 条目 `label` SHALL 为 `native.id`
- **AND** MUST NOT 形如 `<provider> / <id>`

#### Scenario: DeepSeek Harness 的标签
- **WHEN** DeepSeek Harness 适配器投影模型目录
- **THEN** 条目 `label` SHALL 为 `model.name`
- **AND** 默认模型行的 `label` SHALL 为 `selection.model`

#### Scenario: 选择恢复不受标签影响
- **WHEN** 一条已有 Thread 按持久化的模型选择恢复
- **THEN** 恢复 SHALL 依据 `ref`，MUST NOT 依赖 `label` 文案
