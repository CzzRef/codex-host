# czz-dev 自研功能清单（fork 相对上游的功能补充）

成表 2026-09-07，末次复核 2026-09-07（见第 6 节）。

对照基线：`upstream/main` = `de24f83`（BytePioneer-AI/codex-host，2026-09-06）；本地 `czz-dev` = `24b9464`；**merge base 就是 `de24f83` 本身**——上游 41 条提交已由合并提交 `9d49f3a` 并入，`upstream/main` 相对 `czz-dev` `ahead=0`，本地领先 158 条。也就是说本表此刻**没有未消化的上游债务**，全部 36 行都是相对当前上游 tip 的净增量。

这份文件是 **常驻对照台账**，不是任务卡。它回答一个问题：`czz-dev` 上有哪些功能是本 fork 自己加的、上游至今没有的。每次合并 `upstream/main` 之前先读这里，逐项判定去留。

## 1. 为什么需要这份台账

fork 与上游会持续双向演进。上游后来做了同一件事时，只有两种正确结局：

1. **上游做得更好** → 以上游为准，本地实现删除或退化为薄适配，并在本表里把该行标记为 `superseded-by-upstream`，写明上游落点。
2. **上游没做或做得更弱** → 合并时必须把本地实现**保留并适配到上游的新形态**，不能因为冲突就丢掉。第 3 节每行的「合并对照要点」就是这条适配的判据。

反例已经发生过：upstream v0.5.0 把 DeepSeek Harness 重写成 `legacy/` + `modern/` 两代，两代都不含 steer，本地的 `turn.steer` 与原生标题必须重新移植回去——`HarnessSession` 接口要求 steer 重载，不补连编译都过不了。这类「必须补回」的项在本表里就是 `keep-and-adapt`。

## 2. 判定口径

| 状态 | 含义 | 合并动作 |
| --- | --- | --- |
| `local-only` | 上游至今没有等价能力（本轮实测） | 保留；冲突时把本地实现适配到上游新形态 |
| `upstream-partial` | 上游有相近能力但不覆盖本地语义 | 保留差量，公共部分让给上游 |
| `superseded-by-upstream` | 上游实现更完整 | 删除本地实现，只留必要的本地接线 |

判定必须**实测**：以 `git grep` / `git ls-tree` 在 `upstream/main` 上核符号与文件，不凭 changelog 与印象。本表第 3 节全部 36 行的「上游现状」列都是按这个方式测出来的。

复核命令（更新基线时重跑）：

```bash
git fetch upstream && git diff --diff-filter=A --name-only "$(git merge-base czz-dev upstream/main)" czz-dev
```

需求侧还有一条快速信号：`openspec/changes/` 下**本地独有**的变更包就是自研需求的归档面。2026-09-07 复核：本地 29 个、上游 13 个（各含一个 `archive/`），差集 **16 个**变更包（较成表时 +2，即补写的 `add-delegation-thread-pin` 与 `add-external-composer-selector-fidelity`）。差集口径：

```bash
comm -23 <(ls openspec/changes/ | sort) \
  <(git ls-tree --name-only upstream/main openspec/changes/ | sed 's|openspec/changes/||' | sort)
```

## 3. 功能清单

### A. 新增 Harness

| # | 能力 | 主要落点 | 需求归档 | 上游现状 | 合并对照要点 |
| --- | --- | --- | --- | --- | --- |
| A-1 | **Cursor 适配器**：ACP 传输、`~/.cursor/acp-sessions` 原生历史与 resume/snapshot、模型目录、权限模式、插件形态（`manifest.json` / `src/plugin.ts` / `assets/icon.svg`） | `packages/adapters/cursor/`（整包，19 个文件） | [czz-dev.md](czz-dev.md)、[260902 spec](../vibe/specs/260902/1502-cursor-native-history/spec.md) | `local-only`：`upstream/main` 的 `packages/adapters/` 只有 antigravity / claude-code / deepseek-harness / grok / omp / opencode / pi 七家，无 cursor | 上游若自建 Cursor 适配器，比对 ACP 历史恢复与 `NativeTurnRef` 对齐度再决定取舍；上游改插件装载机制时（如 v0.5.0 的 `harness-plugin-loader`）本包必须同步换形态，否则装不进去 |

