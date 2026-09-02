## 1. Runtime 实现

- [x] 1.1 `/v1/thread/archive` 持久化 `archived`，刷新已加载 Thread 投影，并发 `thread/archived` / `thread/unarchived`；与 Desktop `thread/archive` 共用 `#applyExternalArchiveState`。
- [x] 1.2 原生 Codex id 与未知 id 以 `THREAD_NOT_FOUND` 拒绝；持久化失败以 `INTERNAL_ERROR` 上报。
- [x] 1.3 归档 / 取消归档级联到 `ephemeral` 派生的 side 子对话（含嵌套），Desktop 与 CLI 两条路径共用；子对话不单独发通知。
- [x] 1.4 `thread list` 的 `status` / `attention` 汇总运行中或挂起的 side 子对话到来源行。

## 2. 控制契约

- [x] 2.1 `codexhost thread archive [<thread>]` / `thread unarchive [<thread>]`；省略 thread 时用 `CODEXHOST_THREAD_ID`；接受 `codex://threads/<id>`。
- [x] 2.2 帮助文本说明侧栏与活跃列表同时收起、不停止运行中的 Turn、原生 Thread 不接受。

## 3. 验证

- [x] 3.1 聚焦测试：CLI 请求体与参数错误；控制服务分发；注册表归属路由；Host 委派 API 归档 / 取消归档并通知 Desktop；side 子对话运行时来源行 running、归档级联到子对话。
- [ ] 3.2 Desktop 经正常退出后由 `codexhost launch` 重启以激活（需用户执行单实例门禁流程）；EyPc 侧消费见其 RAW-199。
