# Changes：对话轮次置顶栏

> Inventory only. Judgement lives in [spec.md](spec.md). Rows from `git show --stat` on 2026-09-03.

## 1. 概览

| 批次 | 提交 | 文件数 | 核心说明 |
| --- | --- | --- | --- |
| 切片 0 | （无提交）`git merge --ff-only czz-dev` | — | worktree 从 `dea7498` 快进到 `dd25c65`；`npm install` 补齐 DeepSeek 依赖后 typecheck 通过 |
| 切片 1 | `5eca7b8`（rebase 前 `5ca8085`） | 9 | 纯搬迁：Composer 身份、原生 Changes / Review 控件、分组纯函数各自成模块；置顶栏纯几何入 overlay-layout；单测拆分 |
| 切片 2 | `d7b96eb`（rebase 前 `6513243`） | 15 | 置顶栏第一行 + 动作控制器；删除 hover「⋯」/ 浮动簇 / 旧几何；E2E 夹具改为 column-reverse 滚动容器；OpenSpec「Turn actions」改写 |
| 切片 3 | `4668afe`（rebase 前 `98fe202`） | 17 | 工作区状态并入第二行；删除底部栏与底部预留；files-state / surface / row / workspace 四个模块；OpenSpec 挂载 / 溢出 / 披露改写 |
| 切片 4 | `cbfc9c2`（rebase 前 `3a4b6b8`） | 11 | 任务文档、枢纽、预览页、README 矩阵、更新影响清单、术语表 |
| 真机修正 1 | `891e4fe` | 6 | history-gap 占位排除、只认 `data-user-message-bubble`、无气泡轮不钉提示词 |
| 真机修正 2 | `18b4a46` | 4 | 「‹ ›」步进当前轮（显式覆盖） |
| 真机修正 3 | `00510e0` | 8 | inspect `turnIds`，回滚数量来自 Host；legacy 线程回滚后的刷新提示 |
| 真机登记 | `afc8bcb` 等 | — | OpenSpec / 任务文档 / 枢纽 |
| 真机回测修正 | 本提交 | 9 | 26.901.22334 上按原始需求回测置顶栏，修五处：提示词重复、当前轮探针线、无变更文件时收成一行、`Turn N/M` 改用 Host `turnIds`、chevron 只在真截断时出现 |

## 2. 交付物清单