### B. 轮次交互语义

| # | 能力 | 主要落点 | 需求归档 | 上游现状 | 合并对照要点 |
| --- | --- | --- | --- | --- | --- |
| B-1 | **外部线程插队（turn/steer）走各 Harness 原生原语**：Claude PushableInput、Grok `_x.ai/interject`、Pi/OMP RPC `steer`、DSH `session.prompt mode:steer`、Cursor cancel→同轮 re-prompt；无原生原语才回退 follow-up 队列 | `packages/host-runtime/src/app-server-host.ts`、各 adapter、`packages/adapters/grok/src/grok-interject.ts` | [add-external-turn-steer-queue](../openspec/changes/add-external-turn-steer-queue/proposal.md) | `local-only`：`turn.steer` 在上游只有 6 处（接口占位），本地 23 处 | **最高风险项**。上游重写任一 adapter 都会抹掉 steer 重载，且 `HarnessSession` 要求该重载，漏补即编译失败。每次合并按 adapter 逐个核对 |
| B-2 | **插队同轨为 Turn 内 `userMessage` 条目**：五家实时发出 + 历史折叠回原 Turn，不再切新 Host Turn、不再拼进 Turn input | `packages/protocol-core/`、各 adapter history 映射 | [add-in-turn-interjection-items](../openspec/changes/add-in-turn-interjection-items/proposal.md) | `upstream-partial`：`userMessage` 上游 19 处（官方投影用），本地 39 处 | 折叠启发式（Pi `stopReason: toolUse` / `message.timestamp`、Claude `command_lifecycle` uuid、Grok `<user_query>` 剥壳）与各家历史格式强绑定，上游改历史映射就要重测 |
| B-3 | **外部线程 last-turn 回滚后的 Host Redo**：一格 `historyRedo` 槽位 + `codexhost/thread/redo` | `packages/host-runtime/src/external-thread-redo.ts` | [add-external-thread-last-turn-redo](../openspec/changes/add-external-thread-last-turn-redo/proposal.md) | `local-only`：`historyRedo` 上游 0 处、本地 11 处；`external-thread-redo` 文件上游不存在 | Codex Desktop 无 `thread/redo`，官方 Redo 只是应用动作栈。上游若补官方 Redo，只对 Codex 自有线程有效，外部线程仍需本地实现 |
| B-4 | **外部线程多轮回滚**：按线程自身 Native Checkpoint 走 `open({kind:"fork"})` 重开，inspect 发布 `rollback: {lastTurn, multiTurn}`，分页线程补发 `thread/reverted` | `packages/host-runtime/src/external-thread-rollback.ts`（本地 +215 行） | [add-external-thread-multi-turn-rollback](../openspec/changes/add-external-thread-multi-turn-rollback/proposal.md) | `upstream-partial`：文件存在，多轮语义为本地扩展 | 该文件是冲突高发点，合并后必须重跑 `rollback` 能力位与 `thread/reverted` 用例 |
| B-5 | **编辑语义 = 回滚到本轮之前再重发**（而非原地改写），跳转改用 `scrollIntoView` | `packages/renderer-extension/src/renderer-turn-action-controller.ts` | [260903 tasks](../vibe/specs/260903/1631-transcript-turn-header/changes.md) | `local-only` | 依赖 B-3 / B-4；上游若引入官方编辑语义，比对是否同样先回滚 |

### C. 委派 CLI 与外部线程管理（EyPc 等外部消费面）

