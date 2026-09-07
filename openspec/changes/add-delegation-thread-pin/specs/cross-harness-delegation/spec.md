## ADDED Requirements

### Requirement: 委派 CLI 置顶与取消置顶外部 Thread
`codexhost thread pin [<thread>]` 与 `codexhost thread unpin [<thread>]` SHALL 把一条 Host 托管的额外进程移入或移出 Desktop 的 Pinned 分区，并由 Host 持久化该状态。省略 `<thread>` 时命令 SHALL 使用 `CODEXHOST_THREAD_ID`。原生 Codex Thread MUST NOT 接受该命令，其置顶权威保持在官方 app-server 的 section。

#### Scenario: 置顶一条外部 Thread
- **WHEN** 调用方对一条 Host 托管的额外进程执行 `codexhost thread pin`
- **THEN** Host SHALL 持久化该 Thread 的 Pinned section 成员身份与 `pinned: true`
- **AND** 结果 SHALL 返回 `{ threadId, pinned: true }`
- **AND** 该 Thread 的 recency MUST NOT 因置顶而改变

#### Scenario: 取消置顶
- **WHEN** 调用方执行 `codexhost thread unpin`
- **THEN** 请求 SHALL 携带 `pinned: false`
- **AND** Host SHALL 清除该 Thread 的 section 成员身份并返回 `{ threadId, pinned: false }`

#### Scenario: 省略标识符时取环境变量
- **WHEN** 调用方在设置了 `CODEXHOST_THREAD_ID` 的环境里不带位置参数执行 `thread pin`
- **THEN** 命令 SHALL 对该环境变量指向的 Thread 生效

#### Scenario: 缺少标识符
- **WHEN** 调用方既未提供位置参数也没有 `CODEXHOST_THREAD_ID`
- **THEN** 命令 SHALL 以 `INVALID_ARGUMENT` 失败
- **AND** MUST NOT 联系 Runtime

#### Scenario: 多于一个位置参数
- **WHEN** 调用方提供了两个及以上 Thread 标识符
- **THEN** 命令 SHALL 以 `INVALID_ARGUMENT` 失败

#### Scenario: 目标不是 Host 托管的额外进程
- **WHEN** 目标是原生 Codex Thread 或不存在
- **THEN** Host SHALL 以 `THREAD_NOT_FOUND` 拒绝

#### Scenario: 非布尔的 pinned
- **WHEN** 控制平面收到的 `pinned` 既不是布尔也不是省略
- **THEN** Host SHALL 以 `INVALID_ARGUMENT` 拒绝

### Requirement: 委托列表透出外部 Thread 的置顶状态
委托列表的外部 Thread 行 SHALL 携带可选布尔字段 `pinned`，取值为 Host 持久化的置顶状态。原生 Codex 行 MUST NOT 携带该字段。`thread/list` SHALL 支持按 `sectionId` 过滤与按 `section_position` 排序，并在无匹配时返回与官方回包一致的空结果形状。

#### Scenario: 置顶行在列表里标记
- **WHEN** 一条外部 Thread 已被置顶且出现在 `thread list` 结果中
- **THEN** 该行 SHALL 返回 `pinned: true`

#### Scenario: 原生行不携带该字段
- **WHEN** 列表结果包含原生 Codex 行
- **THEN** 该行 MUST NOT 包含 `pinned`

#### Scenario: 按分区排序
- **WHEN** 调用方以 `section_position` 为排序键请求 `thread/list`
- **THEN** 结果 SHALL 按分区内位置排序，且不依赖 recency
