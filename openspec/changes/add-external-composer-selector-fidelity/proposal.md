## Why

Composer 上给外部 Harness Thread 用的两个选择器都在展示错的东西。

**权限模式选择器**：注入的外部权限控件此前只在 Renderer 能"语义核验"原生权限按钮时才挂载——要求 Composer 里恰好有一个 `button[aria-haspopup="menu"][data-composer-navigation-target="permissions"]` 且通过候选校验。首轮对话之后 Desktop 会在同一 Composer 里留下第二个原生权限按钮，核验因此从"恰好一个"落空，外部权限控件直接消失；切换目标 Thread 时同样会把已就绪的视图清掉。结果是用户开完第一轮就再也改不了外部会话的权限模式，而 Composer 上还并排留着一个对外部 Thread 无效的原生按钮。

**模型目录标签**：Pi / OMP 的模型标签拼的是 `${native.provider} / ${native.id}`，DeepSeek 拼的是 `${group.name} / ${model.name}`。选择器里于是出现 `openai-codex / gpt-5.6-sol` 这样的文案，把 Provider 塞进了本该只标识 Model 的位置——[领域术语表](../../../docs/领域术语表.md)明确要求不把 Harness / Model / Provider / Account 混为一谈，而 Provider 归属另有其展示位。

## What Changes

- 外部权限选择器的**挂载位置**与**核验**解耦：取 Composer 里第一个原生权限按钮作为插入锚点（`firstNativePermissionModeButton`），语义核验结果只写进 `nativePermissionModeControlVerified` 供诊断使用，不再作为挂载前提。
- 新增 `isExternalPermissionModePickerVisible(agent, view)`：非 `codex` 目标且视图状态不是 `idle` / `loading` / `unsupported` 时，外部权限控件 SHALL 可见——可见性由 Host 权限模式视图的就绪状态决定，与 DOM 核验无关。
- 同一 Composer 里锚点之外的多余原生权限按钮由 `extraHiddenNativePermissionModeControls` 捕获并隐藏，切换目标或按钮消失时按捕获状态还原，不破坏原生 DOM。
- 模型目录标签只呈现 Model 名：Pi / OMP 用 `native.id`，DeepSeek 用 `model.name`，默认模型行用 `selection.model`。不再在标签里拼 Provider。

## Non-goals

- 不改 Harness 权限模式的线上 id 与传输语义（那是权限模式统一词表的范围）。
- 不改模型目录的 `ref` 编码，只改 `label`。
- 不新增 Provider 的独立展示位。

## Capabilities

### New Capabilities

### Modified Capabilities

- `harness-permission-mode-control`: 外部权限选择器的可见性由 Host 视图就绪状态决定，多余原生按钮被隐藏并可还原。
- `harness-model-catalog`: 目录标签只标识 Model。

## 现状偏差（2026-09-07 实测）

模型目录标签这一半**只有 Pi / OMP 仍然成立**。上游 `635a890`（2026-09-03，`refactor(deepseek): 共享跨代模型与命令语义`）把 DeepSeek 的标签重新写回 `${group.name} / ${model.name}` 与 `${selection.provider} / ${selection.model}`，覆盖了本地 `f5550d9` 对 DeepSeek 的改动。本变更包记录该要求的原貌，任务 3.3 / 4.3 相应改回未完成；是补回还是接受上游形态，按 [自研功能清单](../../../docs/czz-dev-自研功能清单.md) 第 2 节的判定口径另行裁决。

权限选择器那一半的现行代码完好：`isExternalPermissionModePickerVisible` 与 `extraHiddenNativePermissionModeControls` 均在 `renderer-composer-dom.ts` 中且已导出。

## Impact

- Renderer `renderer-composer-dom.ts`（锚点、可见性判定、多余按钮的捕获/隐藏/还原）、`renderer-binding-probe.ts`、`index.ts` 导出。
- Adapters `pi-model-catalog.ts`、`omp-model-catalog.ts`、`deepseek-harness/model-catalog.ts`。
- 聚焦测试：`renderer-permission-mode-picker.test.ts`、`pi-model-catalog.test.ts`、`pi-adapter.test.ts`、`deepseek-harness-adapter.test.ts`。
- 兼容性：标签是纯呈现值，已有 Thread 的模型选择按 `ref` 恢复，不受影响。