| 对象 | 类型 | 核心说明 |
| --- | --- | --- |
| `packages/renderer-extension/src/renderer-turn-header.ts` | 新增 | 唯一 install 循环：按可见 Composer 挂 header、扫描轮次、每帧量测（`turnHeaderBox` / `resolveCurrentTurn` / `promptPinned` / 顶部预留）、事件与观察器 |
| `packages/renderer-extension/src/renderer-turn-header-row.ts` | 新增 | 第一行视图：索引、提示词按钮、chevron、全文面板、动作簇宿主、notice、第二行宿主 |
| `packages/renderer-extension/src/renderer-turn-header-workspace.ts` | 新增 | 第二行绘制：分组、`+N` 收缩、文件披露、预览、原生控件隐藏同步 |
| `packages/renderer-extension/src/turn-header.css` | 新增 | 置顶栏样式（实色、向下弹出、原生编辑隐藏动作、tooltip 向下） |
| `packages/renderer-extension/src/renderer-turn-action-controller.ts` | 新增 | 编辑 / 回滚 / Redo 状态机与 Host RPC；inspect 按线程一次；官方线程保留本地 Redo 标记 |
| `packages/renderer-extension/src/renderer-turn-actions.ts` | 重写 977 → 392 | 纯函数 + `renderTurnActionCluster`；`nativeTurnButton` 逐标签匹配并跳过 `[data-codexhost-overlay]`；`turnPromptElement` |
| `packages/renderer-extension/src/renderer-workspace-files-state.ts` | 新增 | 按线程的工作区快照与 File Change Item 仓库，Host inspect / 订阅 / `extraPaths` |
| `packages/renderer-extension/src/renderer-workspace-surface.ts` + `workspace-surface.css` | 新增 | 核心 chip、涉及 root、`fitWorkspaceChips`、文件披露（向下、「本轮」标记）、diff 预览面层、`previewOrigin(minTop)` |
| `packages/renderer-extension/src/renderer-native-diff-controls.ts` | 新增 | 官方 Changes / Review 的识别、隐藏、打开、按文件揭示 |
| `packages/renderer-extension/src/renderer-thread-composer.ts` | 新增 | `composerVisible` / `threadIdForComposer` / `visibleComposers` |
| `packages/renderer-extension/src/renderer-conversation-files.ts` | 扩展 165 → 328 | 分组 / 标签 / `snapshotSignature` 原样搬入 |
| `packages/shared-contracts/src/harness-models.ts` | 改动 | `externalThreadInspectionSchema.turnIds`（可选、有序 Host Turn id） |
| `packages/host-runtime/src/app-server-host.ts`、`test/app-server-host.test.ts` | 改动 | `#inspectThread` 发布 `turnIds`；测试断言 |
| `packages/renderer-extension/src/renderer-overlay-layout.ts` | 改动 327 → 419 | 删旧簇几何；新增 `OVERLAY_ROOT_ATTRIBUTE`、`chineseLocale`、置顶栏几何、顶部预留、`transcriptTurns` / `appShellChromeBottom` / `scrollContainerFor` / `transcriptColumn` |
| `packages/renderer-extension/src/renderer-workspace-bar.ts` | 删除 | 1534 行底部栏溶解进上列模块 |
| `packages/renderer-extension/src/renderer-binding-probe.ts`、`index.ts` | 改动 | 装配 `installRendererTurnHeader`；导出同步 |
| `packages/renderer-extension/src/renderer-composer-prompt-reuse.ts` | 改动 | `threadIdForComposer` 改从 thread-composer 导入 |
| `packages/renderer-extension/test/renderer-turn-header.test.ts`、`renderer-turn-action-controller.test.ts`、`renderer-turn-actions.test.ts` | 新增 | 几何 / 控制器 / 文案与原生控件排除 |
| `packages/renderer-extension/test/renderer-workspace-surface.test.ts` | 改名自 bar 测试 | 分组、标签、通知、`previewOrigin(minTop)` |
| `tests/e2e/renderer-composer-workspace-surface.spec.ts` | 改动 | column-reverse 滚动容器 + 三轮 + app-shell header 夹具；置顶栏、预留、滚动切轮、提示词、动作、原生编辑、生成中、第二行、`+N`、预览、卸载 |
| `openspec/changes/add-composer-workspace-bar/**` | 改动 | spec 四段 Requirement 改写；proposal / design（Decision 8、Migration 5）/ tasks §13 |
| `openspec/changes/add-external-thread-multi-turn-rollback/proposal.md`、`tasks.md` | 改动 | Impact 措辞；2.6 登记被置顶栏取代 |
| `packages/renderer-extension/src/composer-overlay.preview.html` | 改动 | 目标样式改为置顶栏 mock（滚动驱动、向下展开） |
| `README.md`、`docs/README.en.md`、`docs/README.ko.md` | 改动 | 功能状态矩阵新增「置顶轮次头」行 |
| `.agents/skills/codexhost-update-impact-audit/SKILL.md` | 改动 | 清单新增 Transcript / Turn header 行、归属与探针项 |
| `docs/领域术语表.md` | 改动 | 「轮次头」「当前轮」；核心工作区 / 涉及仓库改指第二行 |
| `vibe/specs/260903/1631-transcript-turn-header/*`、`vibe/specs/PROJECT_STATUS.md` | 新增 / 改动 | 本任务 owner 与枢纽 |
| 合并 `upstream/main` v0.4.4 → `4b45876`（31 处冲突并集；合并后修正：`packages/adapters/antigravity|opencode` + `packages/harness-broker` 补 `turn.steer`，`packages/adapters/cursor/src/cursor-models.ts` 补 `permissionModeScope: "live"`，`renderer-binding-probe-host-catalog` / `opencode command` / `omp-adapter` 三处测试） | 改动 | 适配 Desktop 26.901：Renderer 注入改走 Chromium CDP（launcher `--remote-debugging-port`、controller `--renderer-cdp-endpoint`）；真机复核待用户退出普通 Desktop 后重启 |
| `packages/protocol-core/src/codex-ui-projector.ts`（`2d8a381`） | 改动 | 轮内 steer `userMessage` 补 `text_elements: []`，Desktop 26.901 打开外部线程不再进错误边界 |
| `tools/codex-desktop-live-check/`、`package.json`（`6bf88c8`） | 新增 | `live-check:codex-desktop`：识别版本 / asar / fuse → 拉起或附着 → CDP 探测 → 归因 verdict |

