# Project Rules

Tool: tool-neutral (codex, claude, grok, dsh, and any CodeNote-routed agent)

## Project Profile

- Name: `codexhost` (brand is always lowercase)
- Path: GitFork clone at `GitFork/codex-host`
- Stack: TypeScript workspaces under `packages/` plus native Rust crates under `crates/`
- Purpose: run non-Codex Agent Harnesses as independent Threads inside official Codex Desktop without forking Desktop or normalizing everything through ACP
- Initialization date: 2026-09-01

## Detected Manifests

- `package.json` (workspace root)
- `Cargo.toml` / `crates/*`
- `openspec/`
- `.agents/skills/`

## Code Layout

### Native Rust

- `crates/launcher/`: native application launch (`codexhost`, `codexhost-start`)
- `crates/shim/`: CLI Shim that proxies official `app-server`
- `crates/updater/`: update installation
- `crates/platform/`: shared Windows/macOS integration

### TypeScript Workspace

- `packages/protocol-core/`: Host protocol routing and projection
- `packages/mapping-store/`: external Thread metadata persistence
- `packages/harness-adapter/`: Harness abstraction
- `packages/adapters/`: Pi, Claude Code, Grok, OMP, DeepSeek Harness integrations
- `packages/desktop-control/`: CDP / Electron Inspector-driven Desktop interaction
- `packages/host-runtime/`: runtime composition
- `packages/update-manager/`: background update preparation
- `packages/shared-contracts/`: browser-safe types and runtime schemas
- `packages/renderer-extension/`: browser JavaScript extension

### Build, Release, And Docs

- `scripts/release/`: release preparation, packaging, and publishing
- `tools/`: development utilities and technical Gates
- `docs/`: product/domain documentation
- `openspec/`: accepted capability specs and in-flight changes
- `.agents/skills/`: project Skills (`codexhost-add-harness`, `codexhost-update-impact-audit`)

Directories that do **not** exist and must not be invented: `vibe/ai-db/`, `vibe/requirements/`.

## Boundary Rules

- Rust owns native launch, process management, update installation, and platform integration. It must not own Host protocol or Harness semantics.
- `shared-contracts` must not depend on Node.js-only capabilities.
- `renderer-extension` must not import Node.js built-ins, Electron private APIs, or Harness SDKs.
- Harness-specific protocol details must remain inside the corresponding Adapter.
- `tools/check-boundaries.mjs` (via `npm run lint`) enforces package layering. Read it before assuming a boundary is only a convention.

## Coding Style And Naming

- Write the brand as lowercase `codexhost`.
- Follow [docs/领域术语表.md](../../docs/领域术语表.md); do not conflate Harness, Model, Provider, Account, or Billing Source.
- TypeScript uses Strict Mode, ESLint, and Prettier. Rust uses rustfmt and Clippy.
- Look at existing Adapters, contracts, tests, and docs before adding patterns. Do not build a generic abstraction for a single speculative caller, and do not add a raw-RPC passthrough for Harness commands.

## Implementation Principles

- Inspect related implementations, tests, contracts, and documentation before making changes. Prefer established repository patterns and public APIs over parallel implementations.
- Reuse code only when semantics and ownership are aligned.
- Use as few concepts, states, entry points, and runtime actions as possible to express the real business flow directly.
- Keep changes narrowly scoped. Avoid unrelated refactors, renames, dependency upgrades, or formatting churn.
- Prefer explicit data flow and typed contracts over hidden global state, stringly typed protocols, or implicit cross-module coupling.

## Code Size And Structure

- Keep handwritten production modules focused on one primary responsibility.
- Treat 500 lines as a design-review signal, not a hard limit. When an existing module approaches or exceeds 800 lines, prefer placing cohesive new functionality in a separate module unless there is a documented reason not to.
- Split code by responsibility and ownership, not solely to satisfy a line-count target.
- Keep executable scripts focused on orchestration. Move reusable, domain, parsing, persistence, and testable logic into the owning package or crate.
- Do not create wrapper functions that add no domain meaning and are used only once.
- Generated files, fixtures, migrations, and declarative schemas are exempt from line-count guidance.

## Testing And Completion

- To build and launch the application from a source checkout, run `npm start` at the repository root.
- Small, low-risk changes do not require tests. For high-risk or cross-package changes, or when explicitly requested, add focused tests for changed behavior and boundary conditions; do not run full test suites by default.
- Do not claim a check passed unless it was executed. Report skipped or blocked checks and the reason.
- A change is complete only when implementation, contracts, tests, and affected documentation agree.
- Do not run `gate:a` / `gate:c` / `gate:claude` unless specifically asked.

## Commit And Pull Request Guidelines

- Use concise, imperative commit subjects. Conventional Commit prefixes such as `feat:`, `fix:`, `docs:`, and `test:` are preferred.
- Pull requests should explain purpose, affected requirements, validation performed, and linked issues. Include screenshots only for visible UI changes.
- Never commit ignored reference repositories, secrets, logs, downloads, or local environment files.

## High-Risk Areas

- Renderer injection and CDP bindings (`packages/desktop-control/`, `packages/renderer-extension/`).
- Host protocol routing (`packages/protocol-core/`, `packages/host-runtime/`).
- Adapter-native protocol (`packages/adapters/*`).
- Native launch, shim, updater, and platform crates.
- Release scripts and packaging under `scripts/release/`.
- Live Gate probes against real Codex Desktop / Claude Code installs.
- Unrelated dirty work already in the tree; do not reset, clean, or overwrite it.

## Local Rule Policy

- Keep project-specific constraints here; move reusable cross-project rules to CodeNote.
- Do not overwrite existing user work or unrelated business files.
- Before implementation, inspect the relevant source paths and existing docs for the current task.
- Before adding a Harness-specific slash/native command, read [docs/harness-command-integration.md](../../docs/harness-command-integration.md).
- Architecture facts live in [../knowledge/architecture.md](../knowledge/architecture.md).