| # | 能力 | 主要落点 | 需求归档 | 上游现状 | 合并对照要点 |
| --- | --- | --- | --- | --- | --- |
| C-1 | `codexhost thread rename`：持久化标题 + 广播 `thread/name/updated`；区分 Desktop 手改名与首条消息兜底名 | `packages/host-runtime/src/delegation-cli.ts` | [add-external-thread-rename](../openspec/changes/add-external-thread-rename/proposal.md) | `local-only` | 兜底名判别依赖 `titleSource` / preview 形状，上游改标题来源即需重测 |
| C-2 | `thread list --all`：省略 cwd 过滤列出全部额外进程 | 同上 | [add-delegation-thread-list-all](../openspec/changes/add-delegation-thread-list-all/proposal.md) | `local-only` | 低风险 |
| C-3 | `thread list --archived` + 行上 `archived` 字段 | 同上 | [add-delegation-thread-list-archived](../openspec/changes/add-delegation-thread-list-archived/proposal.md) | `local-only`：`archived` 上游 12 处（Desktop 侧），CLI 视图为本地新增 | EyPc 靠它感知线程被归档，缺了任务会永远停在「已完成未读」 |
| C-4 | `thread archive|unarchive`：与 Desktop 共用归档持久化与 `thread/archived` 广播；级联 ephemeral side chat；`thread list` 把运行中 side chat 汇总到来源行 | 同上 | [add-delegation-thread-archive](../openspec/changes/add-delegation-thread-archive/proposal.md) | `upstream-partial`：上游 `app-server-host.ts` 已有 Desktop 侧 `thread/archive` / `thread/unarchive` RPC 与 `thread/archived` 广播；**委派 CLI 入口上游 0 处**（`delegation-cli.ts` 无 `unarchive`） | 差量是 CLI 入口 + side chat 级联 + 列表汇总，不是归档本身。官方 app-server 不认识外部 id，CLI 这条通路无替代 |
| C-5 | `thread pin|unpin` + 外部线程按 Desktop 分区置顶（持久化 section 成员与 pinned，不改 recency） | `delegation-cli.ts`、`external-thread-repository.ts` | [add-delegation-thread-pin](../openspec/changes/add-delegation-thread-pin/proposal.md)、提交 `c852197` / `f21d2b7` | `local-only`：`thread/pin` 上游 0 处、`sectionId` 上游 0 处 | 与 C-1 / C-4 同形态（Host 持久化 + 同款通知 + 列表字段）；上游若补外部线程置顶，先比对是否同样不改 recency |
| C-6 | **外部线程未读建模**：Host 内存态未读集合 + `thread list` 行上 `hasUnreadTurn` | `packages/host-runtime/src/app-server-host.ts` | [add-external-thread-unread](../openspec/changes/add-external-thread-unread/proposal.md) | `local-only`：`hasUnreadTurn` 上游 0 处 | Desktop 只为原生 Thread 持久化未读，外部线程未读点只存在渲染层 |
| C-7 | **Desktop bypass 跟随进外部会话** + 行上 `attention: "approval"` | `app-server-host.ts` | [add-desktop-bypass-follow](../openspec/changes/add-desktop-bypass-follow/proposal.md) | `local-only`：`attention` 上游 1 处（无关用法） | Adapter 以 `unsupported` 拒绝时须回退原生默认而非创建失败 |
| C-8 | `delegate start --permission-mode <mode-id>`：CLI 子线程无审批人，默认模式下受保护工具调用会把 Turn 打断为 `interrupted` | `delegation-cli.ts`、`harness-delegation-coordinator.ts` | [add-delegation-permission-mode](../openspec/changes/add-delegation-permission-mode/proposal.md) | `local-only` | 与 F-1 词表联动 |
| C-9 | **委派 Skill 安装到三个技能根**（`~/.agents` / `~/.claude` / `~/.cursor`）并教会被托管 Agent 给自己这条会话改名 | `packages/host-runtime/src/delegation-skill.ts`（本地 +36/−7） | 提交 `1fb82a4` / `cc95430` | `upstream-partial`：上游有 `delegation-skill.ts`，只装 `~/.agents`，无自我改名说明 | 上游改 Skill 正文会冲掉本地 digest 白名单，合并后须重算 `CURRENT_DIGEST` |
| C-10 | **Side Chat 绑定来源线程**：ephemeral 派生线程按 `forkSource` 导航、默认列表省略、projectless fork 停留源会话 | `packages/host-runtime/src/`、`renderer-extension` | [add-sidechat-parent-navigation](../openspec/changes/add-sidechat-parent-navigation/proposal.md) | `upstream-partial`：`forkedFromId` 上游已有，导航绑定为本地新增 | — |

