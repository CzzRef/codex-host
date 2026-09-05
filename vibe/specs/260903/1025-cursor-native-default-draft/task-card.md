# Task Card

> Standard non-requirement work only.

Tool: claude
Date: 2026-09-03
Task: 1025-cursor-native-default-draft
Worktree: `claude/cursor-multi-agent-codex-5be354`（基线 `czz-dev` `5072d81`，已 rebase 到 `46f2bb7`）

## Task Documentation Sync Group

- Group key: `dsg:codex-host:1025-cursor-native-default-draft`
- Group owner: this `task-card.md`
- Git document prefixes: `vibe/specs/260903/1025-cursor-native-default-draft/`, `vibe/specs/PROJECT_STATUS.md`, `docs/czz-dev.md`, `README.md`
- Declared code/config dependencies: `packages/shared-contracts/src/cursor-transport-selection.ts`, `packages/renderer-extension/src/renderer-binding-probe.ts`, `packages/renderer-extension/src/renderer-composer-dom.ts`, `packages/renderer-extension/src/renderer-model-picker.ts`
- Linked authorities: [Cursor native history spec](../../260902/1502-cursor-native-history/spec.md)、[czz-dev 接入说明](../../../../docs/czz-dev.md)、CodeNote [cursor-agent CLI 笔记](../../../../../../CzzProj/CodeNote/DevelopRef/开发工具/CLI/cursor-agent.md)
- Excluded unrelated dirty documents: 主检出里其他会话未提交的 `app-server-host.ts` / `thread-workspace.ts` / `renderer-conversation-files.ts` hunks、`vibe/specs/260903/0929-*`、`.codemark/`

```json documentation-sync-group-v1
{
  "schema": "documentation-sync-group-v1",
  "group_key": "dsg:codex-host:1025-cursor-native-default-draft",
  "group_owner": "vibe/specs/260903/1025-cursor-native-default-draft/task-card.md",
  "documents": [
    "vibe/specs/260903/1025-cursor-native-default-draft/task-card.md",
    "vibe/specs/260903/1025-cursor-native-default-draft/changes.md",
    "vibe/specs/PROJECT_STATUS.md",
    "docs/czz-dev.md",
    "README.md"
  ],
  "dependencies": [
    "packages/shared-contracts/src/cursor-transport-selection.ts",
    "packages/renderer-extension/src/renderer-binding-probe.ts",
    "packages/renderer-extension/src/renderer-composer-dom.ts",
    "packages/renderer-extension/src/renderer-model-picker.ts",
    "packages/protocol-core/test/cursor-model-routing.test.ts",
    "packages/renderer-extension/test/renderer-composer-model-ready.test.ts",
    "packages/renderer-extension/test/renderer-binding-probe.test.ts",
    "packages/renderer-extension/test/renderer-model-picker.test.ts"
  ],
  "validators": [],
  "git_scope_prefixes": [
    "vibe/specs/260903/1025-cursor-native-default-draft",
    "vibe/specs/PROJECT_STATUS.md",
    "docs/czz-dev.md",
    "README.md",
    "packages/shared-contracts/src/cursor-transport-selection.ts",
    "packages/renderer-extension/src",
    "packages/renderer-extension/test",
    "packages/protocol-core/test/cursor-model-routing.test.ts"
  ]
}
```

## Goal

让 Cursor 在 Codex Desktop 里可以像 Grok 一样直接选中并发送第一条消息，不必先在别处建一个 Cursor Session 换回模型目录。

## 已核实的根因

- `codexhost doctor`：`cursor` 为 `ready` 但 `models: 0`。Cursor Adapter 的冷 `inspect()` 只跑 `cursor-agent status` + ACP `initialize`（不建 Session、不伪造目录），而 Cursor 的 ACP `initialize` 不带模型信息（`_meta` 为 `null`），只有 `session/new` 才返回 `models` / `configOptions`。Grok 则在 `initialize._meta.modelState` 里就给目录，所以 Grok 冷检查有 2 个模型。
- Renderer 拿到空目录后进入 `modelView.status = "empty"`，随后三处都把「没有已选模型」当成未就绪：
  1. `renderComposerAgentControl` 的 `modelReady` 要求已选模型在目录里 → **发送按钮被禁用**。
  2. `isExternalConfigurationReady` 同样要求已选模型 → 外部配置永不就绪。
  3. `shouldApplyDraftAgentCarrier(agent, model)` 无模型即 `false` → draft 不写 `codexhost/cursor-native` carrier，即使能发也会路由到原生 Codex。
