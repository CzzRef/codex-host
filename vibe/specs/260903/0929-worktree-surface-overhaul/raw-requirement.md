# Raw Requirement: 260903 Worktree 三项能力核验与重做

Tool: cursor
Date: 2026-09-03 09:29 (+08:00)
Status: `captured`
Spec owner: [plan.md](plan.md)

## 用户原话（首轮）

> 你核验一下 work tree 相关的以下功能，你现在都没有完全实现吧：
> 1. 新增对话, 可选的 work tree, 前几轮对话回滚编辑 底部的状态栏
> 甚至说你实现的效果非常的差
> 你给我出一个方案 一个 plan
> 先落地到本地文档

引用入口：[composer-overlay.preview.html](../../../../packages/renderer-extension/src/composer-overlay.preview.html)

## 澄清问答（同回合）

问 1：新建对话的「可选 Worktree」期望形态？
答：**下拉选择**：列出已有 worktree + 「新建（可命名 `yyMMdd-功能核心`，分支 `codex/<名>`）」，由 codexhost Host 执行 `git worktree add`。

问 2：回滚/编辑与底部状态栏实际看到最差的是哪些？
答（多选）：

- 回滚/编辑：按钮位置漂移、挡内容、滚动时跟随卡顿
- 编辑：点了以后没进入编辑提示框 / 找不到官方编辑按钮
- 状态栏：没有变更文件时整条消失，看不到当前 worktree / 分支
- 状态栏：显示的 worktree / 分支与实际不符（尤其 worktree 线程）
- 状态栏：与官方 Changes / Review 控件重复或互相遮挡

补充原话：

> 1. 布局与交互问题：
> (a) 变更的文件偏移非常严重，现在显示偏向于中间区域的右侧。
> (b) work tree 右侧文件变更的悬浮效果有问题，悬浮框有点小，并且交互非常差，有时还会隐藏文件的内容。
> 2. work tree 变更展示逻辑：
> (a) 当前所有代码变更涉及的 work tree，以及核心工作的 work tree 没有体现出来。例如：如果当前的核心是 work tree 1，但变更可能涉及到主目录、code note 的内容以及 work tree 2，那么应该体现出这三个不同操作变更的主环境。
> (b) 如果某个 work tree 没有变更，或者是代码 0 行的变更，就不需要在底部的展示里面体现了。

## 边界

- 本轮只落地方案文档，不改代码。
- Desktop 当前未运行（`ps` 无 codexhost / Codex.app 进程），核验为静态源码与文档对照；真机复现留在实施阶段。
