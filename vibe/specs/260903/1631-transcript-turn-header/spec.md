# Standard Requirement Spec: 1631-transcript-turn-header

Tool: claude-code
Date: 2026-09-03 16:31 (+08:00)
Status: `implemented-local / focused-verified / live-pending`
Documentation level: `standard requirement`

Raw source: [raw-requirement.md](raw-requirement.md)
Canonical target: in-flight [add-composer-workspace-bar](../../../../openspec/changes/add-composer-workspace-bar/proposal.md)（`renderer-composer-workspace-surface` 能力，tasks §13）, [add-external-thread-multi-turn-rollback](../../../../openspec/changes/add-external-thread-multi-turn-rollback/proposal.md)（tasks 2.6）
Plan of record（会话外）: `~/.claude/plans/codex-host-codex-iterative-flask.md`（Claude Code 计划文件，用户 2026-09-03 批准）

## Task Documentation Sync Group

- Group key: `dsg:codex-host:1631-transcript-turn-header`
- Group owner: this `spec.md`
- Git document prefixes: `vibe/specs/260903/1631-transcript-turn-header/`, `vibe/specs/PROJECT_STATUS.md`, `openspec/changes/add-composer-workspace-bar/`, `openspec/changes/add-external-thread-multi-turn-rollback/`, `packages/renderer-extension/src/composer-overlay.preview.html`, `README.md`, `docs/README.en.md`, `docs/README.ko.md`, `.agents/skills/codexhost-update-impact-audit/SKILL.md`, `docs/领域术语表.md`
- Declared code/config dependencies: `packages/renderer-extension/src/renderer-turn-header*.ts`, `renderer-turn-action-controller.ts`, `renderer-turn-actions.ts`, `renderer-workspace-surface.ts`, `renderer-workspace-files-state.ts`, `renderer-native-diff-controls.ts`, `renderer-thread-composer.ts`, `renderer-overlay-layout.ts`, `renderer-conversation-files.ts`, `renderer-binding-probe.ts`, `index.ts`, `turn-header.css`, `workspace-surface.css`, `packages/renderer-extension/test/*`, `tests/e2e/renderer-composer-workspace-surface.spec.ts`
- Linked authorities: [领域术语表](../../../../docs/领域术语表.md), [update-impact audit](../../../../.agents/skills/codexhost-update-impact-audit/SKILL.md), [czz-dev launch gate](../../../../docs/czz-dev.md)
- Excluded unrelated dirty documents: 主检出的 `docs/czz-dev.md` 改动与未跟踪 `.codemark/`（不属于本任务）

```json documentation-sync-group-v1
{
  "schema": "documentation-sync-group-v1",
  "group_key": "dsg:codex-host:1631-transcript-turn-header",
  "group_owner": "vibe/specs/260903/1631-transcript-turn-header/spec.md",
  "documents": [
    "vibe/specs/260903/1631-transcript-turn-header/raw-requirement.md",
    "vibe/specs/260903/1631-transcript-turn-header/spec.md",
    "vibe/specs/260903/1631-transcript-turn-header/changes.md",
    "vibe/specs/PROJECT_STATUS.md",
    "openspec/changes/add-composer-workspace-bar/proposal.md",
    "openspec/changes/add-composer-workspace-bar/design.md",
    "openspec/changes/add-composer-workspace-bar/tasks.md",
    "openspec/changes/add-composer-workspace-bar/specs/renderer-composer-workspace-surface/spec.md",
    "openspec/changes/add-external-thread-multi-turn-rollback/proposal.md",
    "openspec/changes/add-external-thread-multi-turn-rollback/tasks.md",
    "packages/renderer-extension/src/composer-overlay.preview.html",
    "README.md",
    "docs/README.en.md",
    "docs/README.ko.md",
    ".agents/skills/codexhost-update-impact-audit/SKILL.md",
    "docs/领域术语表.md"
  ],
  "dependencies": [
    "packages/renderer-extension/src/renderer-turn-header.ts",
    "packages/renderer-extension/src/renderer-turn-header-row.ts",
    "packages/renderer-extension/src/renderer-turn-header-workspace.ts",
    "packages/renderer-extension/src/renderer-turn-action-controller.ts",
    "packages/renderer-extension/src/renderer-turn-actions.ts",
    "packages/renderer-extension/src/renderer-workspace-surface.ts",
    "packages/renderer-extension/src/renderer-workspace-files-state.ts",
    "packages/renderer-extension/src/renderer-native-diff-controls.ts",
    "packages/renderer-extension/src/renderer-thread-composer.ts",
    "packages/renderer-extension/src/renderer-overlay-layout.ts",
    "packages/renderer-extension/src/renderer-conversation-files.ts",
    "packages/renderer-extension/src/renderer-binding-probe.ts",
    "tests/e2e/renderer-composer-workspace-surface.spec.ts"
  ],
  "validators": [],
  "git_scope_prefixes": [
    "vibe/specs/260903/1631-transcript-turn-header",
    "vibe/specs/PROJECT_STATUS.md",
    "openspec/changes/add-composer-workspace-bar",
    "openspec/changes/add-external-thread-multi-turn-rollback"
  ]
}
```

