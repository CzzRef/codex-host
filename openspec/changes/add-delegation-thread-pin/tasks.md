## 1. 控制契约

- [x] 1.1 新增 `ThreadPinInput { threadId, pinned? }` 与 `ThreadPinResult { threadId, pinned }`；`pinned` 缺省 `true`。
- [x] 1.2 `DelegationControlApi` 新增 `pin()`；控制服务新增 `/v1/thread/pin` 路由。
- [x] 1.3 `DelegationThreadListItem` 新增可选 `pinned`，仅外部行投影。

## 2. Host 持久化

- [x] 2.1 `#pinDelegationThread` 经 `assignSection` 写入 `pinned` 与 `sectionId`（置顶时为 Codex Pinned section id，取消时为 `null`）。
- [x] 2.2 section 成员身份与 `pinned` 落 mapping-store，且不改动 recency。
- [x] 2.3 `thread/list` 支持 `sectionId` 过滤与 `section_position` 排序，空结果对齐官方回包形状。
- [x] 2.4 非外部 Thread 以 `THREAD_NOT_FOUND` 拒绝；`pinned` 非布尔以 `INVALID_ARGUMENT` 拒绝；持久化失败以 `INTERNAL_ERROR` 拒绝。

## 3. CLI

- [x] 3.1 `thread pin` / `thread unpin` 接受至多一个位置参数，省略时取 `CODEXHOST_THREAD_ID`。
- [x] 3.2 缺少标识符或多于一个位置参数时以 `INVALID_ARGUMENT` 失败，且不联系 Runtime。
- [x] 3.3 `usage` 帮助文本列出 pin / unpin。

## 4. 验证

- [x] 4.1 `delegation-cli.test.ts`：pin / unpin 的请求体、环境变量兜底、参数错误。
- [x] 4.2 `delegation-control-registry.test.ts` / `delegation-control-server.test.ts`：`pin` mock 与路由分发。
- [x] 4.3 `external-thread-list.test.ts`：置顶后外部行 `pinned: true`，原生行不携带该字段。
- [x] 4.4 `mapping-store` / `thread-management` 用例：section 持久化、`sectionId` 过滤与 `section_position` 排序。
- [ ] 4.5 真机：Desktop 正常退出 + `codexhost launch` 后，`codexhost thread pin` 使侧栏该行进入 Pinned 分区并在重启后保持（用户执行）。
- [ ] 4.6 EyPc 侧消费 `pinned`（另一仓库）。
