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
      "head": "d56a80a1221632a6acd323d0f523ce55aa42bea9",
      "upstream": null
    }
  ],
  "commit_mode": "verified-milestone",
  "push_mode": "current-message-only",
  "verification_state": "planned",
  "push_state": "not-authorized",
  "integration_state": "not-started",
  "next_action": "merge upstream/main in the isolated worktree and resolve conflicts"
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

- [ ] 1.1 在隔离 worktree 上执行 `git merge upstream/main`，保留冲突现场
- [ ] 1.2 解 13 处冲突，逐个判定本地改动在上游新形态下是否仍成立
- [ ] 1.3 `package-lock.json` 若受影响，取上游后 `npm install` 重新生成
- [ ] 1.4 全仓类型检查 + lint/boundaries + 全量 vitest
- [ ] 1.5 真机复核（Desktop Renderer 注入）
- [ ] 2.1 由主检出决定集成回 `czz-dev`

## 合并落点

隔离 worktree：分支 `codex/260907-upstream-main-merge`，路径在 `<repo-parent>/codex-host-worktrees/codex/260907-upstream-main-merge`（本文件不落机器绝对路径）。主检出 `czz-dev` 在合并期间不被触碰。
