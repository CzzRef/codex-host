# Error Memory Index

Tool: tool-neutral (codex, claude, grok, dsh, and any CodeNote-routed agent)

Use this directory for reusable, verified failure patterns.

## Records

| Record | Fingerprint | Status |
| --- | --- | --- |
| [Grok 插队后 Host Turn 被判 failed](grok-interjection-persists-extra-native-turn.md#L1) | `x.ai/interject` Method not found → cancel-and-resend fallback; settle read history before Grok persisted `turn_completed`, so one Native Turn counted twice | verified 2026-09-02 (root cause corrected same day) |

## Sources To Review During Migration

Historical analysis under `docs/archive/` remains evidence until a later task promotes a verified reusable failure.

## Rules

- Record symptom, wrong assumption, verified root cause, evidence, prevention rule, and latest applicable path.
- Do not store unverified guesses or sensitive data.
- Capture through [error-memory-capture](../../../../../CzzProj/CodeNote/AiRef/VibePractice/Skills/global/error-memory-capture/SKILL.md) after a verified reusable failure.
