---
id: codexhost-managed-worktree-mark-verified-rejects-lifecycle-mode-drift
status: verified
scope: codexhost managed-worktree milestone verification
fingerprint: verified child milestone + task owner verification_state manually changed before mark-verified + task_contract_identity block despite refreshed HEAD
first_seen: 2026-09-02
last_verified: 2026-09-02
review_after: 2026-12-01
evidence:
  - ../../specs/260902/1340-worktree-checkbox-routing/task-card.md
tags:
  - worktree
  - lifecycle
  - verification
  - task-contract
---

# `mark-verified` rejects lifecycle-mode drift in the task owner

## Symptom

After a verified child Worktree received a follow-up implementation, `refresh --apply` accepted the current HEAD, but `mark-verified` returned:

```text
worktree-task-v1 identity or lifecycle modes do not match the requested task
task_contract_identity
```

The branch, task id, owner, target branch, commit mode, and push mode were otherwise unchanged.

## Wrong assumption

The task owner's `verification_state` was treated as free-form progress text and manually changed from `verified-commit` to `verified` before requesting a new milestone receipt.

## Verified root cause

`mark-verified` validates the exact staged `worktree-task-v1` identity and lifecycle modes against Git-local managed-worktree state. A follow-up dirty/staged index does not authorize manually degrading the owner block's lifecycle mode. `refresh --apply` updates live Git drift but intentionally does not normalize an incompatible staged task contract.

Restoring `verification_state: verified-commit` while leaving the follow-up files staged made the same `mark-verified` request succeed; the before/after commit gates then produced a new verified-commit receipt.

This applies to managed Worktrees already carrying a verified milestone. It does not apply to a newly initialized task whose canonical lifecycle state is still planned or in progress.

## Correct detection order

1. Read the Git-local lifecycle preview with `refresh` before editing machine fields.
2. If `mark-verified` reports `task_contract_identity`, compare lifecycle modes as well as task/branch/path identity.
3. Preserve the last canonical machine state while documenting human-readable follow-up progress outside the JSON block.
4. Let `mark-verified` and the commit after-gate advance verification state.

## Prevention rule

Do not manually downgrade or invent `worktree-task-v1` lifecycle modes to describe follow-up work. Keep narrative progress in Markdown status/evidence sections, preserve the canonical machine mode, refresh Git truth, then let `mark-verified` and `gate --phase after --apply` own the next verified transition.

## Alternative Route

Status: verified

Preconditions:

- The child branch has an existing `verified-commit` lifecycle state and a new staged follow-up.

Ordered steps:

1. Keep the owner block's canonical lifecycle modes aligned with the current managed state.
2. Set the owner repository `head` to the current pre-commit HEAD when required by the receipt contract.
3. Run `refresh --apply`, stage only task-owned paths, then run `mark-verified` with the actual check evidence.
4. Run the before gate, make a plain commit, and run the after gate with `--apply`.

Verification:

- The previously blocked right-side changed-file disclosure milestone passed `mark-verified`, the before gate, and the after gate after only the lifecycle mode was restored.

Applicability boundary:

- Applies to lifecycle-mode mismatch, not arbitrary task id, branch, owner, base, or scope mismatches.

Fallback:

- If restoring the canonical mode does not resolve the block, stop and inspect the complete bounded contract tuple; do not bypass the gate or rewrite Git-local state manually.
