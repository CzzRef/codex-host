## 1. 权限选择器可见性

- [x] 1.1 挂载锚点改用 `firstNativePermissionModeButton`，不再要求"恰好一个候选"。
- [x] 1.2 语义核验结果仅写入 `nativePermissionModeControlVerified`，不再作为挂载或可见前提。
- [x] 1.3 新增 `isExternalPermissionModePickerVisible(agent, view)`：非 `codex` 且视图状态不是 `idle` / `loading` / `unsupported` 时可见。
- [x] 1.4 切换目标 Thread 时保留已就绪的权限视图。

## 2. 多余原生按钮

- [x] 2.1 `ComposerAgentControl` 新增 `extraHiddenNativePermissionModeControls`。
- [x] 2.2 锚点之外的原生权限按钮按捕获状态隐藏；不再属于该集合时还原。
- [x] 2.3 还原走既有 `restoreNativeControl`，不改写原生 DOM 结构。

## 3. 模型标签的 Harness 缩写前缀

- [x] 3.1 新增 `shared-contracts/src/harness-model-label.ts`：缩写表、分隔符 `·`、`harnessModelLabelAbbreviation()`、`harnessModelLabelPrefix()`、`isHarnessModelLabelPrefixed()`、幂等的 `prefixHarnessModelCatalogLabels()`；从包入口导出。
- [x] 3.2 缩写表登记八家：`ag/cc/cs/ds/gk/omp/oc/pi`；未登记的 Harness 走确定性派生（复合名取各段首字母，单段名取前两字母，上限 3），不抛错。
- [x] 3.3 Host 在 `app-server-host` 的 `harness/inspect` 应答处施加前缀，仅对 `status: "ready"` 生效。
- [x] 3.4 Host 在 `harness-delegation-coordinator.inspect` 处施加同一前缀，使 CLI 与 Desktop 形态一致。
- [x] 3.5 各 Adapter 只产出 Model 名：DeepSeek（`model.name` / `selection.model`）与 OpenCode（`model.name`）去掉 Provider 段；Pi / OMP / Grok / Cursor / Claude Code 本就如此。
- [x] 3.6 `ref` 编码不变，模型选择与恢复不受影响。

## 4. 验证

- [x] 4.1 `renderer-permission-mode-picker.test.ts`：首轮对话后仍可见、多余原生按钮被隐藏。
- [x] 4.2 `harness-model-label.test.ts`（新增 8 例）：八家缩写取值、预装清单逐个已登记、缩写短小唯一、派生回退、分隔符与前缀、目录投影、幂等、`ref` 不受影响。
- [x] 4.3 `harness-delegation-coordinator.test.ts`：CLI 侧 `inspect` 标签带 `pi·` 前缀且二次投影不叠加；`app-server-host.test.ts` 断言 Desktop 侧同款前缀。
- [x] 4.4 DeepSeek 两代与 OpenCode 的目录用例改断裸 Model 名。
- [x] 4.5 全仓：`tsc -b` pass、`npm run lint`（eslint + boundaries）pass、`vitest run` 266 文件 2884 例全过。
- [ ] 4.6 真机：Desktop 正常退出 + `codexhost launch` 后，在一条外部 Thread 上完成首轮对话，确认权限选择器仍在且原生按钮不并排出现，模型芯片与菜单显示 `<缩写>·<模型名>`，且在菜单搜索框打缩写能筛出该 Harness 的模型（用户执行）。
- [ ] 4.7 待裁决：会话状态 `resolvedModelLabel` 是否一并加前缀（见 proposal 现状偏差）。
