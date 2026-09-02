# Task Card

> Standard non-requirement work only.

Tool: claude
Date: 2026-09-02
Task: 1910-delegation-permission-mode

## Task Documentation Sync Group

- Group key: `dsg:codex-host:1910-delegation-permission-mode`
- Group owner: this `task-card.md`
- Git document prefixes: `vibe/specs/260902/1910-delegation-permission-mode/`, `openspec/changes/add-delegation-permission-mode/`, `vibe/specs/PROJECT_STATUS.md`
- Declared code/config dependencies: `packages/host-runtime/src/delegation-cli.ts`, `packages/host-runtime/src/delegation-types.ts`, `packages/host-runtime/src/harness-delegation-coordinator.ts`, `packages/host-runtime/src/delegation-skill.ts`
- Linked authorities: [OpenSpec change](../../../../openspec/changes/add-delegation-permission-mode/proposal.md), [in-turn interjection task card](../1437-in-turn-interjection-items/task-card.md)（本任务由其 Remaining 末条派生）
- Excluded unrelated dirty documents: 同一检出里并行会话的 side-chat / RAW-200 hunks、`docs/tasks/WORKTREE_TASKS.md`

```json documentation-sync-group-v1
{
  "schema": "documentation-sync-group-v1",
  "group_key": "dsg:codex-host:1910-delegation-permission-mode",
  "group_owner": "vibe/specs/260902/1910-delegation-permission-mode/task-card.md",
  "documents": [
    "vibe/specs/260902/1910-delegation-permission-mode/task-card.md",
    "openspec/changes/add-delegation-permission-mode/proposal.md",
    "openspec/changes/add-delegation-permission-mode/tasks.md",
    "openspec/changes/add-delegation-permission-mode/specs/cross-harness-delegation/spec.md",
    "vibe/specs/PROJECT_STATUS.md"
  ],
  "dependencies": [
    "packages/host-runtime/src/delegation-cli.ts",
    "packages/host-runtime/src/delegation-types.ts",
    "packages/host-runtime/src/harness-delegation-coordinator.ts",
    "packages/host-runtime/src/delegation-skill.ts",
    "packages/host-runtime/test/harness-delegation-coordinator.test.ts",
    "packages/host-runtime/test/delegation-cli.test.ts"
  ],
  "validators": [],
  "git_scope_prefixes": [
    "vibe/specs/260902/1910-delegation-permission-mode",
    "openspec/changes/add-delegation-permission-mode",
    "packages/host-runtime/src/delegation-cli.ts",
    "packages/host-runtime/src/delegation-types.ts",
    "packages/host-runtime/src/harness-delegation-coordinator.ts",
    "packages/host-runtime/src/delegation-skill.ts",
    "packages/host-runtime/test/harness-delegation-coordinator.test.ts",
    "packages/host-runtime/test/delegation-cli.test.ts"
  ]
}
```

## Goal

委派 CLI 起的子线程能以目标 Harness 的某个权限模式运行，使无人值守的子任务不再因审批被拒而停在 `interrupted`。

## Scope

- `delegate start --permission-mode <mode-id>`：目录校验、`adapter.open` 透传、`requestedPermissionModeId`、结果回显、去重摘要、transport id 回退到目录默认 Model。
- 帮助文本与委派 Skill 说明。
- 不改 Host 对 interrupted Turn 的未读语义（用户裁决：打断了即使有回复也不算未读，仍是「待继续」）。
- 不做 Host 级中立别名；模式 id 与 `--model` / `--thinking` 一样取自 `harness inspect`。

## Verification

- `npx vitest run packages/host-runtime/test/harness-delegation-coordinator.test.ts packages/host-runtime/test/delegation-cli.test.ts`：38 通过。
- `npm run typecheck` 通过；改动文件 Prettier 通过。
- 真机探针：见下方 Live probe。

## Live probe

2026-09-02 19:13–19:21，源码检出 dist（`tsc -b` 产物），Host 经 Desktop 正常退出后 `codexhost launch` 重启。

- 19:13 起跑 `f57fe446`（`delegate start --harness grok --permission-mode always-approve`，结果 `effective.effectivePermissionModeId: always-approve`）；Grok `turn_started yolo_mode: true`，读文件与三条 `run_terminal_command` 全部 `decision: allow, wait_ms: 0`（日期 / 会话标题覆盖 / 会话列表），标题落为「260902-Rust常用crate清单」。19:15:18 Codex Desktop 进程死亡（统一日志 `appDeath`），launcher 随即回收运行时，19:15:21 应用经 shim 按需重启；这条 Turn 在 `streaming_text` 阶段被切断，重启后 Host 按历史报 `completed`、`hasUnreadTurn` 缺省，EyPc 按「缺省即未读」放入已完成未读。Grok 三条命令都不触及 Host，重启原因未定；我的 launcher 是在 Agent 的 Bash 调用里后台起的，怀疑随工具调用生命周期被回收。
- 19:19 在稳定的运行时（pid 91347）重跑 `4cd13fa2`：`thread send --steer true` 命中同一 `turnId`，`thread wait` 返回 `completed / timedOut: false`，`thread list --all` 行为 `completed unread=true`，标题「260902-Rust箱清单探针」；`thread read --view messages` 顺序 user → agent → **user（插队原文）** → agent → agent final。Grok 事件：`turn_started` 1 次、`interjected redirect_kind: interjection`、8 次 allow、`turn_ended outcome: completed`。运行时 pid 未变。
- EyPc 诊断：19:21:03 `codexhost-discovery ok count 6→7`，`codexhost-published discovered 7 / publicRows 25`；插件自 19:19:32 处于 `background-hidden`，分组落位待用户前台打开时核验。

## Remaining

- Desktop 恢复时对委派子线程的模式回填依赖 transport id；目录没有默认 Model 的 Harness 在重启后会回到默认模式。
- 用户前台打开 EyPc 核验「gr · 260902-Rust箱清单探针」落在已完成未读。
- 19:15:18 Desktop 进程死亡的原因未定；Agent 侧后台起的 `codexhost launch` 不作为长期宿主，长期运行请从用户终端启动。
- 两条探针线程 `f57fe446` / `4cd13fa2` 留在 codex-host 项目下，归档由用户决定。
