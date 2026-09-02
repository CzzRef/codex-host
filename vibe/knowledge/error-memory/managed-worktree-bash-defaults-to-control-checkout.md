---
id: codexhost-managed-worktree-bash-defaults-to-control-checkout
status: verified
scope: codexhost managed-worktree command execution
fingerprint: managed child worktree + coding harness cwd remains original control checkout + relative bash verification runs against the wrong tree
first_seen: 2026-09-02
last_verified: 2026-09-02
review_after: 2026-12-01
evidence:
  - ../../specs/260902/1340-worktree-checkbox-routing/task-card.md
tags:
  - worktree
  - bash
  - cwd
  - verification
  - write-isolation
---

# Managed-worktree Bash can default to the control checkout

## Symptom

A task continued in a dedicated child Worktree, and file edits used explicit child paths correctly. A later relative Bash verification unexpectedly printed the original control checkout as the Vitest root and showed that checkout's unrelated dirty files. The child Worktree still contained the intended changes, but the first formatting/test/typecheck attempt did not verify them.

## Wrong assumption

Selecting a child Worktree as the task implementation lane was assumed to change the coding harness's default command working directory. In this harness, the injected current working directory remained the original control checkout.

## Verified root cause

Relative Bash commands execute from the harness's declared current working directory unless the command explicitly selects another directory. Worktree lifecycle state and absolute-path file edits do not mutate that command default. The first verification therefore targeted the control checkout; comparing both Git views confirmed that no task source was written there.

This fingerprint applies when a managed child Worktree differs from the coding harness's injected cwd. It does not apply when the harness itself was launched inside the child or the tool provides an explicit per-call cwd parameter.

## Correct detection order

1. Before the first command in a managed Worktree, print or otherwise assert the command cwd.
2. Compare it with the task card's Worktree lane, not merely the repository name or branch.
3. If they differ, treat every relative Bash path as unsafe for implementation and verification.
4. After an accidental command, compare both Git statuses before attempting cleanup; do not alter unrelated control-checkout changes.

## Prevention rule

Every Bash command for a managed child Worktree must begin by explicitly selecting the child lane and should print/assert that path before material verification. File edits must continue using absolute child paths. Never infer command cwd from the active task, branch name, or previous absolute-path edits.

## Alternative Route

Status: verified

Preconditions:

- The task owner declares a dedicated child Worktree, while the coding harness cwd points at the control checkout.

Ordered steps:

1. Give each Bash invocation an explicit child-Worktree directory selection.
2. Print/assert the resulting cwd at the start of validation batches.
3. Run focused verification and inspect child `git status`.
4. Inspect control-checkout `git status` only for comparison; preserve all unrelated dirty work.

Verification:

- Re-running focused Renderer tests and TypeScript compilation after explicitly selecting the child lane used the child path and passed.
- Status comparison confirmed that task source changes existed only in the child; the mistaken control-checkout run was read/verification-only.

Applicability boundary:

- Applies to command execution in a managed Worktree when the harness cwd remains another checkout.
- Does not authorize changing or cleaning the control checkout.

Fallback:

- If a mistaken command wrote files, diff both trees, identify only the exact accidental delta, and seek the narrowest safe recovery. Never reset a dirty control checkout wholesale.