## 0. 基线

- 本 worktree `codex-host@claude/codex-conversation-display-f54032` 起点 `dea7498`（= `main`），落后 `czz-dev` 93 个提交、0 个独有提交；第 0 步 `git merge --ff-only czz-dev` 到 `dd25c65`。`node_modules` 缺 DeepSeek 依赖导致 `tsc -b` 报错，`npm install` 后通过。
- 前序 owner：[0929-worktree-surface-overhaul/plan.md](../0929-worktree-surface-overhaul/plan.md)。其 §8 真机结构：`.thread-scroll-container` 为 `flex column-reverse`，首子元素为内容列；Composer 容器 `absolute bottom-0` 213px；轮次 `x=846..1582` 与 Composer `x=846 w=736` 同列；用户气泡横跨整行。用户 11:46 否决过：动作簇压提示词正文、半透明 chip、与原生编辑模式重复、状态栏盖住最后两行、`+0/-0` 噪音。
- Desktop 未运行；desktop-controller 启动时一次性读入 Renderer 源，改动只在用户授权正常退出 + `codexhost launch` 后生效（[czz-dev.md](../../../../docs/czz-dev.md)）。
- 不改 Host / 协议 / Adapter / Rust：所需 RPC（`codexhost/thread/inspect` 的 `rollback` 位、`thread/rollback`、`codexhost/thread/redo`、`codexhost/thread/workspace/inspect|updated`、`item/fileChange/patchUpdated`）在 `czz-dev` 已齐。

## Requirement Delta

- Add: 每个已验证的线程 Composer 一条置顶轮次头（body 子节点、fixed、实色、钉在滚动容器顶缘且在 `header[data-pip-obstacle="app-shell-header"]` 之下、对齐 Composer 列）；视口推导的当前轮（rect 二分 + 6px 迟滞 + 末尾 24px 容差）；气泡滚出后才显示的提示词（点击回到轮次起点、chevron 展开全文）；内容列 `padding-top` 预留（保留 Desktop 自带 padding 与间隔，卸载还原）；生成中禁用动作；当前轮涉及文件「本轮」标记；`data-codexhost-overlay` 面层根标记。
- Modify: 编辑 / 回滚 / Redo 从「点击选中的轮次」改为「当前轮」；工作区状态从 Composer 上方的底部栏改为置顶栏第二行，`+N` 列表与文件披露向下弹出，预览夹在置顶栏与 Composer 之间；原生编辑模式隐藏动作而不是隐藏整条。
- Remove: 底部状态栏与其 `padding-bottom` 预留；hover「⋯」chip、rail 与轮次旁浮动簇；点轮次选中、绿框与「本轮过滤」；`turnActionOrigin` / `turnActionPlacement` / `railDotVisible` / `overlayTopAboveComposer` / `nativeTurnChromeBox`。
- Clarify: 官方 Codex 线程同样显示置顶栏（编辑走官方铅笔、回滚透传 `thread/rollback`、Redo 只在本会话回滚后启用并退回官方 Redo）；文件仍不回退；`M` 只数 DOM 里的轮次。

