# Error Memory Index

Tool: tool-neutral (codex, claude, grok, dsh, and any CodeNote-routed agent)

Use this directory for reusable, verified failure patterns.

## Records

| Record | Fingerprint | Status |
| --- | --- | --- |
| [Managed-worktree Bash can default to the control checkout](managed-worktree-bash-defaults-to-control-checkout.md#L1) | managed child Worktree + harness cwd remains control checkout + relative Bash verifies the wrong tree | verified 2026-09-02 |
| [`mark-verified` rejects lifecycle-mode drift](managed-worktree-mark-verified-rejects-lifecycle-mode-drift.md#L1) | verified child milestone + manually changed lifecycle mode + `task_contract_identity` block | verified 2026-09-02 |
| [Root `node_modules` symlink misses workspace-local dependencies](worktree-root-node-modules-symlink-misses-workspace-nested-deps.md#L1) | fresh worktree + root-only dependency symlink + TS2307 for package-local workspace modules | verified 2026-09-02 |

## Sources To Review During Migration

None yet as a CodeNote error-memory index. Historical analysis under `docs/archive/` remains evidence until a later task promotes a verified reusable failure.

## Rules

- Record symptom, wrong assumption, verified root cause, evidence, prevention rule, and latest applicable path.
- Do not store unverified guesses or sensitive data.
- Capture through [error-memory-capture](../../../../../CzzProj/CodeNote/AiRef/VibePractice/Skills/global/error-memory-capture/SKILL.md) after a verified reusable failure.
