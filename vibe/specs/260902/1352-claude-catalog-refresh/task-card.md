# Task Card

> Standard non-requirement work only.

Tool: claude
Date: 2026-09-02
Task: 1352-claude-catalog-refresh

## Task Documentation Sync Group

- Group key: `dsg:codex-host:1352-claude-catalog-refresh`
- Group owner: this `task-card.md`
- Git document prefixes: `vibe/specs/260902/1352-claude-catalog-refresh/`, `vibe/specs/PROJECT_STATUS.md`
- Declared code/config dependencies: `packages/adapters/claude-code/src/command.ts`, `packages/adapters/claude-code/src/claude-code-adapter.ts`, `packages/adapters/claude-code/src/transport.ts`
- Excluded unrelated dirty documents: `docs/tasks/WORKTREE_TASKS.md` and the parallel session's adapter/host-runtime delegation edits

```json documentation-sync-group-v1
{
  "schema": "documentation-sync-group-v1",
  "group_key": "dsg:codex-host:1352-claude-catalog-refresh",
  "group_owner": "vibe/specs/260902/1352-claude-catalog-refresh/task-card.md",
  "documents": [
    "vibe/specs/260902/1352-claude-catalog-refresh/task-card.md",
    "vibe/specs/PROJECT_STATUS.md"
  ],
  "dependencies": [
    "packages/adapters/claude-code/src/command.ts",
    "packages/adapters/claude-code/src/claude-code-adapter.ts",
    "packages/adapters/claude-code/src/transport.ts"
  ],
  "validators": [],
  "git_scope_prefixes": ["vibe/specs/260902/1352-claude-catalog-refresh"]
}
```

## Goal And Scope

- Symptom: the Claude Code model picker in codexhost still offered `Fable` → `claude-fable-5` after Fable 5.1 shipped.
- Findings (2026-09-02):
  - codexhost has no static model table; the catalog is `initializationResult().models` from the Claude Code CLI it spawns.
  - The CLI codexhost resolves (`~/.local/bin/claude`) was 2.1.252, whose model table has no `claude-fable-5-1`; Fable 5.1 appears from 2.1.255 (the Claude desktop app bundle) and in the published 2.1.258.
  - The Adapter caches a ready inspection per cwd for its lifetime; only `refresh: true` (availability retry, settings connection refresh) or a Host restart re-ran the CLI, so even an updated CLI stayed invisible.
  - The CLI itself keeps a shared config cache in `~/.claude.json` (`modelAccessCache`, `cachedGrowthBookFeatures`, `orgModelDefaultCache`, …): right after an older build runs, a newer build can still report the older model table until it refetches; observed twice today within one to two minutes. That is Claude Code behaviour, not codexhost's.
- Environment change made on request: `claude update` moved the native install 2.1.252 → 2.1.258 (`~/.local/bin/claude` link retargeted). The updater warned about a leftover npm-global `claude` under nvm; not removed.
- Fix: `claudeInstallationIdentity` (realpath + size + mtime of the executable) is recorded with each cached inspection; an inspect without `refresh` re-runs the CLI when the identity behind the command changed, keeps the cache when it is unchanged or unknown, and surfaces a missing executable instead of a stale catalog.
- Out of scope: pushing catalog changes to an already-open picker (the next picker load or availability refresh picks it up), other Harness Adapters.

## Decision

- Documentation level: `standard`
- Execution: `main-only`
- Key decision: compare a cheap file identity instead of spawning the CLI on every inspect; `undefined` identity keeps legacy caching so injected test dependencies stay valid.

## Work And Verification

- Changed surface: `command.ts` (`ClaudeInstallationIdentity`, `claudeInstallationIdentity`), `transport.ts` (`inspectInstallation` returns the identity), `claude-code-adapter.ts` (cache entries carry the fingerprint; `#installationUnchanged`).
- Verification: adapter + command vitest 94 pass (new: fingerprint-change re-inspect, unknown identity keeps cache, missing executable surfaces `notInstalled`; identity follows a version link and changes with the file); typecheck, eslint, prettier clean; runtime proof with the real binaries behind one symlinked command: link→2.1.252 inspect 1884 ms `claude-fable-5`, cached 0 ms, relink→2.1.258 inspect without `refresh` 2418 ms `claude-fable-5-1`, cached 1 ms.
- Unverified gaps: the running Host (started before this change) still serves its old cache until refresh or restart; Windows path resolution of the npm shim.

## Closeout

- Sidecar: `main-thread`
- Memory / error route: none; findings recorded here.
- Evolution Candidate: `none`