- 再往下，`encodeCursorTransportModel(undefined, mode)` 在有权限模式、无模型时直接抛错，所以「原生默认模型 + 权限模式」这种组合在传输层也没有编码形态。

Adapter 与 Host 本身没有问题：用主检出 dist 直驱 `CursorAdapter`（inspect → open create → turn.start → readSnapshot）在 scratch cwd 一轮 PONG 通过，`open` 后 `inspect` 缓存变为 37 个模型、默认 `gpt-5.4-mini[reasoning=medium]`、模式 `agent`。

## Scope

- shared-contracts：Cursor 传输 id 允许「无模型 + 权限模式」，形态 `codexhost/cursor-native@@<mode>`；解码对应返回 `{ permissionModeId }`。`codexhost/cursor-native@` / `@@` / `@ref@` 仍视为畸形。
- renderer：新增 `isExternalModelSelectionReady(view)`（`empty` 即就绪，否则要求已选模型在目录里），发送按钮与外部配置就绪都用它；`shouldApplyDraftAgentCarrier` 第三参 `modelView`，`empty` 视为具体 carrier；空目录分支在 draft 上立即写 carrier（带已选权限模式）；模型标签由 `No models` 改为 `Default model`。
- 不改 Adapter 冷检查策略：ACP `session/new` 会立刻在 `~/.cursor/acp-sessions/<id>/` 落 `meta.json` 并出现在 `session/list`，且 Cursor ACP 没有 `session/delete`（实测 `-32601`），所以不能为了拿目录在每次 inspect 时建 Session。`cursor-agent --list-models` 的 id（如 `gpt-5.3-codex-high-fast`）与 ACP 目录 id（`gpt-5.3-codex[reasoning=high,fast=true]`）不是同一套，也不能拿来冒充目录。
- 不动 Fork / Rollback / Side chat 的既有 `unsupported` 边界。

## Verification

- `npx vitest run --config tests/vitest.config.js packages/renderer-extension packages/protocol-core packages/shared-contracts packages/host-runtime`：86 文件 726 通过 / 2 跳过。
- 聚焦：cursor routing + renderer binding-probe + model-picker + composer-model-ready + cursor-renderer + adapters/cursor：8 文件 74 通过。
- `npm run typecheck` 通过；改动文件 ESLint / Prettier 通过；`node tools/check-boundaries.mjs` 通过。
- `npm run build:typescript` 与 `npm run build:renderer` 通过。
- 真机 Adapter 直驱（scratch cwd，Cursor `2026.08.31-4057e58`，已登录）：见上「根因」。留下 3 个探针 Session（`ad335c62` / `b6370b46` / `4309d02b`）在 `~/.cursor/acp-sessions`，Cursor 无删除接口，未手动删目录。

## Live gap

- Desktop 目视未做：本轮开始时源码 Desktop（launcher 17794）在运行，中途已被退出，会话内没有 Desktop 进程；Renderer 改动需要在用户终端 `codexhost launch` 后，用 Composer 选 Cursor → 「Default model」→ 发送一条消息目视。
- Host 委派 CLI（`codexhost harness inspect cursor` / `delegate start --harness cursor`）需要 Host 注入的 Runtime endpoint/token，本会话不在 Host 托管环境里，只能核对契约，未真机跑。

## Remaining

- Cursor 目录在第一条 Turn 之后才进入 Adapter 缓存；侧栏已锁定 Thread 会由 `session.state.changed` 拿到实际模型，新的 draft 仍显示 `Default model`，直到 Renderer 下一次 `harness/inspect`（刷新或重新挂载）。
- 若 Cursor 未来在 `initialize` 上暴露目录（类似 Grok `_meta.modelState`），应改冷检查而不是保留这条空目录路径。

## Merge into `czz-dev`（2026-09-05）