### D. Composer / Renderer 界面

| # | 能力 | 主要落点 | 需求归档 | 上游现状 | 合并对照要点 |
| --- | --- | --- | --- | --- | --- |
| D-1 | **置顶轮次头**：`第 N/M 轮`（取 Host `turnIds`，不数虚拟化 DOM）+ 气泡滚出后钉住当前轮提示词 + 编辑/回滚/Redo 作用于当前轮 + 上一轮/下一轮箭头 | `renderer-turn-header.ts` / `-row.ts` / `-workspace.ts`、`turn-header.css` | [260903 spec](../vibe/specs/260903/1631-transcript-turn-header/spec.md) | `local-only`：`renderer-turn-header` 上游 0 处 | 强依赖 Desktop DOM（`data-user-message-bubble`、history-gap 占位、虚拟化窗口），**Desktop 每次升级都要真机复核** |
| D-2 | **工作区面**：按 root 分组的仓库 / worktree / 子模块、本轮变更文件、`+N` 溢出、hover 预览 | `thread-workspace.ts`、`renderer-workspace-surface.ts`、`workspace-surface.css` | [add-composer-workspace-bar](../openspec/changes/add-composer-workspace-bar/proposal.md) | `local-only`：`thread-workspace` 上游 0 处 | 官方 Desktop 知道 Git/worktree 状态但不在 Composer 暴露；上游若补，比对是否含 sibling worktree 与 external root 解析 |
| D-3 | **草稿「工作树 ▾」选择器 + Host 自管 worktree**：`codexhost/workspace/worktree/list|create`、`git worktree add -b codex/yyMMdd-x`、desktop-control 改写 `thread/start.cwd` | `workspace-worktree.ts`、`renderer-draft-worktree-picker.ts` | 同上（slice 3） | `local-only`：`worktree/list` 上游 0 处 | 依赖 Desktop 的 `executionTargetOverride.cwd` / `gitRootForStartingState` props 键，Desktop 升级易失效 |
| D-4 | **新建 worktree 自动取名**：从草稿提示词生成 `yyMMdd-core`，八家 Harness 共用 | `packages/shared-contracts/src/workspace-worktree.ts` | 提交 `b3cd6ef` | `local-only`：`suggestWorkspaceWorktreeName` 上游 0 处 | 低风险 |
| D-5 | **Tab 复用上一条隐式提示词**（不抢 mention） | `renderer-composer-prompt-reuse.ts` | [add-composer-workspace-bar](../openspec/changes/add-composer-workspace-bar/proposal.md) | `local-only`：`promptReuse` 上游 0 处 | 与官方 Tab 补全的键位竞争，Desktop 升级需复测 |
| D-6 | **按 Harness 隐藏模型的设置页**与本地偏好 | `settings/models-page.ts`、`renderer-model-visibility-preference.ts` | 提交 `8e7605b` | `local-only`：`models-page` 上游 0 处 | 上游本轮正在改 Settings 页（多账号积分），合并时设置页注册表冲突 |
| D-7 | **外部权限选择器不依赖原生核验**（首轮后仍可见、隐藏多余原生按钮）+ **模型标签统一为 `<Harness 缩写>·<Model 名>`**（前缀由 Host 在两处投影点统一施加，缩写表为唯一权威） | `renderer-composer-dom.ts`、`shared-contracts/harness-model-label.ts`、`app-server-host.ts`、`harness-delegation-coordinator.ts`（目录链 2 处 + 会话状态 `resolvedModelLabel` 5 处） | [add-external-composer-selector-fidelity](../openspec/changes/add-external-composer-selector-fidelity/proposal.md)、提交 `5961fe1` / `f5550d9` | `local-only`：`harness-model-label` 与缩写前缀上游 0 处 | 缩写前缀是用户的常驻默认偏好，新增 Harness 必须登记一条（回归测试对预装清单逐个断言）。上游 `635a890` 曾把 DeepSeek 标签写回 `provider / model`，本轮以缩写规则取代该处，冲突已消解 |
| D-8 | **Cursor 空模型目录按原生默认模型发送**：`empty` 目录 = Harness 原生默认（仅 Cursor，Claude Code 的空目录仍是终态阻断），载体 `codexhost/cursor-native@@<mode>` | `renderer-composer-model-ready`、`cursor-transport-selection.ts` | [260903 任务卡](../vibe/specs/260903/1025-cursor-native-default-draft/task-card.md) | `local-only` | 冷启动空目录分支尚未真机覆盖（见第 4 节） |

