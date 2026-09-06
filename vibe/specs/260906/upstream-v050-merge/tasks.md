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
  "next_action": "decide the plugin-architecture side, then resolve the 34 conflicts in the isolated worktree"
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
- [ ] 1.2 先解 host-runtime 的插件装载架构冲突，决定 `adapter-composition.ts` 是删除并迁移到插件形态、还是保留
- [ ] 1.3 解 renderer-extension 设置外壳冲突
- [ ] 1.4 解六个适配器冲突，确认 `add-harness-file-input` 的改动在插件形态下仍成立
- [ ] 1.5 解文档、锁文件与 Rust 侧冲突
- [ ] 1.6 全仓类型检查 + 18 个包测试 + Rust 测试
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