- Rebase `2b243a4` → `644e69b`，落在 `695932e` 之上（跨 144 个提交：upstream v0.4.4 合并与置顶轮次头重构）。唯一冲突在 `packages/renderer-extension/src/renderer-binding-probe.ts`：`czz-dev` 已把就绪判定重构成 `isExternalConfigurationReadyView(modelView, permissionModeView)`，解决方式是把空目录规则并进该函数而不是保留旧的内联判断。
- **收敛决定**：空目录 = 原生默认模型这条规则改为按 Harness 生效——新增 `externalAgentUsesNativeDefaultModel(agent)`（[renderer-composer-dom.ts](../../../packages/renderer-extension/src/renderer-composer-dom.ts) 第 713-736 行），当前只有 `cursor` 返回 `true`。原因：`czz-dev` 在本任务之后加入了「同一 Host 的 Claude 空目录是终态」契约（`renderer-binding-probe-host-catalog.test.ts` 第 448 行断言提交被拦下），若把空目录一律当成可发送，该用例会失败、Claude 的空目录会被误判成可用。`shouldApplyDraftAgentCarrier` 与 draft 阶段写 carrier 的分支同样收敛到该断言。
- 用例同步：`renderer-composer-model-ready.test.ts` 改为按 agent 传参，新增「Claude Code / Grok 的空目录仍不可发送」一例。
- 合并后门禁（主检出 `czz-dev`）：`npm run typecheck` 通过；`npm run lint` 通过；`vitest run --config tests/vitest.config.js` 210 文件 1842 通过 / 9 跳过；Playwright `renderer-composer-workspace-surface` 1 通过；`npm run build:renderer` 通过。
- 顺带修两处与本任务无关但挡住门禁的环境问题：`eslint.config.js` 忽略 `.claude/worktrees/**`（嵌套 worktree 是同一仓库的另一份检出，从父目录 lint 会因两个候选 tsconfig 根解析失败）；`packages/shared-contracts/dist/index.js` 是一份过期的 bundle，`tsc -b` 认为无需重建，`tsc -b packages/shared-contracts --force` 后恢复。
- Live gap 不变：Desktop 目视仍未做。

## Live check（2026-09-05 17:40–17:43，合并后重启的 Desktop）

- 环境：`~/.local/bin/codexhost launch` 拉起（launcher 61643 / Desktop 61645 / CDP 50154），载入的是合并后 17:48 重建的 `production.js`；全程只读 CDP 旁观，未向页面派发任何输入。
- 用户实测一条 Cursor 消息（cwd `GoNavi`）：composer `selections` 从 `{agent:"cursor", phase:"draft"}` 转为 `phase:"locked"`，出现 Thread `b5c9ec81-8a6f-48a5-a2bb-d7df8f43607e`，轮次数 1，Cursor 实际执行（thinking / commands / read file）并停在 `Awaiting approval`。
- Host 记录 `~/.codexhost/mapping-store/threads/b5c9ec81…json`：`harnessId: "cursor"`、`historyMode: "paginated"`、`nativeSessionRef` 指向真实 ACP Session `5ba40588-c3de-460e-9b2e-34a2fba75331` —— 路由确实落到 Cursor 而不是原生 Codex。
- 权限模式端到端带过去了：`transportModelId: "codexhost/cursor-native@cursor.ZGVmYXVsdFtd@agent"`，末段 `@agent` 即 Composer 上选的 Agent 模式。
- 全窗口 `Runtime.exceptionThrown` 计数 0；仅有两条与本任务无关的资源 404（剪贴板临时图片、favicon）。
- **本次没有覆盖到空目录分支**：模型标签实测是 `Auto`（`cursor.ZGVmYXVsdFtd`），说明本机 Cursor 目录当时非空，走的是有目录的完整传输 id，而不是本任务修的 `codexhost/cursor-native@@<mode>`。结论只到「合并后 Cursor 正常可用、未被破坏」，空目录场景仍待一次冷目录复现。
- 顺带验到本会话另一处修改：该 Thread 第一轮的置顶栏 Edit 提示为 `The first turn cannot be dropped; Edit places its prompt in the Composer to append`，即 `append` 模式在真机按预期生效。

