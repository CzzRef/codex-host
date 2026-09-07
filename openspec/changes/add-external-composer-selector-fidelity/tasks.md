## 1. 权限选择器可见性

- [x] 1.1 挂载锚点改用 `firstNativePermissionModeButton`，不再要求"恰好一个候选"。
- [x] 1.2 语义核验结果仅写入 `nativePermissionModeControlVerified`，不再作为挂载或可见前提。
- [x] 1.3 新增 `isExternalPermissionModePickerVisible(agent, view)`：非 `codex` 且视图状态不是 `idle` / `loading` / `unsupported` 时可见。
- [x] 1.4 切换目标 Thread 时保留已就绪的权限视图。

## 2. 多余原生按钮

- [x] 2.1 `ComposerAgentControl` 新增 `extraHiddenNativePermissionModeControls`。
- [x] 2.2 锚点之外的原生权限按钮按捕获状态隐藏；不再属于该集合时还原。
- [x] 2.3 还原走既有 `restoreNativeControl`，不改写原生 DOM 结构。

## 3. 模型目录标签

- [x] 3.1 Pi 标签改为 `native.id`。
- [x] 3.2 OMP 标签改为 `native.id`。
- [ ] 3.3 DeepSeek 标签改为 `model.name`，默认模型行改为 `selection.model`。**已被上游回退**：上游 `635a890`（2026-09-03，`refactor(deepseek): 共享跨代模型与命令语义`）把 `packages/adapters/deepseek-harness/src/model-catalog.ts` 的标签重新写回 `${group.name} / ${model.name}` 与 `${selection.provider} / ${selection.model}`，本地 `f5550d9` 对 DeepSeek 的那一半被覆盖。Pi / OMP 两项完好。需重新判定：按本要求补回，还是接受上游形态并撤下该要求。
- [x] 3.4 `ref` 编码不变。

## 4. 验证

- [x] 4.1 `renderer-permission-mode-picker.test.ts`：首轮对话后仍可见、多余原生按钮被隐藏。
- [x] 4.2 `pi-model-catalog.test.ts` / `pi-adapter.test.ts`：标签不含 Provider 前缀。
- [ ] 4.3 `deepseek-harness-adapter.test.ts`：标签为 `model.name`。随 3.3 一并失效。
- [ ] 4.4 真机：Desktop 正常退出 + `codexhost launch` 后，在一条外部 Thread 上完成首轮对话，确认权限选择器仍在且原生按钮不并排出现（用户执行）。
