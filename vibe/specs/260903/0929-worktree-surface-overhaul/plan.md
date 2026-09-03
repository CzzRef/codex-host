# Plan: 260903 Worktree 三项能力核验与重做

Tool: cursor
Date: 2026-09-03 09:29 (+08:00)
Status: `confirmed / implementing`（用户 2026-09-03 10:05 确认按四切片实施；进度见 [§8 Execution Journal](#8-execution-journal)）
Documentation level: `standard requirement`（本文件即 owner，保留文件名以维持外部链接；需求原文见 [raw-requirement.md](raw-requirement.md)）

## 0. 基线

- 基线树：`codex-host@czz-dev` `5072d81`（2026-09-03 09:29 测得），工作区仅 `.codemark/codemark.json` 未跟踪。
- 核验方式：静态源码 + OpenSpec + preview + 单测/E2E 对照。**Desktop 未运行**，无真机复现；下文标 `[待真机]` 的判断需实施前用 CDP 量一次。
- 现行权威：[add-composer-workspace-bar](../../../../openspec/changes/add-composer-workspace-bar/specs/renderer-composer-workspace-surface/spec.md)、[1340 task card](../../260902/1340-worktree-checkbox-routing/task-card.md)、[2042 Redo spec](../../260901/2042-external-thread-redo/spec.md)、[preview](../../../../packages/renderer-extension/src/composer-overlay.preview.html)。
- 范围外（本轮不动）：Rust crates、Harness Adapter 协议、文件级回滚（术语表明确 avoid「文件回滚 / 文件快照」）。

## 1. 核验结论：三项都「有骨架、没到位」

### 1.1 新建对话可选 Worktree —— 只是一个勾选框

| 项 | 现状 | 依据 |
| --- | --- | --- |
| 控件 | 单个 `<input type=checkbox>` 「工作树」，插在官方「Switch branch」按钮后 | [renderer-branch-worktree-toggle.ts#L244-L266](../../../../packages/renderer-extension/src/renderer-branch-worktree-toggle.ts) |
| 作用 | 沿 React fiber 找到 Desktop 草稿 owner，调 `setComposerMode("worktree"\|"local")`；Desktop 在提交时自建匿名 worktree | 同文件 `#L42-L81`、`#L202-L232` |
| 选已有 worktree | **没有**。不列 `git worktree list`，不能选 | — |
| 命名 | **没有**。路径/分支由 Desktop 决定，不遵守 `yyMMdd-功能核心` / `codex/<名>` | CodeNote [worktree-tasks.md#L70](../../../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/process/worktree-tasks.md) |
| Host 侧 | 只 inspect（`rev-parse / status / diff --numstat / worktree list --porcelain`），**从不 `worktree add`** | [thread-workspace.ts#L119-L139](../../../../packages/host-runtime/src/thread-workspace.ts) |
| 外部 Harness | `thread/start` 必须带 `cwd`，Host 原样持久化；cwd 来自 Desktop | [app-server-host.ts#L2577-L2612](../../../../packages/host-runtime/src/app-server-host.ts) |
| 可复用的拦截点 | desktop-control 已在 `thread/start` 上改写 `model`（`routeThreadStart`），**同一位置可改写 `cwd` / `runtimeWorkspaceRoots`** | [renderer-draft-prewarm-runtime.ts#L502-L507](../../../../packages/desktop-control/src/renderer-draft-prewarm-runtime.ts)、策略入口 `#L598-L605` |
| 文档漂移 | proposal / tasks 4.2 仍写「默认新建 worktree」，spec 与代码已改默认 Local | [tasks.md#L49](../../../../openspec/changes/add-composer-workspace-bar/tasks.md) |

### 1.2 前几轮回滚 / 编辑 —— UI 承诺的，Host 只兑现一部分

| 项 | 现状 | 依据 |
| --- | --- | --- |
| 触发 | 点轮次（或左侧 8px 圆点）→ `codexhost:turn-files-selected` → 选中轮右上出现 编辑/回滚/Redo | [renderer-turn-actions.ts#L309-L334](../../../../packages/renderer-extension/src/renderer-turn-actions.ts)、[renderer-workspace-bar.ts#L924-L951](../../../../packages/renderer-extension/src/renderer-workspace-bar.ts) |
| 定位 | 挂在 `body` 上的 `position: fixed` 行，靠 `scroll(capture)` / `resize` / MutationObserver **250ms 去抖** 重定位 → 滚动时可见延迟与漂移 | 同文件 `#L663-L681` |
| 回滚 RPC | `thread/rollback { numTurns: 后续轮数 }`；但 Host 对**现存线程只接受 `numTurns=1`**（last-turn），多轮只对「未动过的 Fork 派生线程」生效，否则 `-32076` | [external-thread-rollback.ts#L209-L240](../../../../packages/host-runtime/src/external-thread-rollback.ts)、`#L243+` |
| 「前几轮」 | UI 只要 `laterTurns>0` 就亮回滚 → 选前几轮点确认后 Host 拒绝，**功能实际不可用** | 同上 |
| 编辑 | 无 Host RPC；回滚后 `click()` 官方铅笔按钮（`edit message\|编辑消息`）。Harness 轮次常无该按钮 → 「点了没反应」 | [renderer-turn-actions.ts#L411-L415](../../../../packages/renderer-extension/src/renderer-turn-actions.ts) |
| 文件 | 文案写「尽量还原本轮文件」，实际只 `click()` 官方 Undo；Host/Adapter 不碰文件 | 同文件 `#L393`、`#L139-L142` |
| Redo | 仅 last-turn 且 Native Session ID 变化才有槽；Grok 原地 rewind 永无 Redo | [mapping-store.ts#L534-L543](../../../../packages/mapping-store/src/mapping-store.ts) |
| Cursor / DSH | `rollbackLastTurn: false`，按钮照常出现 | [cursor-models.ts#L73-L78](../../../../packages/adapters/cursor/src/cursor-models.ts)、[deepseek-harness-adapter.ts#L1899](../../../../packages/adapters/deepseek-harness/src/deepseek-harness-adapter.ts) |
| 回滚后 DOM | Desktop 不一定重画 transcript（已知残留） | [2042 changes.md#L88](../../260901/2042-external-thread-redo/changes.md) |
| 规范漂移 | 现行 OpenSpec 仍写「原线程 rollback 应拒绝」，代码已做 last-turn | [external-thread-fork-routing/spec.md#L58-L60](../../../../openspec/specs/external-thread-fork-routing/spec.md) |

### 1.3 底部状态栏 —— 只在「有变更文件」时出现，且只画 inspect 内的仓库

| 项 | 现状 | 依据 |
| --- | --- | --- |
| 出现条件 | 必须收到 `item/fileChange/patchUpdated`；否则整条 `remove()`，**看不到当前 worktree/分支** | [renderer-workspace-bar.ts#L705-L713](../../../../packages/renderer-extension/src/renderer-workspace-bar.ts) |
| 核心环境 | 不区分「线程 cwd 所在 worktree」和「被改到的其他 root」 | `#L349-L367` |
| 跨仓变更 | 绝对路径只匹配 inspect 返回的 primary / submodule / sibling worktree / additional；**CodeNote 这类外部仓的改动被静默丢弃** | 同上 |
| 每 root 统计 | 只有全局聚合 `+/-`；没有每个 root 的文件数与 `+/-`，无法隐藏 0 行 root | `#L369-L380`、`#L735-L744` |
| 定位 | 插在 Composer 前一兄弟 **同时** `position: fixed`。祖先若有 `transform / filter / backdrop-filter`，fixed 会退化为相对该祖先定位 → **整条偏移** `[待真机]`，与用户「偏向中间区域右侧」吻合 | `#L560-L586` |
| 多 chip | `flex-wrap: nowrap; overflow: hidden`，多仓被裁切无 `+N` | `#L78-L85` |
| 悬浮预览 | `min(420px,…)×280px`、`pointer-events: none`、`mouseleave` 立即隐藏、按锚点右侧优先且只夹在 Composer 上沿 → 小、不能滚、可能压住文件列表 | `#L236-L253`、`#L538-L558`、`#L776-L782` |
| 文件列表 | `mergeConversationFiles` 只增不减；revert 后文件不消失 | [renderer-conversation-files.ts#L114](../../../../packages/renderer-extension/src/renderer-conversation-files.ts) |
| 官方控件 | 有替代时隐藏官方 Changes / Review；用户仍看到重叠 `[待真机]`，可能是隐藏选择器漏掉某个 slot 或时序 | `#L418-L457` |
| 死代码 | `worktreeLabel` / `repositoryDisplayName` 有测试但 `renderRow` 不用；worktree 名=分支时显示 `foo · foo` | `#L382-L403`、`#L503-L515` |

## 2. 方案总览

```mermaid
flowchart LR
  subgraph renderer [renderer-extension]
    Picker[DraftWorktreePicker]
    Bar[WorkspaceBar v2]
    Turns[TurnActions v2]
  end
  subgraph dc [desktop-control]
    Route[routeThreadStart cwd rewrite]
  end
  subgraph host [host-runtime]
    WtRpc[workspace/worktree list+create]
    Resolve[workspace/resolve-roots]
    Rollback[multi-turn rollback]
    Inspect[thread/inspect capabilities]
  end
  Picker -->|select| Route
  Picker -->|list/create| WtRpc
  Route -->|thread/start cwd| host
  Bar --> Resolve
  Turns --> Inspect
  Turns --> Rollback
```

原则：Host 拥有 Git worktree 生命周期（只增不删）；Renderer 不跑 Git；官方 Codex 线程与外部线程走同一 `thread/start` 改写点；所有 UI 承诺必须能被 Host 能力位证明。

### 2.1 方案 A：Host 自管 Worktree 选择器（新建对话）

A-1 契约（`packages/shared-contracts/src/workspace-worktree.ts`，browser-safe zod）

- `codexhost/workspace/worktree/list` `{ projectRoot }` → `{ primaryRoot, worktrees: [{ root, branch, headSha, name, lane, dirty, isPrimary }], suggestedName }`；`suggestedName = yyMMdd-`（GMT+8）。
- `codexhost/workspace/worktree/create` `{ projectRoot, name, lane?: "codex"|"claude"|"cursor"|"group", baseRef? }` → 同一条目。
- 校验：`name` 匹配 `^\d{6}-[a-z0-9][a-z0-9-]{1,40}$`；路径 `{parent}/{RepoName}-worktrees/{lane}/{name}`；分支 `{lane}/{name}`；路径或分支已存在 → `INVALID_ARGUMENT`；**永不删除**。

A-2 Host（`packages/host-runtime/src/workspace-worktree.ts`）

- 复用 `thread-workspace.ts` 的 `git worktree list --porcelain` 解析；新增 `git worktree add -b <branch> <path> <baseRef|HEAD>`。
- 在 [app-server-host.ts#L2013](../../../../packages/host-runtime/src/app-server-host.ts) inspect 旁路由两条新方法；不经官方 app-server。

A-3 desktop-control（[renderer-draft-prewarm-runtime.ts#L502-L507](../../../../packages/desktop-control/src/renderer-draft-prewarm-runtime.ts)）

- 策略对象新增 `selectWorkspace({ cwd, runtimeWorkspaceRoots } | null)`；`routeThreadStart` 在改写 `model` 的同一处改写 `cwd` 与 `runtimeWorkspaceRoots`（`ephemeral` 草稿跳过）。
- `sendDirect` 也使用 `routedParameters`，因此官方 Codex 线程同样进入所选 worktree。
- `thread/started` 后清空选择，避免污染下一个草稿。

A-4 Renderer（`renderer-branch-worktree-toggle.ts` → 重命名 `renderer-draft-worktree-picker.ts`）

- 勾选框改为 chip「工作树 ▾」，菜单：`本地（主目录）` / 已有 worktree 列表（名 · 分支 · dirty 标记）/ `新建…`（输入框预填 `yyMMdd-`，回车创建）。
- 选中任何非本地项时：保持 Desktop `composerMode` 为 `local`（沿用现有 fiber 绑定），并调用 A-3 `selectWorkspace`。
- 偏好键升级 `codexhost.draft-worktree.v1`，只记「上次选择」用于菜单高亮，默认仍是本地。
- 草稿的 `projectRoot` 来源 `[spike]`：优先从同一 React owner 读取 cwd/project 字段；读不到则退回「提交时在 A-3 拦截点用 `params.cwd` 解析并按需创建」（此时「已有 worktree」列表延后到第一次拿到 cwd 后再填充）。

A-5 状态栏联动：新线程首个 `thread/started` 后状态栏立即以 inspect 结果显示该 worktree（依赖 C-2）。

### 2.2 方案 B：轮次回滚 / 编辑

B-1 Host 多轮回滚（[external-thread-rollback.ts#L243+](../../../../packages/host-runtime/src/external-thread-rollback.ts)）

- 对现存线程：当 `numTurns>1` 且保留前缀最后一轮的 `turnMappings` 有 checkpoint、Adapter `fork=true` 时，以该 checkpoint `open({ kind: "fork" })` 生成新 Native Session，走与 last-turn 相同的 `replace` + `historyRedo` 暂存路径。
- Grok：确认 `_x.ai/rewind/execute` 是否接受任意 checkpoint `[spike]`；接受则多轮亦可（无 Redo，同现状）。
- Cursor / DSH：保持拒绝，但要在能力位里说清。

B-2 能力位（`codexhost/thread/inspect` 新增 `rollback: { lastTurn, multiTurn, redo }`）

- Renderer 据此禁用按钮并给出原因 tooltip（如「Cursor 线程不支持回滚」），不再让用户点确认后才被 `-32076` 打回。

B-3 编辑落地

- 回滚（或最后一轮）后：优先官方铅笔；找不到时把选中用户轮的文本回填 Composer（复用 [renderer-composer-prompt-reuse.ts](../../../../packages/renderer-extension/src/renderer-composer-prompt-reuse.ts) 的填充逻辑）并聚焦。
- 文案去掉「还原文件」承诺，改为「不回退文件；如需回退请用官方 Undo / Git」。

B-4 定位与交互

- 去掉左侧 8px 圆点；改为 `[data-turn-key]:hover` 时在轮次右上出现半透明「⋯」chip，点击展开 编辑/回滚/Redo（仍是 Host 自有节点，不写进 React transcript）。
- 重定位改为：滚动容器 `scroll` 同步 + `requestAnimationFrame` 合并；对选中轮加 `ResizeObserver`；MutationObserver 去抖降到一帧。
- 与官方「提交所有的代码变更」相撞时继续 `avoid`（[renderer-overlay-layout.ts#L112](../../../../packages/renderer-extension/src/renderer-overlay-layout.ts) 已有）。

B-5 回滚后刷新 `[spike]`

- 试验 Host 在 replace 成功后向 Desktop 发官方形态的 `thread/…` 通知能否触发重读；不行则 Renderer 在成功后主动 `thread/read` 并提示「已回滚，切换线程可刷新」。

### 2.3 方案 C：底部状态栏

C-1 数据：按 root 分组

- Renderer 把对话文件按 owning root 分组，计算每 root `files / +/-`；`+0/-0` 的 root 不画。
- 落在所有 inspect root 之外的绝对路径 → 新 RPC `codexhost/workspace/resolve-roots { paths[] }`（Host 对每个路径 `git rev-parse --show-toplevel` + 分支 + worktree 判定，缓存按 root）→ 以 `kind: "external"` 加入（例：CodeNote）。

C-2 核心环境常驻

- 只要 inspect 成功，第一枚 chip 固定为线程 cwd 所在 root（primary），带「核心」样式，即使 0 变更；其后按 C-1 只列有变更的 root。
- 「隐藏官方 Changes / Review」的条件不变：仍只在有文件披露时隐藏。

C-3 布局修正

- 条改挂到 `document.body`（与 turn-actions / preview 一致），坐标仍取 `[data-codex-composer-root]` rect → 消除 transformed 祖先导致的 fixed 偏移；实施前先用 CDP 量 bar rect 与 composer rect 差值确认根因 `[待真机]`。
- 多 chip：超出宽度折成 `+N` chip，悬停展开完整列表；不再裁切。
- `renderRow` 用上 `repositoryDisplayName` + `worktreeLabel`，worktree 名与分支相同时只显示一次。
- 对应 OpenSpec「previous sibling」措辞改为「visually floats above the Composer；DOM 位置由 Renderer 决定」（Requirement Change Review）。

C-4 悬浮预览

- 尺寸 `min(560px, 60vw) × min(420px, 50vh)`；定位优先文件列表**左侧**并与列表 rect 不相交；`pointer-events: auto` 可滚动；`mouseleave` 120ms 宽限，鼠标移入预览不关闭；Esc 关闭；顶部显示路径与 `+/-`。

C-5 文件列表收缩

- `mergeConversationFiles` 支持删除：`patchUpdated` 中 `changes` 为空或文件 `+0/-0` 时移出；解析器不再丢弃空 `changes`。

## 3. 切片顺序与规模

1. **切片 1（C-3, C-4, C-1, C-2, C-5）状态栏** —— 只动 renderer-extension + 一条 Host RPC（resolve-roots）+ 对应 spec/preview/E2E。用户可见收益最直接。
2. **切片 2（B-2, B-3, B-4）轮次动作诚实化与定位** —— renderer-extension + inspect 能力位；不改 Adapter。
3. **切片 3（A-1 … A-5）Worktree 选择器** —— shared-contracts + host-runtime + desktop-control + renderer-extension，跨四包，单独 worktree 开发。
4. **切片 4（B-1, B-5）Host 多轮回滚与刷新** —— 风险最高，依赖 spike 结论后再排。

每个切片独立 worktree（`codex/260903-<slice>`）、独立 OpenSpec change 或对现有 change 的 delta，按 CodeNote worktree 生命周期合入 `czz-dev`。

## 4. 验证清单（实施时逐项勾）

- 正常流：新建对话选已有 worktree → `thread/start.cwd` 为该 root；选「新建」→ Host 创建 `{Repo}-worktrees/codex/yyMMdd-x` + 分支 `codex/yyMMdd-x`；状态栏首 chip 为该 worktree。
- 边界 / 空：名字不合法、路径已存在、非 Git 目录、`ephemeral` 草稿、cloud 模式 → 无副作用且有提示。
- 官方 Codex 线程：同样进入所选 worktree；`thread/rollback` 仍原样转发。
- 回滚：Pi/OMP/Claude 多轮回滚生成新 Session 且 Redo 可用；Grok 多轮按 spike 结论；Cursor/DSH 按钮禁用并有原因。
- 编辑：无官方铅笔时 Composer 被回填并聚焦。
- 状态栏：0 变更时只显示核心 chip；跨仓（主目录 + worktree2 + CodeNote）各出现一枚并各带 `+/-`；0 行 root 不出现；revert 后文件从列表消失。
- 布局 `[待真机]`：bar 左缘与 Composer 左缘差 ≤2px；预览不与列表相交；官方 Changes/Review 在替代存在时不可见。
- 回归：现有 `renderer-branch-worktree-toggle` / `renderer-workspace-bar` 单测、Playwright `renderer-composer-workspace-surface`、host-runtime rollback/redo 测试、`npm run typecheck`、`node tools/check-boundaries.mjs`（renderer 仍不得 import Node builtins）。
- 并发 / 重复提交：连续两次点「新建」只创建一次；创建期间禁用提交。

## 5. 非目标（本方案明确不做）

- 删除 / 清理 worktree、切换现存线程的 cwd、迁移 Harness。
- 文件级回滚或快照（保持术语表 avoid）。
- 劫持 Desktop `codex-worktrees` IPC 或改 Desktop 自身的 worktree 命名。
- Rust 侧改动。
- 官方 Codex 线程的 Host Redo。

## 6. 风险与开放问题

- `[spike]` 草稿阶段能否拿到 projectRoot（A-4）；拿不到则「已有 worktree」列表体验降级。
- `[spike]` Grok rewind 多轮能力（B-1）。
- `[spike]` 回滚后 Desktop transcript 刷新（B-5）。
- `[待真机]` 状态栏偏移根因是否为 transformed 祖先；若不是，改挂 body 仍是正确方向但需另找偏移源。
- Desktop 升级可能改动 `run-location` / `data-composer-navigation-target` / `[data-review-path]` 等私有 DOM；沿用 fail-closed 策略，并在 [codexhost-update-impact-audit](../../../../.agents/skills/codexhost-update-impact-audit/SKILL.md) 里登记新依赖点。

## 7. 文档影响

- 本文件：确认后升级为 `spec.md`（Standard requirement owner），补 Requirement Change Review、Verification Impact Trace、Execution Journal。
- OpenSpec：`add-composer-workspace-bar` 追加 delta（C-2/C-3 措辞、A 的选择器替代勾选框）；新建 `add-host-managed-worktree-selection` 与 `add-external-thread-multi-turn-rollback` 两个 change；修正 `external-thread-fork-routing` 「原线程 rollback 应拒绝」的漂移。
- preview：`composer-overlay.preview.html` 增加「工作树 ▾」菜单、核心 chip、`+N`、大预览、hover「⋯」四个状态。
- 术语表：新增「核心工作区 / 涉及仓库」两条。
- 过程枢纽：[PROJECT_STATUS.md](../../PROJECT_STATUS.md) 已登记本任务。

## 8. Execution Journal

实施在 `czz-dev` 控制检出上直接进行（用户要求一次做完四个切片、不间断；未按 §3 每切片开独立 worktree，改为每切片一次提交以保持可独立回退）。

### 切片 1 状态栏 — 2026-09-03 done

- 实现偏差（Requirement Change Review）：C-1 的「新 RPC `codexhost/workspace/resolve-roots`」改为扩展现有 `codexhost/thread/workspace/inspect` 参数 `extraPaths[]`，Host 把每个绝对路径的最近存在祖先目录 `rev-parse --show-toplevel` 后以 `kind: "external"` 追加。理由：复用同一 inspect 管线与 watch 登记，Renderer 无需第二条订阅；语义与原方案一致。
- 代码：`packages/shared-contracts/src/thread-workspace.ts`（`external` kind、`extraPaths`）；`packages/host-runtime/src/thread-workspace.ts`（`nearestDirectory`、`inspectGitWorkspace(cwd, extraRoots, extraPaths)`）；`packages/host-runtime/src/app-server-host.ts#inspectThreadWorkspace` 透传；`packages/renderer-extension/src/renderer-conversation-files.ts`（`itemId`、空变更集可投递、`conversationFilesFromItems`）；`packages/renderer-extension/src/renderer-workspace-bar.ts` 重写（挂 body、核心 chip、按 root 分组、`+N`、大预览、Item 级文件集）。
- 验证（Verification Impact Trace）：`npm run typecheck` 通过；`vitest` shared-contracts/host-runtime/renderer-extension workspace 相关 18 例通过，renderer-extension 全量 228 例通过；Playwright `tests/e2e/renderer-composer-workspace-surface.spec.ts` 通过（新增核心 chip 先于文件、body 挂载与 Composer 对齐、预览不与列表相交且可进入、Esc 关闭、`external` chip 与 `extraPaths` 透传、0 行 root 无 chip、revert 收缩五组断言）；`eslint` 与 `node tools/check-boundaries.mjs` 通过。
- `[待真机]` 仍未量：bar 左缘与 Composer 左缘差、预览在真实 Desktop 中的位置；Desktop 未运行。
- 文档：OpenSpec `add-composer-workspace-bar` 两个 spec delta 与 tasks §11 已更新；preview HTML 已更新核心 chip / external / `+N` / 大预览。
