```json worktree-task-v1
{
  "schema": "worktree-task/v1",
  "task_id": "260907-upstream-main-merge",
  "control_plane": "app-root",
  "target_branch": "czz-dev",
  "repositories": [
    {
      "repo_id": "codex-host",
      "base_sha": "d56a80a1221632a6acd323d0f523ce55aa42bea9",
      "worktree_branch": "codex/260907-upstream-main-merge",
      "task_owner": "vibe/specs/260907/upstream-main-merge/tasks.md",
      "head": "9d49f3a0000000000000000000000000000000000",
      "upstream": null
    }
  ],
  "commit_mode": "verified-milestone",
  "push_mode": "current-message-only",
  "verification_state": "verified-index",
  "push_state": "not-authorized",
  "integration_state": "integrated",
  "next_action": "settle decision 3 (rewire the Renderer steering or drop it) with a composer-driven live check"
}
```

# 合并 upstream/main 到 czz-dev（2026-09-07）

## 背景

用户要求核验主检出是否已并入全部 worktree，并把来源仓库（`upstream` = BytePioneer-AI/codex-host）欠着的分支拉取合并。

核验结论：本机 `git worktree list` 只有主检出一个条目，`.git/worktrees` 为空，`git worktree prune --dry-run` 无可回收项；四个历史 worktree 分支（`codex/260901-composer-workspace-bar`、`codex/260902-checkbox-integrate-gate`、`codex/260902-cursor-native-history`、`codex/260906-upstream-v050-merge`）与 `main`、全部 `origin/*` 相对 `czz-dev` 均 `ahead=0`，即已全部并入。唯一的合并债务是 `upstream/main`。

## 合并面

`upstream/main` 从 `1d021a6` 推进到 `de24f83`，相对 `czz-dev` 多 **41 条提交**；merge base 就是 `1d021a6`（上次 v0.5.0 合并的落点），本地无需回溯更早的分叉。两侧 `package.json` 版本都是 `0.5.0`。

`git diff --stat czz-dev...upstream/main`：126 文件、+16131 / -902。

`git merge-tree --write-tree` 预演：**13 个冲突文件**，全部为 content 冲突，无 modify/delete。

- `README.md`、`package.json`
- `packages/adapters/antigravity/src/antigravity-adapter.ts`
- `packages/desktop-control/src/renderer-draft-prewarm-runtime.ts` + 其 policy 测试
- `packages/host-runtime/src/app-server-host.ts` + 其测试
- `packages/renderer-extension/src/renderer-settings-lifecycle.ts`
- `packages/renderer-extension/src/settings/localization.ts`
- `packages/renderer-extension/src/settings/pages.ts`
- `packages/renderer-extension/src/versioned-renderer-adapter.ts`
- `packages/renderer-extension/test/renderer-model-client.test.ts`
- `packages/renderer-extension/test/settings/localization.test.ts`
- `packages/renderer-extension/test/settings/shell.test.ts`

上游本轮主线：Codex 多账号（账号额度、reset-card 库存与到期、Settings 已登录账号积分）、外部 Thread 方向变更、PR triage 卡片行为化、Antigravity slash commands / fork / rollback、DeepSeek Modern 消息修订、本地安装入口 `scripts/install-local.sh`。

## 任务

- [x] 1.1 在隔离 worktree 上执行 `git merge upstream/main`，保留冲突现场
- [x] 1.2 解 13 处冲突，逐个判定本地改动在上游新形态下是否仍成立
- [x] 1.3 `package-lock.json` 未进冲突面，`npm install` 后无改动
- [x] 1.4 全仓类型检查 + lint/boundaries + 全量 vitest + Rust 测试
- [x] 1.5 真机复核（Desktop Renderer 注入）判定 ok；§决策 3 仍未取舍，见下
- [x] 2.1 由主检出决定集成回 `czz-dev`（快进到 `9d49f3a`）

## 冲突决策（2026-09-07 实测）

多数冲突是两侧都新增，一律都留：上游的 Codex 多账号（账号页、账号额度、reset-card）与本地的 Models 设置页、Host worktree 路由、草稿 cwd 路由并存。设置导航因此变成 `连接 / 模型 / 账号 / 会话导入 / 更新 / 关于` 六项。三处不是「都留」，逐条记：

