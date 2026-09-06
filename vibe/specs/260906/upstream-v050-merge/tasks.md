```json worktree-task-v1
{
  "schema": "worktree-task/v1",
  "task_id": "260906-upstream-v050-merge",
  "control_plane": "app-root",
  "target_branch": "czz-dev",
  "repositories": [
    {
      "repo_id": "codex-host",
      "base_sha": "133b79032bb18fa66ffa48f06a524356ec11d106",
      "worktree_branch": "codex/260906-upstream-v050-merge",
      "task_owner": "vibe/specs/260906/upstream-v050-merge/tasks.md",
      "head": "133b79032bb18fa66ffa48f06a524356ec11d106",
      "upstream": null
    }
  ],
  "commit_mode": "verified-milestone",
  "push_mode": "current-message-only",
  "verification_state": "planned",
  "push_state": "not-authorized",
  "integration_state": "not-started",
  "next_action": "integrate into czz-dev from the control plane, rebuild the main checkout, then run the Desktop live check there"
}
```

# 合并 upstream/main v0.5.0 到 czz-dev

## 背景

用户更新了 Codex Desktop（ChatGPT.app 26.901.22334 → 26.901.51231，build 7746 → 8109）后要求取远端最新并合并。

`upstream/main` 从 `23025ea` 推进到 `1d021a6`，含 tag `v0.5.0`。相对 `czz-dev`：上游多 87 条，本地多 136 条，merge base `23025ea`。

`git merge-tree` 预演：**34 个冲突文件、约 62 个 hunk**，其中两个是 modify/delete。

## 冲突面

- **架构级（必须先决策）**：上游 `feat: load harness adapters as dynamic plugins` 删除了 `packages/host-runtime/src/adapter-composition.ts` 与其测试，而 `czz-dev` 两者都改过。八个适配器如何挂到动态插件装载上是本次合并的核心问题。
- **host-runtime**：`app-server-host.ts` 4 hunk、`index.ts` 3、`harness-delegation-coordinator.ts` 1、`tsconfig.json` 1、`build-release.mjs` 1，加两处 modify/delete。
- **renderer-extension**：`settings/pages.ts` 5、`settings/localization.ts` 2、`renderer-settings-lifecycle.ts` 2、`renderer-binding-probe.ts` 2、`settings/shell.css` 1，及三个测试文件。
- **适配器**：`deepseek-harness-adapter.ts` 6、`model-catalog.ts` 2、`pi-adapter.ts` 2、`pi-rpc-session.ts` 1、`opencode/sdk-transport.ts` 1、`claude-code/permission-modes.ts` 1。其中 pi / opencode 两处与本地刚落地的 `add-harness-file-input` 改动相邻。
- **其余**：`AGENTS.md` 3、`CLAUDE.md` 1、两份 README、`package-lock.json`、`crates/launcher/src/main.rs`、`protocol-core/model-routing.ts`、两个 `.agents/skills` 参考文档、`tests/release/host-bundle.test.mjs`。

## 任务

- [x] 1.1 在隔离 worktree 上执行 `git merge upstream/main`，冲突现场已保留（34 个 `UU`/`DU` 文件，未提交）
- [x] 1.2 架构取向已定并执行：**接收上游核心**。`adapter-composition.ts` 及其测试接受上游删除（`git rm`），host-runtime 改用动态插件装载。
- [x] 1.3 解 renderer-extension 设置外壳冲突
- [x] 1.4 解六个适配器冲突，确认 `add-harness-file-input` 的改动在插件形态下仍成立
- [x] 1.5 解文档、锁文件与 Rust 侧冲突（`package-lock.json` 取上游后 `npm install` 重新生成）
- [x] 1.6 全仓类型检查 + 全量测试 + Rust 测试
- [ ] 2.1 真机复核：Desktop 26.901.51231（build 8109，asar `sha256:e2ab6e59…`）上跑 `npm run live-check:codex-desktop`，确认 Renderer 注入仍成立
- [ ] 3.1 由主检出决定集成回 `czz-dev`

