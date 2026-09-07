## Why

Composer 上给外部 Harness Thread 用的两个选择器都在展示错的东西。

**权限模式选择器**：注入的外部权限控件此前只在 Renderer 能"语义核验"原生权限按钮时才挂载——要求 Composer 里恰好有一个 `button[aria-haspopup="menu"][data-composer-navigation-target="permissions"]` 且通过候选校验。首轮对话之后 Desktop 会在同一 Composer 里留下第二个原生权限按钮，核验因此从"恰好一个"落空，外部权限控件直接消失；切换目标 Thread 时同样会把已就绪的视图清掉。结果是用户开完第一轮就再也改不了外部会话的权限模式，而 Composer 上还并排留着一个对外部 Thread 无效的原生按钮。

**模型目录标签**：各家各拼各的——Pi / OMP 是 `${native.provider} / ${native.id}`，DeepSeek 与 OpenCode 是 `${group.name} / ${model.name}`，Grok / Cursor / Claude Code 则是裸模型名。选择器里于是出现 `openai-codex / gpt-5.6-sol` 这种把 Provider 塞进 Model 位的文案（[领域术语表](../../../docs/领域术语表.md) 明确要求不混淆 Harness / Model / Provider / Account），而真正缺的信息恰恰相反：Composer 上的当前模型芯片不说这条 Thread 跑在哪个 Agent 上，用户得另开 Agent 选择器才知道。用户裁决（2026-09-07）：**标签前缀改为 Harness 缩写**，`ds·DeepSeek V4 Flash` 这种形态，并作为今后新增智能体工具的通用规则与默认偏好。

## What Changes

- 外部权限选择器的**挂载位置**与**核验**解耦：取 Composer 里第一个原生权限按钮作为插入锚点（`firstNativePermissionModeButton`），语义核验结果只写进 `nativePermissionModeControlVerified` 供诊断使用，不再作为挂载前提。
- 新增 `isExternalPermissionModePickerVisible(agent, view)`：非 `codex` 目标且视图状态不是 `idle` / `loading` / `unsupported` 时，外部权限控件 SHALL 可见——可见性由 Host 权限模式视图的就绪状态决定，与 DOM 核验无关。
- 同一 Composer 里锚点之外的多余原生权限按钮由 `extraHiddenNativePermissionModeControls` 捕获并隐藏，切换目标或按钮消失时按捕获状态还原，不破坏原生 DOM。
- 模型目录标签统一为 `<Harness 缩写>·<Model 名>`：新增 `shared-contracts/harness-model-label.ts` 持有缩写表、分隔符 `·`、派生回退与幂等的 `prefixHarnessModelCatalogLabels()`；前缀由 **Host 在两处已知 `harnessId` 的投影点**（`app-server-host` 的 `harness/inspect` 应答、`harness-delegation-coordinator.inspect`）统一施加，各 Adapter 不参与。
- 各 Adapter 只产出 Model 名：DeepSeek 与 OpenCode 去掉 `${provider} / ` 段，其余六家本就如此。
- 缩写表为唯一权威（`ag/cc/cs/ds/gk/omp/oc/pi`），回归测试对预装清单里每个插件断言其已登记；未登记的 Harness 走确定性派生而非报错。

## Non-goals

- 不改 Harness 权限模式的线上 id 与传输语义（那是权限模式统一词表的范围）。
- 不改模型目录的 `ref` 编码，只改 `label`；模型身份与恢复仍全走 `ref`。
- 不新增 Provider 的独立展示位。多 Provider 路由型 Harness 因此可能出现文案相同的多行，靠 `ref` 区分——这与 Pi 目录既有的取舍一致（`pi-model-catalog.test.ts` 明确断言同名跨 Provider 产出 `["same", "same"]`）。
- 不改会话状态上的 `resolvedModelLabel`：它走的是另一条投影链，本轮保持未加前缀（见现状偏差）。

## Capabilities

### New Capabilities

### Modified Capabilities

- `harness-permission-mode-control`: 外部权限选择器的可见性由 Host 视图就绪状态决定，多余原生按钮被隐藏并可还原。
- `harness-model-catalog`: 目录标签统一为 `<Harness 缩写>·<Model 名>`，前缀由 Host 施加且幂等；缩写表为唯一权威。

## 现状偏差（2026-09-07 实测）

上游 `635a890`（2026-09-03，`refactor(deepseek): 共享跨代模型与命令语义`）曾把 DeepSeek 标签写回 `${group.name} / ${model.name}`，覆盖本地 `f5550d9`。本变更以 Harness 缩写前缀取代原先「只标识 Model」的表述，该冲突随之消解：Provider 段在两家路由型 Harness 上一并去掉，缩写前缀由 Host 统一补上。

仍未闭合：会话状态上的 `resolvedModelLabel`（`modern/configuration.ts` 由 `catalogModel.label` 派生）走的是会话投影链而非目录投影链，本轮**未加前缀**，因此委派输出里的 `configuration.effective.resolvedModelLabel` 会是裸模型名。要不要一并对齐是独立取舍，未在本包内解决。

## Impact

- Renderer `renderer-composer-dom.ts`（锚点、可见性判定、多余按钮的捕获/隐藏/还原）、`renderer-binding-probe.ts`、`index.ts` 导出。
- 新增 `packages/shared-contracts/src/harness-model-label.ts` 并从包入口导出。
- Host `app-server-host.ts`（`harness/inspect` 应答）与 `harness-delegation-coordinator.ts`（`inspect`）施加前缀。
- Adapters `deepseek-harness/model-catalog.ts`、`opencode/model-catalog.ts` 去掉 Provider 段；Pi / OMP 早已是 `native.id`。
- 聚焦测试：`shared-contracts/test/harness-model-label.test.ts`（新增）、`harness-delegation-coordinator.test.ts`、`app-server-host.test.ts`、`renderer-permission-mode-picker.test.ts`、DeepSeek 两代与 OpenCode 的目录用例。
- 兼容性：标签是纯呈现值，已有 Thread 的模型选择按 `ref` 恢复，不受影响。
