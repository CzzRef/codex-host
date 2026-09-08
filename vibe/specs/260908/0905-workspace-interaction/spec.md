# 工作区与轮次界面改版

状态：用户已确认交互候选，开始真实实现。需求来源：[要点](raw-requirement.md)。前期证据：[任务卡](task-card.md)。本规格接替前期任务卡，持有本次真实改版的实现与验证状态。

```json worktree-task-v1
{
  "schema": "worktree-task/v1",
  "task_id": "260908-workspace-redesign",
  "control_plane": "app-root",
  "target_branch": "czz-dev",
  "repositories": [{
    "repo_id": "codex-host",
    "base_sha": "c16ad741ba1f38a2decf97074a9c5153d664e27f",
    "worktree_branch": "codex/260908-workspace-redesign",
    "task_owner": "vibe/specs/260908/0905-workspace-interaction/spec.md",
    "head": "c16ad741ba1f38a2decf97074a9c5153d664e27f",
    "upstream": null
  }],
  "commit_mode": "verified-milestone",
  "push_mode": "current-message-only",
  "verification_state": "planned",
  "push_state": "not-authorized",
  "integration_state": "not-started",
  "next_action": "implement approved workspace, turn navigation and persistent file detail interactions"
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

- 已完成：用户确认、三条实现链只读核对、独立 worktree 规划。
- 待完成：实现、聚焦检查、主任务差异审阅、真实环境验收及集成状态回读。
- 无远端推送或清理授权；不自动移除已有 worktree。
