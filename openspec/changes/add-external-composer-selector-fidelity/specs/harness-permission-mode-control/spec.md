## ADDED Requirements

### Requirement: 外部权限选择器的可见性不依赖原生 DOM 核验
注入的外部权限模式选择器 SHALL 在目标不是原生 `codex`、且 Host 的权限模式视图状态不是 `idle`、`loading` 或 `unsupported` 时可见。选择器的挂载锚点 SHALL 取 Composer 中第一个原生权限按钮；原生按钮的语义核验结果 SHALL 只记录为诊断状态（`nativePermissionModeControlVerified`），MUST NOT 作为挂载或可见的前提。

#### Scenario: 首轮对话之后仍可用
- **WHEN** 一条外部 Harness Thread 完成首轮对话，Composer 中出现了多于一个原生权限按钮
- **THEN** 外部权限选择器 SHALL 保持可见并可操作
- **AND** `nativePermissionModeControlVerified` SHALL 记为 `false`，但不影响可见性

#### Scenario: 视图未就绪时不显示
- **WHEN** Host 权限模式视图状态为 `idle`、`loading` 或 `unsupported`
- **THEN** 外部权限选择器 MUST NOT 可见

#### Scenario: 原生 Codex 目标不注入
- **WHEN** 当前目标是原生 `codex`
- **THEN** 外部权限选择器 MUST NOT 可见

#### Scenario: 切换目标保留已就绪视图
- **WHEN** 用户在两个外部 Thread 之间切换，且新目标的权限视图已就绪
- **THEN** 选择器 SHALL 保持可见，MUST NOT 因切换而回到未就绪状态

### Requirement: 隐藏 Composer 上多余的原生权限按钮
除挂载锚点外，同一 Composer 中其余的原生权限按钮 SHALL 被捕获并隐藏，因为它们对外部 Thread 无效。当某个按钮不再属于该集合时，实现 SHALL 按捕获状态还原它，MUST NOT 改写原生 DOM 结构。

#### Scenario: 多余按钮被隐藏
- **WHEN** Composer 中存在两个及以上原生权限按钮，且当前目标是外部 Thread
- **THEN** 锚点之外的按钮 SHALL 被隐藏

#### Scenario: 不再多余时还原
- **WHEN** 一个此前被隐藏的原生权限按钮不再属于多余集合
- **THEN** 实现 SHALL 把它还原到捕获时的状态