### 决策 1：官方 Codex 额度改用上游的按账号管理器

本地 `#mergeOfficialRateLimits`（push/pull 仲裁 + TTL）在上游把额度改成 `AccountRateLimits` 后已无任何调用点，直接删除，改用上游的 `#officialRateLimits` / `#resetOfficialUsageState`。同一断言在测试里也从「必然发一次 `account/rateLimits/read`」改成上游的「未绑定账号不得去查默认 runtime 额度」。

单一 `#officialRequestBroker` 被上游的按账号 runtime 池取代，本地留下的两处调用（`#steerOfficialDelegationThread`、`#inspectThreadWorkspace` 读官方 Thread cwd）改走等价的 `#requestOfficial`；`thread/section/move` 的官方腿从裸 `writeFrame(official.stdin, …)` 改走 `#forwardOfficialRequest`，否则拿不到账号路由。

### 决策 2：外部 Thread 的 steer 保留本地原生插入，不采上游的「停-等-起」

上游新增 `ExternalTurnSteering`，自己的注释写明它是 *Host-owned stop-then-start coordination, not a native Harness steer capability*——即先取消当前 Turn 再起一个新的。本地的 `#steerExternalTurn` 是超集：Harness 声明 `turns.steer` 时走**真正的原生插入**（`turn.steer` 注入活跃 Turn，不打断、不新起 Turn），没有原生能力时才退化成取消加排队。

两套语义在同一批 Pi fake session 上直接对撞（上游断言延迟回 `{turnId}` 且并发 `turn/start` 报 -32072；本地断言立刻回 `{}` 且后续消息按序起 Turn），不可能同时成立。**保留本地实现**，理由有三：一是用户 2026-09-02 的验收口径明确「要插入，不要排队/打断」，且 Grok / DSH / Pi / Claude 四家已真机验证；二是项目边界规则要求「按 Harness 原生接口接入，保留其真实能力与语义，而不是发明形似的 Host 行为」，上游那句注释正好承认自己是后者；三是采上游等于静默回退一条已验收的行为。

落地方式是**只摘线不删文件**：删掉上游重复的 `#steerExternalTurn` 与它那条 `turn/steer` 分发，`#externalSteering` 字段与 `hasPending / interrupt / fault / terminal / close` 调用点全部原样保留（`run()` 无人调用，`hasPending()` 恒为 false，这些守卫成为无副作用的空转），`external-turn-steering.ts` 及其单测留在树里。上游那两条与本地语义直接矛盾的集成测试（`steers an external Thread by cancelling…`、`handles synchronous external cancellation…`）已删除，官方 Thread 直通的那条保留。

上游的 turn-start 重构 `#beginExternalTurn`（把建 Turn 与写回包分离、失败改为 throw）是好东西，**留下并接进本地 `#startExternalTurn`**：本地的 null-id 抑制、`alsoAnswer` 同伴回包、首条消息自动命名、失败后 `#dispatchQueuedExternalTurn` 全部保住，busy 判定里补上 `#externalSteering.hasPending()`。

### 决策 3：上游 Renderer 侧 steering 暂不接线（未了项）

`installRendererExternalSteering` 会改写 Desktop 发出的 `turn/start` 为 `turn/steer`，并按「Host 负责 stop/wait/start」去恢复被暂停的跟进队列——它和决策 2 里被摘掉的那半是配套的。留着会让两半语义错位，而判定它是否也能配合本地的原生插入路径需要真机复核（Desktop 重启后观察 Steer 控件），本轮做不到。

因此**只摘掉调用点与 import**（连带清掉空转的 `steeringCleanups`），`renderer-external-steering.ts` 与它的两个测试文件原样留在树里。真机复核时再定：要么接回来配合本地原生插入，要么随决策 2 一并删除。

### 其他