## 合并落点（2026-09-06 实测）

隔离 worktree：分支 `codex/260906-upstream-v050-merge`，路径在 `<repo-parent>/codex-host-worktrees/codex/260906-upstream-v050-merge`（本文件不落机器绝对路径）。合并已执行并**停在冲突态**，主检出 `czz-dev` 完全没被触碰。

### 架构决策的实测依据

上游 `740455f feat: load harness adapters as dynamic plugins` 共 79 文件 `+3274/-612`：给每个适配器加 `manifest.json`、`src/plugin.ts`、`assets/icon.*`，host-runtime 改为动态装载，`adapter-composition.ts` 及其测试被删除。

关键观察：**它只加插件入口，不改适配器内部**。因此本地刚落的 `add-harness-file-input` 八适配器改动（transport、能力声明）预期能原样存活，冲突集中在 host-runtime 的注册机制。

倾向：`adapter-composition.ts` 取上游侧（接受删除），host-runtime 采用插件装载，再把 czz-dev 特有内容补成插件形态。

### 唯一需要新建插件形态的适配器

`cursor` 是 czz-dev 独有，上游七个适配器（antigravity / claude-code / deepseek-harness / grok / omp / opencode / pi）都已带 manifest 与 plugin 入口，cursor 没有。合并后必须为它补一份，否则它在新装载机制下不会被注册。

## 已完成的适配化改造（2026-09-06）

### cursor 补齐插件形态（本次合并唯一必须新建的适配器）

czz-dev 对 `adapter-composition.ts` 的全部改动其实只有 9 行——注册 cursor。上游删掉该模块后，等价物就是给 cursor 补一套与另外七个一致的插件入口：

- `packages/adapters/cursor/manifest.json`：`manifestVersion: 1` / `id: cursor` / `adapterApiVersion: 1` / `entry: ./dist/plugin.js` / `icon: ./assets/icon.svg`
- `packages/adapters/cursor/src/plugin.ts`：导出 `createHarnessAdapter(context)`，沿用 `CODEXHOST_CURSOR_COMMAND` 环境变量，与 pi / grok 同形
- `packages/adapters/cursor/assets/icon.svg`：复用 renderer 里已有的 cursor 图标路径，不另造
- `packages/adapters/cursor/package.json`：补 `./plugin` 导出与 `manifest.json` / `assets` 打包项

### 冲突解决（13/34）

| 文件 | 取向 |
| --- | --- |
| `host-runtime/src/adapter-composition.ts` + 测试 | 接受上游删除 |
| `host-runtime/tsconfig.json` | 取上游（适配器不再作为工程引用，插件独立构建） |
| `host-runtime/src/harness-delegation-coordinator.ts` | 上游的注册表判定 + 保留本地 Codex 权限模式守卫 |
| `protocol-core/src/model-routing.ts` | 上游通用插件路由**并存**本地 cursor 解码器（见下） |
| `adapters/opencode/src/sdk-transport.ts` | 保留本地新 import，去掉上游已判定无用的 `AssistantMessage` |
| `adapters/claude-code/src/permission-modes.ts` | 取上游更准确的描述 + 保留本地 `canonical: "plan"` |
| `adapters/pi/src/pi-adapter.ts`、`pi-rpc-session.ts` | 两侧都是新增，全保留 |
| `adapters/deepseek-harness/src/model-catalog.ts` | 上游的 provider 前缀 label 与可空 selection + 保留本地 description |
| `adapters/deepseek-harness/src/deepseek-harness-adapter.ts` + 测试 | **整份取上游**（见回归风险） |

cursor 路由：上游的 `decodeHarnessPluginRoute` 携带 `{harnessId, model?, thinkingOptionId?, permissionModeId?}`，本地 `decodeCursorTransportSelection` 只带 `{model?, permissionModeId?}`，是其真子集。合并期两个解码器并存以保住行为；Renderer 侧仍在编码旧形态，迁移完再删本地那支。

## 两处必须补回的回归（阻塞集成）

