# codexhost Architecture

Tool: tool-neutral (codex, claude, grok, dsh, and any CodeNote-routed agent)
Date: 2026-09-01

## Sync Rule

Update this file when package ownership, Adapter boundaries, session runtime flow, or verification layout changes. Keep coding rules in [../rules/project.md](../rules/project.md).

## What This Project Is

`codexhost` lets non-Codex Agent Harnesses (Pi, Claude Code, Grok Build, DeepSeek Harness, OMP) run as independent Threads inside the official Codex Desktop shell, instead of Codex's own Harness. It does this without forking Codex Desktop or normalizing everything through ACP:

- Desktop side: uses CDP / Electron Inspector to enhance the official Codex Desktop's Agent selection and session UI. It does not rebuild the chat shell or modify the official installer.
- Protocol side: a CLI Shim transparently proxies the official `app-server`; native Codex requests pass through unchanged.
- Harness side: each Harness is integrated via its own native interface and projected onto Codex Desktop's existing streaming, tool, diff, approval, and question UI.

The goal is fidelity, not just "can chat" — streaming, tool state, patches, approvals, and questions should come from the Harness itself, not be guessed or faked by the Host.

Read [../../docs/领域术语表.md](../../docs/领域术语表.md) before making domain changes. Read [../../docs/harness-command-integration.md](../../docs/harness-command-integration.md) before adding a Harness-specific slash/native command.

## TypeScript Package Graph

Dependency direction flows one way — lower layers must not import from higher ones:

```text
shared-contracts (browser-safe types + zod schemas, no Node-only APIs)
  ├── mapping-store
  ├── harness-adapter
  ├── desktop-control
  ├── renderer-extension
  ├── update-manager
  └── protocol-core

packages/adapters/{claude-code,pi,grok,omp,deepseek-harness}
  — each depends on harness-adapter + shared-contracts, plus its own native SDK/CLI

host-runtime — top-level composition root
```

Harness-specific protocol details stay inside the owning Adapter. `tools/check-boundaries.mjs` enforces this statically.

## Rust Workspace

Owns native launch, process management, update installation, and platform integration only — never Host protocol or Harness semantics.

- `launcher` (`codexhost-launcher`): `codexhost` and `codexhost-start`
- `shim` (`codexhost-shim`): CLI Shim in front of official `app-server`
- `updater` (`codexhost-updater`): update installation
- `platform` (`codexhost-platform`): shared Windows/macOS integration

`tools/gate-a/native` is a Cargo workspace member for macOS launch-path probes and is not a `default-members` package.

## Session Runtime

1. `host-runtime` starts the Shim, which forwards native Codex traffic untouched.
2. `desktop-control` injects `renderer-extension` into the running Codex Desktop window.
3. When a user picks a non-Codex Agent, `protocol-core` routes that Thread's Turns to `packages/adapters/*`.
4. The Adapter talks to its Harness natively and translates events into Host Item/Turn/Interaction projections.
5. `mapping-store` persists external-Thread metadata; `update-manager` handles background update prep.

## Spec-Driven Changes

Larger changes are tracked as OpenSpec artifacts under [../../openspec/](../../openspec/). `openspec/specs/<capability>/spec.md` holds accepted behavior; `openspec/changes/<change-id>/` holds in-flight proposal/design/tasks. Check the matching spec before changing that behavior.

## Tests Layout

- `packages/**/test/**/*.test.ts`, `tools/**/*.test.mjs`, `tests/release/**/*.test.mjs` — vitest (`tests/vitest.config.js`)
- `tests/e2e/*.spec.ts` — Playwright against the built renderer
- `tests/differential/` and `tests/fixtures/{gate-a,gate-c,gate-claude-code}` — live/differential Gate probes
- Rust tests live alongside each crate