### E. Host↔Harness 输入契约

| # | 能力 | 主要落点 | 需求归档 | 上游现状 | 合并对照要点 |
| --- | --- | --- | --- | --- | --- |
| E-1 | **附件输入契约**：`HostFileInput`（宿主绝对路径，不内联字节）扩展轮次输入为可辨识联合；能力矩阵新增 `input` 段；三级投递 `native` / `path-text` / `rejected`，**禁止静默丢弃**；四家原生转换（Grok/Cursor ACP `resource_link`、Claude base64 image/document、OpenCode URL 形态 `FilePartInput`），pi/omp/antigravity/DSH 降级为路径行；Host 侧 `validateHostFileInputs()` 接进 Broker 派发前 | `harness-adapter/src/turn-input.ts`、`file-input-validation.ts`、各 adapter | [add-harness-file-input](../openspec/changes/add-harness-file-input/proposal.md) | `local-only`：`HostFileInput` 上游 0 处、本地 17 处 | 上游 `turnStartSchema` 与 `harnessSessionCapabilitiesSchema` 都是 `.strict()`，上游任何 schema 改动都会顶掉本地联合类型，**合并时必检** |

### F. 权限模式

| # | 能力 | 主要落点 | 需求归档 | 上游现状 | 合并对照要点 |
| --- | --- | --- | --- | --- | --- |
| F-1 | **权限模式统一词表**：`HarnessPermissionMode` 增加可选 `canonical`（`plan`/`ask`/`auto`/`bypass`），原生 id 仍是唯一线上值；选择器按固定顺序渲染四档，标题「共享名 · Harness 原名」，缺失档位禁用并写明原因而非隐藏 | `shared-contracts/src/harness-permission-modes.ts`、`renderer-permission-mode-picker.ts` | 提交 `7cd5ca2`、[czz-dev.md](czz-dev.md) | `local-only`：`canonical` 字段在上游该文件 0 处 | 纯呈现层，不改传输语义，已有线程不受影响；上游新增 Harness 时要补打标 |
| F-2 | **Cursor 合成 `codexhost-bypass`**：由 Host 应答 ACP `session/request_permission`（自动 `allow_always`），**不加** `--force` / `--yolo` / `--trust`，合成 id 不发给 CLI，逐线程生效 | `packages/adapters/cursor/` | 同上 | `local-only`：`codexhost-bypass` 上游 0 处 | 若 Cursor CLI 自己补了 bypass，改用原生并删除合成模式 |

### G. 启动器、工具链与本机源码线

