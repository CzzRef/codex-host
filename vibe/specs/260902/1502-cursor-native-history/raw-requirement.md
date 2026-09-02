# Raw Requirement

Tool: dsh
Date: 2026-09-02
Task: 1502-cursor-native-history

## Source

User, current session (DSH hosted by CodexHost), after inspecting Settings → Connections:

1. 问 Renderer adapter 与 Cursor (live only) 的含义。
2. 「但是这个 Cursor live 没有用 你去核验一下 给我改成类似 Grok CLI 这样的形式」

## Verbatim intent

- Cursor live-only 当前没有用。
- 先核验，再改成和 Grok CLI 一样的接入形式。
- 目标是能在 Codex Desktop 里像 Grok 那样继续用，而不是进程一退出会话就没了。

## Confirmed facts from this request

- Implement now.
- Keep using `cursor-agent` (not the editor `cursor` binary, not Grok's `agent`).
- Match Grok's production pattern: ACP stdio plus native on-disk history, so create / resume / snapshot / NativeTurnRef work.
- Do not invent Fork or rollback unless Cursor actually advertises them.
