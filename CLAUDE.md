# codexhost Claude Adapter

Tool: tool-neutral (codex, claude, grok, dsh, and any CodeNote-routed agent)

Initialize once:
- Reuse the injected [CodeNote master](../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/VibeAi.md), or read it once if it was not injected.
- Read the [project rule index](vibe/rules/README.md) as the project entry.
- Parallel host adapter: [AGENTS.md](AGENTS.md). Keep the two files equivalent routers.

Load by task signal:
- Read [documentation rules](vibe/rules/documentation.md) for Standard/Controlled, documentation-governance, or template-propagation work.
- Read the [process hub](vibe/specs/PROJECT_STATUS.md) for ongoing or overlapping work, Controlled tasks, or cross-repo work.
- From the project index, load only the smallest applicable owner; do not preload route targets or error memory without a matching task, retry, or failure signal.

## Product Intent

`codexhost` runs external Agent Harnesses as independent Threads inside Codex Desktop, preserving the official shell and native Codex path. Integrate each Harness through its native interface; preserve its actual capabilities and semantics rather than inventing equivalent-looking Host behavior.

## Code Layout

- `crates/`: `launcher/` native application launch, `shim/` process proxying, `updater/` update installation, `platform/` cross-platform native integration.
- `packages/`: `protocol-core/` Host protocol routing and projection, `mapping-store/` external Thread metadata persistence, `harness-adapter/` public Harness session and plugin contracts, `harness-discovery/` executable discovery, `harness-broker/` native Broker communication, `adapters/` Harness-specific implementations and plugin entry points, `desktop-control/` CDP / Electron Inspector-driven Desktop interaction, `host-runtime/` Host composition and installed plugin loading, `update-manager/` background update preparation, `shared-contracts/` browser-safe types and runtime schemas, `renderer-extension/` browser JavaScript extension.
- `scripts/release/`: release preparation, packaging, and publishing. `tools/`: development utilities and technical Gates.

## Boundary Rules

- Rust owns native launch, process management, update installation, and platform integration. It must not own Host protocol or Harness semantics.
- `shared-contracts` must remain browser-safe and independent of other Workspace packages.
- `renderer-extension` must not import Node.js built-ins, Electron private APIs, or Harness SDKs.
- Harness-specific protocol details must remain inside the corresponding Adapter.
- Host Runtime loads installed plugins through public contracts, not direct imports of concrete Adapter packages. The preinstalled set belongs to `scripts/release/harness-plugins.json`, not Host registration code.
- Use package public exports for cross-package dependencies. Read `tools/check-boundaries.mjs` before changing dependency directions; it is the executable boundary check run by `npm run lint`.

Project facts:
- Brand is lowercase `codexhost`. Domain terms: [docs/领域术语表.md](docs/领域术语表.md); in particular, do not conflate Harness, Model, Provider, Account, or Billing Source.

Hard constraints:
- Keep project-specific rules in `vibe/rules/`; do not copy the CodeNote master into this repository.
- Preserve existing behavior and unrelated dirty work.
- Do not run `gate:a` / `gate:c` / `gate:claude` unless asked.
- Write Markdown links relative to the target document location.
- Do not claim a check passed unless it was executed. Report skipped or blocked checks and the reason.
- Final replies must include verification status and memory/process-document status.