## Requirement Change Review

| 项 | 判定 | 说明 |
| --- | --- | --- |
| renderer spec「Renderer mounts a compact changed-files surface beside the Composer」 | `superseded` | 改写为「…as the Turn header's second row」；不再有任何 codexhost 面层浮在 Composer 之上 |
| renderer spec「Turn actions are honest, reachable, and stay out of the transcript text」（`dd25c65` 最新措辞：恰好一个 hover「⋯」） | `superseded` | 改写为「Turn actions live in the Turn header and act on the current Turn」，新增三个 scenario |
| renderer spec「Chips overflow the single line」「File changes expand from the right…」 | `changed` | `+N` hover 预览 / click 钉住且不改高度；文件列表向下、预览夹在置顶栏与 Composer 之间、滚动即收起、「本轮」标记 |
| add-external-thread-multi-turn-rollback proposal Impact / tasks 2.4–2.5 | `changed` / `added 2.6` | hover chip 与 rAF 重定位被置顶栏取代 |
| 已发布 `openspec/specs/external-thread-fork-routing/spec.md` L57-60「原线程 rollback 应拒绝」 | `conflicting / pending-archive` | 前序任务已登记的漂移，本任务不动已发布 spec |
| 本计划自定的 D-1…D-6（文件语义对话级、生成中禁用、向下浮层不改高度、原生编辑不整条消失、短线程放宽滚动容器判定、OpenSpec 落在同一 change） | `added` | 均在计划文件与本文记录；用户批准计划即接受 |
| Decision source | `explicit-current-request` | 用户四个回答（见 raw-requirement）+ 批准的计划 |

## Prior Task Overlap

- 与 [0929-worktree-surface-overhaul](../0929-worktree-surface-overhaul/plan.md) 为 `continuation`：其切片 1（状态栏）与切片 2（轮次动作）的 UI 层被本任务取代，Host 切片 3 / 4 不动；复用了其 inspect 能力位、Composer 身份、分组与预览逻辑。
- 与 [2042-external-thread-redo](../../260901/2042-external-thread-redo/spec.md)：Redo 语义不变（Host 一槽、官方线程兜底官方 Redo）。

## Verification Impact Trace

| 行为 | 证据 | 状态 |
| --- | --- | --- |
| 当前轮推导（迟滞、末尾、回滚后越界） | `renderer-turn-header.test.ts` | 通过 |
| 提示词出现规则、置顶栏定位、顶部预留、滚动增量 | `renderer-turn-header.test.ts` | 通过 |
| 动作控制器（位置计数回滚、inspect 每线程一次、官方 Redo 兜底、编辑确认与铅笔、换轮清确认） | `renderer-turn-action-controller.test.ts` | 通过 |
| 文案 / 能力位 / 原生控件排除 / 提示词节点解包 | `renderer-turn-actions.test.ts` | 通过 |
| 分组、标签、通知、`previewOrigin(minTop)` | `renderer-workspace-surface.test.ts` | 通过 |
| 置顶栏几何、预留、滚动切轮、提示词、动作、原生编辑、生成中、第二行、`+N`、预览、卸载 | Playwright `renderer-composer-workspace-surface` | 通过 |
| 类型、边界、格式 | `npm run typecheck`、`npm run lint`（eslint + `tools/check-boundaries.mjs`）、prettier、`git diff --check`、`npm run build:renderer` | 通过（每个提交） |
| 全量 `npm test`、`gate:*` | — | 未跑（按 AGENTS.md 默认不跑） |
| 真机（顶缘 chrome、用户气泡节点、分页、`thread/reverted` 重读、三条投诉） | 见 §真机清单 | `[待真机]` |