- [x] R1 **DSH steer**：上游把 dsh 适配器重写了（`-2023/+502`，拆成 `legacy/` 与 `modern/`），且**不含** steer。本地 81 行里的 `turn.steer` / `#steer()` / `promptEchoed` 必须重新移植到新结构。
- [x] R2 **DSH 原生标题**：同上，`session/title` 事件与 `#nativeTitle` 也要重新移植。

**已补回**：R1 在 legacy 与 modern 两代各自以 `mode: "steer"` 注入运行中的原生 Turn；R2 的 `session/title` 移到 modern 的事件入口（它在 Turn 之外到达，故置于活动 Turn 守卫之前），随 `publishConfiguration` 发布。这两项不是可选项——`HarnessSession` 接口要求 steer 重载，不补连编译都过不了。

## 剩余 21 处冲突

- **需要判断**：`host-runtime/src/app-server-host.ts`（4 hunk，本地相对 base 有 `+1239` 行）、`host-runtime/src/index.ts`（3）、`build-release.mjs`、两个 host-runtime 测试
- **需要判断**：renderer-extension 六个文件（`settings/pages.ts` 5 hunk、`localization.ts` 2、`renderer-settings-lifecycle.ts` 2、`renderer-binding-probe.ts` 2、`settings/shell.css` 1）与三个测试
- **归用户定夺**：`AGENTS.md` / `CLAUDE.md`——上游把它们扩写成含产品意图、代码布局与边界规则的完整文档，而 czz-dev 特意把它们瘦成 CodeNote 路由器。这是规则归属问题，不由 Agent 单方改写。
- **机械**：`docs/README.en.md`、`docs/README.ko.md`、两个 `.agents/skills` 参考文档、`crates/launcher/src/main.rs`、`tests/release/host-bundle.test.mjs`
- **最后处理**：`package-lock.json`——待所有 `package.json` 定稿后用 `npm install` 重新生成，不手工合

## 合并已完成（2026-09-06，提交 `342aead`）

34 处冲突全解，269 个文件进入合并提交。

### 验证读数

| 项 | 结果 |
| --- | --- |
| `npm run build:typescript` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run lint`（含 `check-boundaries`） | 通过 |
| `vitest run --config tests/vitest.config.js` | **244 files / 2715 passed / 9 skipped** |
| `npm run test:rust` | 全 crate 通过（launcher 47 + 4，shim 42，updater 24 等） |
| `npm run build`（含 renderer 与 rust） | 通过 |

### 途中查出的一处本地死代码

dsh 的模型 label 一直附带 `description`，而 `harnessModelSchema` 是 `.strict()` 且从来没有该字段。本地夹具从不设置它，所以这行错误一直没暴露；上游新夹具带了 `description`，`normalizeDeepSeekModelCatalog` 当场抛错、七条 catalog 测试全红。已按上游删掉该行。

### 设置页参数顺序

renderer 的 models 页与上游的 session-import 页都保留。参数位按**上游的位置**排（session-import 在第 3/4 位、models 挪到第 5 位），因为上游测试是按下标取参的；反过来排要改 26 处上游测试，这样只改本地少数几处。

## 真机复核未完成（阻塞点在环境，不在代码）

- [ ] 2.1 `npm run live-check:codex-desktop` 未跑成。它要 `codexhost launch` 一个**由本检出构建**的 Desktop，而源码检出的 launcher 要求先 `npm run install:source`——那会把 `~/.local/bin/codexhost` 指向本 worktree，抢走主检出与用户其它在跑的 codexhost 线程的 launcher。这是会影响用户环境的动作，未获授权不做。

正确顺序应为：先由主检出集成本分支 → 主检出重新 `npm run build` → 在主检出跑 live-check。届时 launcher 本来就指向主检出，无需任何重指向。

实测环境读数（供届时比对）：Desktop `26.901.51231` build `8109`，asar `sha256:e2ab6e5985856e148ff78e79658e1241e9ab258d82453d201326bdd2e6779717`，上一次被接受的是 `26.901.22334` build `7746`。