| # | 能力 | 主要落点 | 需求归档 | 上游现状 | 合并对照要点 |
| --- | --- | --- | --- | --- | --- |
| G-1 | **源码 checkout 启动入口** + 委派 CLI 在源码检出下回退到本地 Host Runtime | `crates/launcher/src/main.rs`、`runtime_instance.rs` | 提交 `f4d11a3` / `e12a5e8`、[260902 任务卡](../vibe/specs/260902/1312-launcher-source-checkout-cli/task-card.md) | `local-only` | 上游只面向发行版安装布局；上游本轮新增 `scripts/install-local.sh`，合并时判定是否可替代 |
| G-2 | **控制器随父进程退出回收**：platform 新增 `termination_signal`，launcher 监督循环按信号回收控制器；desktop-control 监视父进程消失即自退 | `crates/platform/src/termination_signal.rs`、`packages/desktop-control/src/parent-process-watch.ts` | [260902 任务卡](../vibe/specs/260902/1349-launcher-controller-reap/task-card.md) | `local-only`：两处文件上游均不存在 | 端到端 SIGTERM 已验证；上游改进程模型时须重测 |
| G-3 | **本机源码 CLI**：`npm start` 指向 `tools/local-source/cli.mjs launch`，另有 `install:source` / `doctor:source` | `tools/local-source/` | 提交 `0b7dce6` | `local-only` | 与 G-1 同源；上游 `scripts/install-local.sh` 可能重叠 |
| G-4 | **`codex-desktop-live-check`**：自动识别 Desktop 版本 / asar 摘要 / fuse 位，拉起或附着 CDP 并探测 Renderer，给出 owner 归属的判定 | `tools/codex-desktop-live-check/` | 提交 `6bf88c8` | `local-only` | Desktop 26.901 起关闭 inspect fuse，这是本地真机复核的唯一自动化入口 |
| G-5 | **启动前拒绝过期 Renderer bundle** | `tools/` | 提交 `9163f45` | `local-only` | 低风险 |
| G-6 | **Claude 模型目录缓存跟随安装身份刷新**：command/transport 暴露 `ClaudeInstallationIdentity`（版本链接 + 指纹），身份变化即重新 inspect；未知身份保留缓存，可执行文件缺失报 `notInstalled` | `packages/adapters/claude-code/src/command.ts` | [260902 任务卡](../vibe/specs/260902/1352-claude-catalog-refresh/task-card.md) | `local-only`：`claudeInstallationIdentity` 上游 0 处 | Claude.app 自带独立 CLI 安装线，与 PATH 那份版本不同，缺此项会读到陈旧目录 |
| G-7 | **Grok 标题 sidecar overlay** 与外部线程标题 overlay：优先读会话目录 sidecar 避免 summary 被活进程覆写，打开 Session 时 watch 原生标题变化 | `adapters/grok/src/grok-title-overlay.ts`、`host-runtime/src/external-thread-title-overlay.ts` | 提交 `32b7700` / `05bfed7` | `local-only`：两处文件上游均不存在 | 与 C-1 改名判别联动 |
| G-8 | **OMP 默认工具审批权限收紧** | `packages/adapters/omp/` | 提交 `c8edadc` | `local-only` | 本机已卸载 OMP，源码保留 |
| G-9 | **Desktop 26.901 兼容**：轮内 steer 用户消息补 `text_elements`，否则打开外部线程进 Desktop 错误边界 | `packages/protocol-core/src/codex-ui-projector.ts` | 提交 `2d8a381` | `upstream-partial`：`codex-ui-projector.ts` 上游 2 处（其自有文本部件），本地 4 处——多出的是轮内 steer `userMessage` 那条（`#L469`） | 由 B-2 引入的字段缺口，随 B-2 存亡；Desktop 升级后须复测投影字段完整性 |

## 4. 真机验证状态（下一轮排查从这里起手）

「上游有没有」与「本机跑起来对不对」是两件事。本表第 3 节只回答前者——**一行判定 `local-only` 只说明代码在本地存在，不保证它在真机上达到预期**。用户反馈某项没达到预期时，先查这一节它属于哪一档，能省掉一轮重复排查。