## 3. 真机回测修正（2026-09-04）

| 对象 | 类型 | 核心说明 |
| --- | --- | --- |
| `packages/renderer-extension/src/renderer-overlay-layout.ts` | 改动 | 新增 `CURRENT_TURN_PROBE = 24`，`resolveCurrentTurn` 的判定线下移到 `headerBottom + probe`（必须大于 `scrollDeltaToTurn` 的 8px 间隙）；`promptPinned` 的入参由 `headerBottom` 改为 `viewportTop` |
| `packages/renderer-extension/src/renderer-turn-header.ts` | 改动 | `promptPinned` 传滚动区顶边；`box.width` 与 Host 轮次位置进入重绘签名；`hostTurnPosition(key)` 供第一行取读数 |
| `packages/renderer-extension/src/renderer-turn-header-row.ts` | 改动 | 新增 `TURN_HEADER_CORE_ATTRIBUTE` 行内核心 chip 槽与 `data-pinned`；`position` 优先于 DOM 计数；单轮线程隐藏 ‹ ›；chevron 只在单行真截断时出现（先隐藏再量，结果不依赖自身） |
| `packages/renderer-extension/src/renderer-turn-header-workspace.ts` | 改动 | 无变更文件时核心 chip 绘进第一行、第二行标 `empty`；`collapse` 同时清两个宿主的 `+N` |
| `packages/renderer-extension/src/renderer-turn-action-controller.ts` | 改动 | 新增 `hostTurnPositionOf` 与 `hostTurnPosition(turnKey)`：外部线程用 Host `turnIds` 定位，官方线程返回 `null` |
| `packages/renderer-extension/src/turn-header.css` | 改动 | `empty` 第二行 `display: none`；核心 chip 槽（`max-width: 200px`，`data-pinned="true"` 时让位）；提示词 `flex: 1 1 0` + `min-width: 120px`；全文面板贴合头部并用 `:has` 去掉头部圆角 |
| `packages/renderer-extension/test/renderer-turn-header.test.ts` | 改动 | 探针线与迟滞用例改写；新增「跳到的轮次仍是当前轮」；`promptPinned` 用例改按视口顶边并覆盖透明标题栏带 |
| `packages/renderer-extension/test/renderer-turn-action-controller.test.ts` | 改动 | 新增 Host 位置读数与官方线程返回 `null` |
| `tests/e2e/renderer-composer-workspace-surface.spec.ts` | 改动 | 提示词在「头部之上、视口之内」仍不显示；点提示词后仍停在本轮且间隙 8px；箭头在覆盖过期后不回弹；第二行只在有变更文件时出现，核心 chip 在未钉住时可见、钉住时让位，高度不变 |
| `packages/renderer-extension/src/composer-overlay.preview.html` | 改动 | mock 的 `resolveCurrentTurn` / `promptPinned` 跟随修正；说明补探针线、视口顶边边界、单行形态与 Host 读数 |
| `openspec/changes/add-composer-workspace-bar/**` | 改动 | 两段 Requirement 改写 + 三个新 scenario；tasks 13.8 |