- `package.json`：`start` 保留本地的 `tools/local-source/cli.mjs launch`（那是 `f4d11a3` / `9163f45` 为「拒绝过期 Renderer bundle」专门加的安全入口，不能退回 `tools/dev-desktop/run.mjs`），同时补上上游新增的 `install:local`。
- `antigravity`：`history.fork / forkAcrossCwd / rollbackLastTurn` 与 `subagents.observe / readTranscript` 取上游的 `true`（上游本轮真的实现了），本地的 `input.attachFiles: true` 保留。`turn.steer` 的拒绝分支里 `unsupported()` 辅助函数被上游重写删掉了，改成与该文件其余处一致的内联 `HarnessError`。
- README 能力表：上游把 DeepSeek 的「修订上一条消息」和 Antigravity 的「斜杠命令」补成 ✅，取上游；本地的「置顶轮次头」一行保留。

## 验证

本轮全部在隔离 worktree 内实跑：

- `npm run typecheck` pass
- `npm run lint`（eslint + `tools/check-boundaries.mjs`）pass
- `npx vitest run --config tests/vitest.config.js` → 265 文件，259 passed / 6 skipped；2875 用例，2863 passed / 12 skipped
- `npm run build:typescript`（含 `build:plugins`）pass、`npm run build:renderer` pass
- `npm run test:rust` 全 crate pass（launcher 47 + 42、shim 40、platform 24 等）

未跑：`gate:a` / `gate:c` / `gate:claude`（项目规则要求不主动跑）、Playwright e2e、真机 Desktop 复核。

## 合并落点

隔离 worktree：分支 `codex/260907-upstream-main-merge`，路径在 `<repo-parent>/codex-host-worktrees/codex/260907-upstream-main-merge`（本文件不落机器绝对路径）。主检出 `czz-dev` 在合并期间不被触碰。

## 集成落点

合并提交 `9d49f3a`（双亲 `e1c0cb5` + 上游 `de24f83`），主检出 `czz-dev` 快进到同一提交，`npm install` + `npm run typecheck` 在主检出复验通过。集成后 `upstream/main` 相对 `czz-dev` `ahead=0`，四个历史 worktree 分支与 `main` 同样 `ahead=0`，本机再无未并入的分支。

两处流程偏差如实记下：

- 生命周期闸门的 `commit --phase after` 判定 `commit_shape` 拒绝，理由是「已验证里程碑必须是单亲普通提交」。本轮里程碑本身就是合并提交（双亲），闸门不支持这一形态，因此拿不到 `verified-commit` 收据；提交内容与校验证据本身完好，上一轮 260906 的上游合并同理。
- `gate --action integrate` 判定 `dirty_integration_checkout` 拒绝：主检出有另一会话未提交的改动（`docs/index.md`、`vibe/specs/PROJECT_STATUS.md` 与新建的 `docs/czz-dev-自研功能清单.md`）。先实测这三个路径不在本次合并的改动面内、且快进可行，才走 `git merge --ff-only`，那份未提交工作原样保留、未被暂存也未被提交。

## 与自研功能清单的交叉核验

同日另一会话落成的 [docs/czz-dev-自研功能清单.md](../../../../docs/czz-dev-自研功能清单.md) 正是为「上游支持同一功能时保留还是让位」建立的常驻依据，本轮决策与它逐条对上：

- **B-1 外部线程插队走各 Harness 原生原语**，判定 `local-only` 且标注为**最高风险项**，要求「每次合并按 adapter 逐个核对」。决策 2 保留本地实现即该表的规定动作。清单第 110 行还点名「**外部 Thread 方向变更** 与 B/C 组直接相邻，合并时重点比对」——正是本轮拒收的那个上游特性。
- 合并后按该表要求做了逐 adapter 核对：claude-code / cursor / grok / omp / pi / deepseek-harness(modern) 六家仍声明 `turns: { steer: true }` 并保有 `turn.steer` 重载；DSH 的 `mode: "steer"` 注入与 `session/title` 原生标题（v0.5.0 那次被上游抹掉、当时移植回来的两项）均完好；antigravity / opencode 无原生 steer，antigravity 的显式拒绝分支保留。
- **D-6 按 Harness 隐藏模型的设置页** 判定 `local-only`，并预警「上游本轮正在改 Settings 页（多账号积分），合并时设置页注册表冲突」。实际冲突正在 `settings/pages.ts` 与本地化、外壳测试，按两侧都留解开，导航合成 `连接 / 模型 / 账号 / 会话导入 / 更新 / 关于`。

