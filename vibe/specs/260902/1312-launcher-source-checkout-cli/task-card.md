# Task Card

> Standard non-requirement work only.

Tool: claude
Date: 2026-09-02
Task: 1312-launcher-source-checkout-cli

## Task Documentation Sync Group

- Group key: `dsg:codex-host:1312-launcher-source-checkout-cli`
- Group owner: this `task-card.md`
- Git document prefixes: `vibe/specs/260902/1312-launcher-source-checkout-cli/`, `vibe/specs/PROJECT_STATUS.md`
- Declared code/config dependencies: `crates/launcher/src/installation_layout.rs`, `crates/launcher/src/main.rs`
- Linked authorities: [cross-harness delegation design](../../../../openspec/changes/add-cross-harness-delegation/design.md), [dev-desktop runner](../../../../tools/dev-desktop/run.mjs)
- Excluded unrelated dirty documents: Redo task docs, Composer overlay files, unread-only `app-server-host` hunk

```json documentation-sync-group-v1
{
  "schema": "documentation-sync-group-v1",
  "group_key": "dsg:codex-host:1312-launcher-source-checkout-cli",
  "group_owner": "vibe/specs/260902/1312-launcher-source-checkout-cli/task-card.md",
  "documents": [
    "vibe/specs/260902/1312-launcher-source-checkout-cli/task-card.md",
    "vibe/specs/PROJECT_STATUS.md"
  ],
  "dependencies": [
    "crates/launcher/src/installation_layout.rs",
    "crates/launcher/src/main.rs"
  ],
  "validators": [],
  "git_scope_prefixes": ["vibe/specs/260902/1312-launcher-source-checkout-cli"]
}
```

## Goal And Scope

- Goal: a Launcher built into a source checkout (`<root>/target/{debug,release}/codexhost`) must still serve the delegation CLI reached through `CODEXHOST_CLI_PATH`.
- Symptom: without an install tree beside it, `run_delegation_cli` spawned a missing node/Host Runtime pair and callers saw an empty Thread list instead of a CLI error.
- In scope: `source_checkout_host_runtime` layout probe; `source_checkout_node` (explicit `HOST_NODE_PATH_ENV`, then first `node` on `PATH`); explicit error when neither an install tree nor a built checkout provides a Host Runtime.
- Out of scope: `launch` argument handling (`npm start` already passes paths), update/install layout, Host protocol.

## Decision

- Documentation level: `standard`
- Execution: `main-only`
- Key decision: fall back only when the installed Host Runtime file is absent, so an installed Launcher keeps its own resources; the fallback mirrors the development layout `tools/dev-desktop/run.mjs` owns.
- High-risk / DB boundary: none.

## Work And Verification

- Changed surface: `crates/launcher/src/installation_layout.rs` (`source_checkout_host_runtime` + 2 unit tests); `crates/launcher/src/main.rs` (`source_checkout_node`, fallback in `run_delegation_cli`).
- Verification: `cargo test -p codexhost-launcher --bin codexhost installation_layout` 5 pass (2026-09-02).
- Unverified gaps: live delegation call from a Harness child process against a source-checkout Launcher.

## Closeout

- Sidecar: `main-thread`
- Memory / error route: none; symptom is documented in the source comment and here.
- Evolution Candidate: `none`