Verification Decision: focused（renderer 单测 + Composer E2E + 静态门），真机留待重启。

## 真机清单（用户授权正常退出 + `codexhost launch` 之后）

1. 滚动容器 rect / `flex-direction` / `overflow-y` / padding / `scrollTop` 符号。
2. `header[data-pip-obstacle="app-shell-header"]` 与所有 `[data-pip-obstacle]` rect；`elementsFromPoint` 是否命中内容列之外的元素（缩略面板、标题栏）。
3. 内容列 padding、是否含 Composer、有无 sticky 后代。
4. `[data-turn-key]` top 单调、key 形状、嵌套 / 重复、50+ 轮 DOM 数 vs Host 轮数。
5. 用户气泡：稳定属性、rect、是否等于 `turn.firstElementChild`；`turnPromptText` 是否只含提示词。
6. 官方铅笔在静止 / hover 时是否存在。
7. Stop 按钮标签。
8. 临时外部线程回滚：`[data-turn-key]` MutationRecord、稳定时间、瞬时 0 轮。
9. Composer rect 与轮次列差、`offsetParent`、祖先 transform/filter。
10. 原生编辑模式的 DOM 形态。
11. 容器背景色（可选让 `--codexhost-turn-header-bg` 融入）。

验收：header 在 5 个滚动位置 rect 逐字节相同；气泡可见时提示词段为空且 codexhost 不在气泡上画任何东西；滚到底最后一行完全在 Composer 之上且无 `[data-codexhost-workspace-reserve]`；草稿态无 header；官方与外部线程都有；`lastTurnOnly` 线程显示禁用原因；用户打开官方编辑时动作隐藏。

## Documentation Impact

- `requirement-canonical`：OpenSpec `add-composer-workspace-bar`（四段 Requirement、proposal、design Decision 8 / Migration 5、tasks §13）与 `add-external-thread-multi-turn-rollback`（Impact、tasks 2.6）。
- `project-current`：本 owner、[PROJECT_STATUS.md](../../PROJECT_STATUS.md)、预览页、README 三语矩阵、update-impact 清单、术语表。
- 错误记忆：不写。「body 挂载 fixed 面层需在内容列预留空间」只在真机验证后登记。

## Execution Journal

| # | 时间（+08:00） | 事件 |
| --- | --- | --- |
| E1 | 16:31–17:1x | 计划：三路探查 + 三路设计；发现 worktree 落后 `czz-dev` 93 提交；用户四个回答；计划批准 |
| E2 | 17:21 | 切片 0：快进到 `dd25c65`；基线 renderer vitest 32 文件 231 例通过、E2E 通过；`npm install` 后 typecheck 通过 |
| E3 | 17:3x | 切片 1 `5ca8085`：纯搬迁 + 置顶栏纯几何 + 单测拆分 |
| E4 | 17:4x–17:5x | 切片 2 `6513243`：第一行 + 控制器；E2E 夹具改 column-reverse（发现内容列必须 `flex-shrink: 0` 才会溢出、`scrollTop` 在底部为 0 向上为负）；官方线程保留本地 Redo 标记 |
| E5 | 18:0x | 切片 3 `98fe202`：第二行 + 删底部栏；发现向下列表需以置顶栏为定位基准、Composer 尺寸变化需 ResizeObserver、核心 chip 先让宽 |
| E6 | 18:1x | 切片 4：文档、预览页、README、清单、术语表 |
| E7 | 待办 | 用户重启后真机量测，登记结果，按需写错误记忆 |

## Closeout

- 代码规模：`renderer-turn-header.ts` 613 行（高于 500 的评审信号、低于 800 的拆分信号；第一行视图与第二行绘制已各自成模块）。
- 行为变化需告知：Side Chat 两个 Composer 共用一个滚动容器时不挂置顶栏；`dist/index.js` 外部消费者未知（仓库内无引用）。
