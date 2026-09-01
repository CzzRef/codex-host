## Why

用户在 Codex Desktop 已选择 bypass（approval policy `never` + danger-full-access Sandbox）时，经 codexhost 创建的外部 Harness 会话仍以各自默认权限运行，Claude Code 等 Harness 会持续弹出审批，Desktop 与外部消费者只看到会话卡在「Awaiting approval」。期望：Desktop 级 bypass 跟随进外部会话（无审批可自动进行）；对确实挂起的审批，委派列表应可见「等待审批」注意态，供 EyPc 等消费者归入待输入。

## What Changes

- 外部会话创建（Desktop `thread/start`）在满足 bypass（approvalPolicy `never` 且 sandbox `danger-full-access`）且调用方未显式选择 Permission Mode 时，向 Adapter 传 `executionPolicy: "unattended-full-access"`；Adapter 以 `unsupported` 拒绝时自动回退其原生默认，不使创建失败。
- `codexhost thread list` 外部行新增可选 `attention: "approval"`：当前 Turn 阻塞在挂起的 Desktop 审批期间出现，审批落定后消失。
- 委派 CLI 创建路径（`delegate start`）保持既有 `default` 策略不变（后续可另行加显式开关）。

## Capabilities

### New Capabilities

### Modified Capabilities

- `cross-harness-delegation`: 创建时的 Desktop bypass 跟随；列表暴露审批注意态。

## Impact

- Host Runtime AppServerHost（thread/start 创建策略与回退、委派列表 attention 投影）。
- Delegation 控制类型 `DelegationThreadListItem.attention`。
- 聚焦测试：bypass 跟随与回退、审批注意态生命周期。