### 4.1 有真机证据

| 行 | 证据 |
| --- | --- |
| B-1 插队 | 2026-09-07 Desktop 26.901.51231 build 8109：scratch grok Turn `48dfb8ad…` 运行中 `--steer true` 插入后仍是同一 `turnId`、终态 `completed` 而非 `interrupted`，插入消息作为轮内 user item 落在两条 agent 消息之间，Grok 真的改行为。此前 2026-09-02 另有 Grok / Pi / OMP / DSH / Claude 的 scratch 探针 |
| D-1 置顶轮次头 | 2026-09-07 同次：官方与外部 Thread 的 `live-check` 都走 `workspace` 路由、不进错误边界，Turn 头 `{x:437,y:47,w:736,h:41}` 两侧一致。2026-09-04 另有 26.901.22334 上的八个滚动位几何、提示词钉住、箭头、`Turn N/M` 计数复核 |
| D-6 模型可见性设置页 | 2026-09-07 同次：CDP 只读回读设置页注册表为六项，`models`(model-pool) 与 `accounts`(accounts) 并存 |
| A-1 Cursor | 2026-09-05：一条 Cursor 消息路由到 `harnessId: cursor`，`@agent` 端到端带过，零异常 |
| C-1 / C-3 / C-4 改名·归档·列表 | 2026-09-02 15:22 源码重启后生效并回读 |
| C-8 委派权限模式 | 2026-09-02：Grok `always-approve` 探针 `4cd13fa2` 跑完且 Host 标未读 |
| G-6 Claude 目录跟随安装身份 | 2026-09-02 18:50 重启后 Host 5909 回读 `claude-fable-5-1` |
| G-2 控制器随父进程回收 | 2026-09-02 19:15：SIGTERM 端到端，launcher 82835 → controller/Desktop/descriptor 2 秒内消失 |
| D-2 / D-3 工作区面与工作树选择器 | 2026-09-03 11:28 部分验证：状态栏左缘与 Composer 对齐 0px，hover `⋯` 落在轮次右上 |

### 4.2 只有单测，无真机证据

这些行的实现有聚焦用例覆盖，但**没跑过真机**。用户反馈的「没达到预期」最可能落在这里。

- **B-3 Host Redo**：过程枢纽明写「live rollback→Redo on a real external Thread (covered by Host tests only)」。
- **B-4 多轮回滚**：分页线程 `thread/reverted` 再读、各 Harness 自 checkpoint fork 均标 `[待真机]`。
- **B-5 编辑=先回滚再重发**：依赖 B-3 / B-4，同样未验。
- **C-5 `thread pin|unpin`**：侧栏是否真进 Pinned 分区、重启后是否保持，均未验。
- **C-6 外部线程未读**：Host 内存态，重启后从已读起始，真机未回读。
- **C-7 Desktop bypass 跟随**：`attention: "approval"` 的出现与消失未在真机观察。
- **D-4 worktree 自动取名 / D-5 Tab 复用提示词**：只有单测。
- **D-7 权限选择器 + 模型标签缩写**：标签缩写规则是 2026-09-07 本轮刚落，模型芯片文案、菜单搜索打缩写筛选、`·` 在 Composer 宽度下的截断表现**全部未验**。
- **D-8 Cursor 空目录按原生默认**：2026-09-05 真机那次标签读到 `Auto`，说明目录已填充，**空目录分支未被覆盖**，仍需冷启动复现。
- **E-1 附件输入契约**：带附件的真机轮次未跑；进程内路径待有附件生产者时才接线。
- **G-4 live-check 工具 / G-5 过期 bundle 拒绝 / G-7 标题 overlay / G-8 OMP 审批收紧**：无真机记录。

### 4.3 已知结构性缺口

- **D 组整体依赖 Desktop DOM 与 props 键**（`data-user-message-bubble`、`executionTargetOverride.cwd`、`gitRootForStartingState`、原生权限按钮选择器）。Desktop 每次升级都可能让这些行「代码还在但界面上没效果」——这是最容易表现为「功能没达到预期」的一类。

