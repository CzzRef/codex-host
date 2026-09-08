# 工作区与轮次界面改版

状态：已接入生产源码，离线检查通过；真实 Desktop 验收、目标分支集成和已安装运行时更新尚未执行。需求来源：[要点](raw-requirement.md)。前期证据：[任务卡](task-card.md)。本规格接替前期任务卡，持有本次真实改版的实现与验证状态。实际提交及集成状态由主检出 [工作树索引](../../../../docs/tasks/WORKTREE_TASKS.md) 的实时投影记录。

```json worktree-task-v1
{
  "schema": "worktree-task/v1",
  "task_id": "260908-workspace-redesign",
  "control_plane": "app-root",
  "target_branch": "czz-dev",
  "repositories": [{
    "repo_id": "codex-host",
    "base_sha": "fd1115acde1127b6fa9fea0283d40f2c2d1bfbfb",
    "worktree_branch": "codex/260908-workspace-redesign",
    "task_owner": "vibe/specs/260908/0905-workspace-interaction/spec.md",
    "head": "fd1115acde1127b6fa9fea0283d40f2c2d1bfbfb",
    "upstream": null
  }],
  "commit_mode": "verified-milestone",
  "push_mode": "current-message-only",
  "verification_state": "verified-index",
  "push_state": "not-authorized",
  "integration_state": "not-started",
  "next_action": "record verified local commit; retain real Desktop acceptance and target integration as separate gates"
}
```

## 已确认的行为

1. 工作区身份位于 Composer 附近，不再依赖当前轮或有无文件变更而显隐；已有对话执行目录不可被草稿选择器暗中改变。工作树管理复用现行 Host list/create 与新草稿 cwd 接线，完整显示已有工作树（包括干净工作树）、分支与最终目录。
2. 顶部为紧凑独立轮次导航：前后箭头、编号列表、当前轮短标题、编辑 / Rollback / Redo。标题提炼原始提问的核心，不替代原文；列表与顶部标题一致。
3. 跳转依赖可定位的真实轮次。外部 Host 总数与当前已加载 DOM 范围必须区分；不为未加载的轮次制造可用跳转或虚构标题。
4. 复用现有动作控制器：Rollback 保留选中轮；编辑先回到该轮之前再填入草稿，用户自行发送；Redo 仅恢复最近一次回滚，新消息后失效。首轮、生成中、能力缺失、仅末轮回滚与官方原生 Redo 的限制按真实能力处理。
5. 点击文件后显示稳定详情，可选择复制、内部滚动；正文滚动和轮次变化不关闭详情。提供显式关闭、Escape 与焦点恢复。线程切换或所属 Composer 卸载必须清理旧详情，保留明确的原生文件/差异入口。
6. 保留现行颜色、图标、密度和中英文支持；窄屏不遮挡 Composer，不引入新的外部服务或模型请求。

## 实施划分与 VerificationImpactTrace

Root 是唯一写入与验收 owner。预算 U，三个独立只读探索单元已派发：轮次视图、工作区链路、文件详情共享影响；代理不得修改代码或访问真实 Desktop。

| 单元 | 传播路径 | 验证 |
| --- | --- | --- |
| 轮次与短标题 | DOM/Host 轮次身份 → header view → 现有 action controller | 轮次、短标题与动作聚焦单测；真实生产组件的浏览器 fixture 验证跳转、虚拟化范围、编辑和回滚目标 |
| 工作区 | workspace snapshot / worktree list/create → Composer 状态面 → 现有草稿 cwd policy | 空变更、多个 root、已有工作树、草稿与已有线程隔离；选择后的实际 cwd 仍需真机验收 |
| 文件详情 | conversation files → disclosure → 独立详情状态 | 点击、滚动、关闭、Escape、焦点恢复、线程切换、详情边界与原生入口 |

按改动范围运行 TypeScript 构建/类型检查、lint、聚焦 unit 和现有生产组件 e2e。不运行完整模型/Gate、部署或真实会话变更。工具当前禁止读取真实 Codex 界面及此前本地预览 URL；不得通过其他接口绕过，真实 Desktop 验收单列。

## Implementation Sync / Documentation Impact

- 复用已发布的 workspace/rollback/Redo 底层语义，调整 Renderer 外观、入口和生命周期。
- 同步已批准的 `add-composer-workspace-bar` 相关规格、项目当前状态与本任务规格；旧设计记录保留历史时间，不把新布局写成既有验收。
- 主检出的 doctor 与文档修复以及并行规则改动保留，不纳入本次隔离实现的代码提交。

## 进度与验证

- 已完成：用户确认、三条实现链只读核对、独立 worktree、生产实现、Root 源码与合成页面截图审阅。
- 离线验证：6 个聚焦单测文件共 34 项通过；生产组件 Playwright 流程 1 项通过（包含轮次跳转、完整提问确认/回填、工作树创建与切换、拒绝选择、Composer 替换隔离、详情滚动/焦点/线程归属、窄宽度和浅色主题）；TypeScript 类型检查、Renderer 构建、lint 与边界检查通过。仅覆盖此次 Renderer 变更，没有运行完整 Rust 或真实模型 Gate。
- 最终格式、差异与文档链接检查纳入提交前回执。已复核先前发现的两个共享状态问题：文件详情按 Composer 与 Thread 双重匹配；待应用 cwd 只能写入仍然连接的原 Composer。
- 待完成：真实环境验收、目标分支集成和已安装运行时更新；生产组件测试不能替代上述门槛。
- 无远端推送或清理授权；不自动移除已有 worktree。

## 实现细节与限制

- 子标题由本地任务短句提取生成，先排除代码块/链接标记，再选动作句、移除客套前缀并限制显示长度；没有额外模型请求，模糊提问仍可能得到宽泛标题。编号列表复用同一算法，完整提问不受影响。
- 工作区独立于顶栏：正常布局预留输入区位置，额外补齐 transcript 底部空间；空变更仍有核心身份。列表宽度按工作区本身重新计算，窄宽度优先保留核心名、文件数与更多入口；归属与逐仓统计进入详情，避免挤掉工作区名。
- 文件详情由 Composer 与 Thread 双重归属，滚动/切轮保持打开；关闭焦点在文件列表重绘后仍可恢复。只有所属对话变更、卸载、文件消失或显式关闭会清理。
- 已有对话的 cwd 不改变。“工作树”入口复用同一库存/创建菜单；选择后只点击唯一可见、具名的应用新对话按钮，原 Composer 必须始终连接，并转换为唯一可见且无 Thread id 的草稿，才会设置目标目录。Composer 被替换、按钮缺失/重复、草稿未确认均取消自动应用；替换后的草稿需要用户重新选择。真正的 Desktop 按钮识别与发送目录仍属真机门槛。创建期间关闭菜单不会把异步结果应用到另一草稿。
- 真实 Codex UI 和此前既有预览 URL 受当前电脑控制安全策略阻止。本次浏览器检查仅运行仓库自己的合成测试页面和生产 Renderer 组件，没有读取或绕行访问被阻止的界面。