## 真机复核（2026-09-07，Desktop 26.901.51231 build 8109）

Desktop 版本与 asar `sha256:e2ab6e59…` 与 260906 记下的基线一致，未再升级；上游本轮不动 `crates/`，故沿用既有 launcher 二进制（`strings` 命中 `remote-debugging-port`）。主检出重建 `build:typescript` + `build:renderer` 后，`osascript quit` 优雅退出（Desktop 与 launcher 3 秒内全部退出），再 `codexhost launch` 起新实例：launcher 21578 / Desktop 21580（`--remote-debugging-port=58659`）/ shim 21718 / host-runtime 21720。

### 判定 ok 的项

- `live-check:codex-desktop --open official`：`probe route: workspace`（非 `error-boundary`），turns 4，Turn 头 `{"x":437,"y":47,"w":736,"h":41}`。
- `live-check:codex-desktop --open external`：同为 `workspace` 路由，Turn 头几何完全一致。**外部 Thread 不进 Desktop 错误边界**——这正是 26.901 上 `text_elements` 那次的故障形态，本轮合并后未复现。
- 设置页注册表（CDP 只读 `__codexhostSettingsShellV1.registry()`）实测为六项，本地 `models` 与上游 `accounts` 并存、顺序与图标都对：`connections/connections`、`models/model-pool`、`accounts/accounts`、`session-import/session-import`、`updates/updates`、`about/about`，`defaultPageId=connections`。决策里「设置页两侧都留」的解法在真机上成立。
- **决策 2 端到端验证**：scratch grok 子 Thread `4b974007…`，`delegate start` 得 Turn `48dfb8ad…`，运行中 `thread send --steer true` 插入「改成数到 12 就停，并在最后一行写 STEER-OK」。结果：返回**同一个 `turnId`** 且 `status: running`；终态 `latestTurnId` 仍是 `48dfb8ad…`、`turnStatus: completed`（**不是 `interrupted`**）；messages 视图共 5 条，插入的用户消息作为**轮内 user item** 落在两条 agent 消息之间；Grok 真的改了行为——数到 12 即停并写出 `STEER-OK`，没有继续到 40。若换成上游的停-等-起，这里应当是原 Turn 被取消、换一个新 `turnId`。scratch Thread 已 `thread archive`。

### 未判定为问题的项

三轮 live-check 都稳定报出同样 5 条 `renderer-exception`，形如 `Could not find the language '1093:1101:preload/codex/float-bridge.cjs'`，工具一律归为 `unattributed` 并按固定规则记 `impact`，`verdict` 因此是 `impact`。实测这些**不是本次合并引入、也不属于 codexhost**：该报错串在 Desktop 自带 `app.asar` 中出现 4 次，在本仓源码与 `renderer-extension/dist` 中 0 次；那些「语言名」其实是 `行:行:文件路径` 形态的代码引用围栏信息串（内容还来自 EyPc 等无关仓库的历史会话），是 Desktop 自身高亮器对历史会话文本的解析噪声；在 `turns: 0` 的空 Thread 上同样出现，说明发生在探针之前。三轮中**没有任何一条异常被归到 `codexhost` 或 `app-initial`**。

### 决策 3 仍未取舍

本轮验的是 CLI 侧 `turn/steer`，没有驱动 Desktop 输入框的原生 Steer 控件。新证据对判断有利：Host 侧 `turn/steer` 现在确实交付原生插入，因此上游那半 Renderer 改写（把运行中的 `turn/start` 改写成 `turn/steer`）接回来后，输入框跟进消息也会变成插入而非排队。但它的 `preserveQueuedFollowUps` 是按「会发生一次 interrupt」来暂停/恢复 Desktop 队列的，而原生插入不产生 interrupt，那套簿记是否空转或误判必须单独验。维持摘线现状，留待一次由输入框驱动的真机检查。
