# Raw Requirement

Tool: dsh
Date: 2026-09-01
Task: 2042-external-thread-redo

## Source

User, current session (DSH hosted by CodexHost):

1. 问哪些官方 CLI/Agent 能在 CodexHost 里支持 Redo。
2. 确认官方 Desktop 没有对话级 Redo 后，问能否由当前 CodexHost 做一层全局能力。
3. 「那你开始做 仔细规划一下 并且要根据 vibe 的相关文档规则」

## Verbatim intent

- 官方 Codex Redo 不能覆盖外部 Thread。
- 要在 **codexhost 全局层**（Host / Mapping Store / 注入按钮）实现对话 Redo，而不是点官方按钮、也不是给每个 Adapter 加一套 Redo RPC。
- 规划与实现都要走本仓库 vibe 过程文档。

## Confirmed facts from this request

- Implement now.
- Scope is Host-owned last-turn conversation restore after `rollbackLastTurn`.
- Follow vibe documentation rules (Standard requirement + OpenSpec capability delta).
