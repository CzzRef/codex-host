# Task Card

> Standard non-requirement work only.

Tool: claude
Date: 2026-09-02
Task: 1349-launcher-controller-reap

## Task Documentation Sync Group

- Group key: `dsg:codex-host:1349-launcher-controller-reap`
- Group owner: this `task-card.md`
- Git document prefixes: `vibe/specs/260902/1349-launcher-controller-reap/`, `vibe/specs/PROJECT_STATUS.md`
- Declared code/config dependencies: `crates/platform/src/termination_signal.rs`, `crates/launcher/src/main.rs`, `packages/desktop-control/src/parent-process-watch.ts`, `packages/desktop-control/src/release-main.ts`
- Excluded unrelated dirty documents: `docs/tasks/WORKTREE_TASKS.md` (parallel worktree task control index)

```json documentation-sync-group-v1
{
  "schema": "documentation-sync-group-v1",
  "group_key": "dsg:codex-host:1349-launcher-controller-reap",
  "group_owner": "vibe/specs/260902/1349-launcher-controller-reap/task-card.md",
  "documents": [
    "vibe/specs/260902/1349-launcher-controller-reap/task-card.md",
    "vibe/specs/PROJECT_STATUS.md"
  ],
  "dependencies": [
    "crates/platform/src/termination_signal.rs",
    "crates/launcher/src/main.rs",
    "packages/desktop-control/src/parent-process-watch.ts",
    "packages/desktop-control/src/release-main.ts"
  ],
  "validators": [],
  "git_scope_prefixes": ["vibe/specs/260902/1349-launcher-controller-reap"]
}
```

## Goal And Scope

- Symptom: eight `desktop-control/dist/release-main.js` processes (ppid 1, 17–22 h old, dead Inspector endpoints) were found on 2026-09-02. Each was a Controller whose Launcher had died without running its teardown.
- Root cause: the Launcher only stops the Controller on a normal Desktop exit, an update stop, or an unwinding return (`SupervisedChild` guard). A termination signal (`kill`, service stop) or a hard kill skips all three, and the Controller had no independent reason to exit.
- Fix, two independent layers:
  - Launcher: after `notify_ready_and_detach`, `SIGTERM` / `SIGINT` / `SIGHUP` set an atomic flag (`codexhost_platform::install_termination_signal_flag`); the supervision loop polls it and runs the same `stop_managed_desktop` path an update uses (Controller stop, Desktop shutdown, escaped cleanup, descriptor drop). Handlers are installed only after detaching so `Ctrl+C` during startup still cancels a launch.
  - Controller: `watchParentProcess` polls `process.ppid` and a signal-0 probe every second and aborts the Controller when the Launcher is gone, covering `SIGKILL` and crashes the Launcher cannot handle.
- Out of scope: Windows console-control handling (unchanged; the parent watch still covers it), the eight already-cleaned processes.

## Decision

- Documentation level: `standard`
- Execution: `main-only`
- Key decision: terminating the supervisor tears the managed Desktop down (same semantics as the update path) rather than leaving a headless Desktop with no Controller and no descriptor.
- High-risk / DB boundary: none.

## Work And Verification

- Changed surface: `crates/platform/src/termination_signal.rs` (new) + `lib.rs` export; `crates/launcher/src/main.rs` supervision loops; `packages/desktop-control/src/parent-process-watch.ts` (new), `release-main.ts`, `index.ts`; tests in both packages.
- Verification (2026-09-02): `cargo test -p codexhost-platform --lib termination_signal` 1 pass; `cargo test -p codexhost-launcher --bin codexhost` 41 pass; clippy `-D warnings` and `cargo fmt --check` clean; `vitest packages/desktop-control` 68 pass; runtime proof: a parent `SIGKILL`ed while its child ran `watchParentProcess` made the child exit within the next poll.
- Live state 2026-09-02: the 18:45 and 18:50 source relaunches run the launcher binary and controller dist built from this change (controller 5777 is a child of launcher 5766). The 18:45 instance was quit by another session at about 18:49 before a `SIGTERM` could be sent; its controller 92611 did not linger.
- SIGTERM end to end 2026-09-02 19:15:18: `kill -TERM 82835` on the 19:13 source Launcher; the Launcher exited within 2 s and took controller 82839, Desktop root 82838, Host runtime 83007 and a Grok child 84549 with it, the runtime descriptor was removed, and no controller was left under PID 1. Relaunched at 19:15:21 as launcher 91215 / desktop 91219 / controller 91220 / host 91347.
- Unverified gaps: Windows.

## Closeout

- Sidecar: `main-thread`
- Memory / error route: none; the cause and both layers are documented here and in source comments.
- Evolution Candidate: `none`
