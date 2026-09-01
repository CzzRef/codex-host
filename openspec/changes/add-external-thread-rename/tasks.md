## 1. Runtime 实现

- [x] 1.1 `/v1/thread/rename` 持久化标题、`titleSource=native`，并发 `thread/name/updated`。
- [x] 1.2 手改名保护：仅当 `titleSource=desktop`、preview 非空、且不是首条消息兜底形时拒绝覆盖。无可用 preview 的 desktop 标题视为兜底，允许改名。

## 2. 控制契约

- [x] 2.1 `codexhost thread rename [<thread>] --name <title>`；省略 thread 时用 `CODEXHOST_THREAD_ID`。
- [x] 2.2 帮助文本说明侧栏即时更新与手改名不被覆盖。

## 3. 验证

- [x] 3.1 聚焦测试：委派 API 改名通知 Desktop；无 preview 兜底可改；有 preview 的手改名拒绝。
- [ ] 3.2 Desktop 经正常退出后由 `codexhost launch` 重启以激活（需用户执行单实例门禁流程）。
