## MODIFIED Requirements

### Requirement: Host uses a UI-independent text Session interface

The system SHALL expose a `HarnessAdapter` that opens a create-mode `HarnessSession`, and the Session SHALL accept Turn commands whose input carries text parts and optional file parts, and expose Host-semantic outputs without exposing Pi RPC or Codex app-server types. 文件部件的契约、能力声明与降级策略归 `harness-adapter-file-input` 所有；本 Requirement 只放宽输入形态，不复述其规则。

#### Scenario: Host creates a Pi Session

- **WHEN** Host routing selects Pi for a new Thread
- **THEN** the Host opens a create-mode Session through the `HarnessAdapter` interface
- **AND** the Host does not construct or invoke `PiRpcSession` directly

#### Scenario: Unsupported future operations are absent

- **WHEN** the first text-session contract is published
- **THEN** inspect, catalog, Tool, Interaction, explicit cancel, history, resume, and fork behavior is not represented by placeholder methods

#### Scenario: Text-only Sessions are unaffected

- **WHEN** 一个 Session 未声明附件能力
- **THEN** 它接受的输入 SHALL 与本变更之前完全一致
- **AND** 既有适配器 SHALL NOT 因本变更需要改动