## 5. 已知未闭合项（不影响清单成立，但合并前应知情）

- **上游债务已结清（本表成表当天）**：`upstream/main` 的 41 条提交经隔离 worktree 解 13 处冲突后，以合并提交 `9d49f3a` 快进进 `czz-dev`，任务卡见 [260907 tasks](../vibe/specs/260907/upstream-main-merge/tasks.md)。上游本轮主线为 Codex 多账号额度、外部 Thread 方向变更、PR triage 行为化、Antigravity slash commands/fork/rollback、DeepSeek Modern 消息修订、`scripts/install-local.sh`。该轮已按本表交叉核验：B-1 逐 adapter 复核八家 steer 全部完好（含 v0.5.0 曾被抹掉的 DSH `mode:"steer"` 与 `session/title`），D-6 预警的 Settings 页注册表冲突如期出现并按两侧都留解开，与 B/C 组相邻的「外部 Thread 方向变更」按本地实现保留。**真机 Renderer 复核仍未跑。**
- 真机未覆盖：D-8 的冷启动空目录分支、E-1 的带附件真机轮次、D-1 的分页 `thread/reverted` 再读。
- **D-7 的模型标签规则已重定**：上游 `635a890`（2026-09-03）曾把 DeepSeek 标签写回 `provider / model`，覆盖本地 `f5550d9`——这是本表建立后第一例实测到的上游覆盖。2026-09-07 裁决不是「补回」也不是「让位」，而是换一条更强的规则：标签统一为 `<Harness 缩写>·<Model 名>`，Provider 段在 DeepSeek 与 OpenCode 一并去掉，前缀由 Host 统一补。未闭合：会话状态 `resolvedModelLabel` 走另一条投影链，本轮未加前缀。

## 6. 维护规则

1. 新增一项自研功能时，同一批提交里往本表加一行；能立 openspec 变更包的优先立。截至 2026-09-07，表内每一行都已有 openspec 变更包或任务卡归档。
2. 每次合并 `upstream/main` **之前**，按第 2 节命令重算差集，逐行更新「上游现状」列。
3. 判定为 `superseded-by-upstream` 的行不要删除，改状态并写明上游落点与删除提交——这条历史正是下次判断的依据。
4. 拿到真机结论后，把该行从第 4.2 挪进 4.1 并附证据；真机推翻了某行的实现时，先改第 4 节的档位，再决定第 3 节是否改判——「上游有没有」与「本机对不对」不要互相污染。
5. 本文件是产品事实层，归 `docs/`；过程状态归 [过程枢纽](../vibe/specs/PROJECT_STATUS.md)，需求增量归 [openspec](../openspec/changes/)。三者不互相复述。

## 7. 复核记录

| 日期 | 基线 | 结论 |
| --- | --- | --- |
| 2026-09-07 成表 | `upstream/main` `de24f83` 对 `czz-dev` `e1c0cb5`，merge base `1d021a6`，上游领先 41 | 7 组 36 项建表（A1 / B5 / C10 / D8 / E1 / F2 / G9）。**成表时正文误记为 30 项，2026-09-07 复核时按逐行清点更正** |
| 2026-09-07 补齐 | 同上 | 会话状态 `resolvedModelLabel` 补上同一缩写前缀，第 4.3 节该条缺口关闭；全仓 `tsc -b` / `lint` / `vitest` 266 文件 2887 例全过 |
| 2026-09-07 复核 | `upstream/main` `de24f83` 对 `czz-dev` `24b9464`，**merge base = `de24f83`**，上游领先 0、本地领先 158 | 36 行逐个重测符号：全部仍成立，无一行消失。两行改判为更准确的 `upstream-partial`（C-4 归档、G-9 `text_elements`）。openspec 差集 14→16。新增第 4 节真机验证状态 |
