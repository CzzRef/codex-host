# 变更清单

Task: 1025-cursor-native-default-draft

## 1. 概览

| 批次 | 提交 | 文件数 | 核心说明 |
| --- | --- | --- | --- |
| 1 | 本工作树本轮提交 | 8 代码/测试 + 5 文档 | Cursor 空模型目录时 Composer 可发送并按原生默认模型路由 |

## 2. 交付物清单

| 对象 | 类型 | 行范围 | 核心原文 / 说明 |
| --- | --- | --- | --- |
| `packages/shared-contracts/src/cursor-transport-selection.ts` | 改动 | L19-28, L38-42 | `if (!model) return mode ? \`${PREFIX}@${mode}\` : CURSOR_NATIVE_TRANSPORT_MODEL_ID;`；解码 `if (parts[0] === "" && permissionModeId) return { permissionModeId };` |
| `packages/renderer-extension/src/renderer-composer-dom.ts` | 改动 | L713-726, L751 | 新增 `isExternalModelSelectionReady(view)`：`if (view.status === "empty") return true;`；`modelReady = isExternalModelSelectionReady(modelView)` |
| `packages/renderer-extension/src/renderer-binding-probe.ts` | 改动 | L35, L485-489, L841-845, L1163-1177, L2057, L2215 | `shouldApplyDraftAgentCarrier(agent, model, modelView?)` → `... || modelView?.status === "empty"`；`isExternalConfigurationReady` 改用 `isExternalModelSelectionReady`；空目录分支 draft 上 `applyComposerModelWrite(... applyAdapterAgent?.(agent, undefined, undefined, selectedPermissionModeId, ...))`；两处调用补传 `mounted.modelView` |
| `packages/renderer-extension/src/renderer-model-picker.ts` | 改动 | L167 | `else if (view.status === "empty") modelLabel = "Default model";` |
| `packages/protocol-core/test/cursor-model-routing.test.ts` | 改动 | L33-49, L53 | `codexhost/cursor-native@@plan` 编解码 + `decodeCreateRoute`；`@@` 进入畸形列表 |
| `packages/renderer-extension/test/renderer-composer-model-ready.test.ts` | 新增 | 全文 | `empty` 即就绪；`ready` 仍要求已选模型在目录里 |
| `packages/renderer-extension/test/renderer-binding-probe.test.ts` | 改动 | L1132-1142 | `shouldApplyDraftAgentCarrier("cursor", undefined, emptyView)` 为 true，`loading` / 无视图为 false |
| `packages/renderer-extension/test/renderer-model-picker.test.ts` | 改动 | L311-322 | 空目录标签 `Default model`，picker 仍禁用 |
| `docs/czz-dev.md` | 改动 | Cursor 能力边界 + 在 Codex 里调用 | 空目录首发路径与 CLI 委派模式 id |
| `README.md` | 改动 | L162 | 去掉「Host 退出后不支持恢复」的过时说法 |
| `vibe/specs/PROJECT_STATUS.md` | 改动 | Current Focus / Active Task Index | 新任务行 |
| 本目录 `task-card.md` / `changes.md` | 新增 | 全文 | 任务身份、根因、验证 |
| CodeNote `DevelopRef/开发工具/CLI/cursor-agent.md` + `README.md` | 仓外新增/改动 | 全文 / 索引行 | cursor-agent CLI / ACP 实测与 codexhost 接入对照 Grok CLI |

## 3. 明确没做的

| 对象 | 核心说明 |
| --- | --- |
| Adapter 冷检查建 Session 取目录 | `session/new` 立刻落盘并进 `session/list`，且无 `session/delete`；不做 |
| `cursor-agent --list-models` 当目录 | id 体系与 ACP 目录不同，不能映射 |
| Desktop 目视 | 本会话无 Desktop 进程；待用户 `codexhost launch` 后目视 |
| Host 委派 CLI 真机 | 缺 Host 注入的 endpoint/token |
| Fork / Rollback / Side chat | 维持 `unsupported` |
