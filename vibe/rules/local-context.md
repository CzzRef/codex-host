<!-- codenote-local-context:conditional-v3 -->
# Project context

Project-owned conditional detail. Edit this local owner for project-specific facts; global policy stays in the compact core. Commands and inline paths are relative to the repository root unless their original text says otherwise. Read the sections relevant to the affected surface before material work.

## Project context from AGENTS.md

# codexhost AI Adapter

- Read the [project rule index](<README.md>) as the project entry.
- Parallel host adapter: [CLAUDE.md](<../../CLAUDE.md>). Keep the two files equivalent routers.

Load by task signal:
- Read [documentation rules](<documentation.md>) for Standard/Controlled, documentation-governance, or template-propagation work.
- Read the [process hub](<../specs/PROJECT_STATUS.md>) for ongoing or overlapping work, Controlled tasks, or cross-repo work.
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
- Brand is lowercase `codexhost`. Domain terms: [docs/领域术语表.md](<../../docs/领域术语表.md>); in particular, do not conflate Harness, Model, Provider, Account, or Billing Source.

Hard constraints:
- Keep project-specific rules in `vibe/rules/`; do not copy the CodeNote master into this repository.
- Preserve existing behavior and unrelated dirty work.
- Do not run `gate:a` / `gate:c` / `gate:claude` unless asked.
- Write Markdown links relative to the target document location.
- Do not claim a check passed unless it was executed. Report skipped or blocked checks and the reason.
- Commit messages carry `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` when the host mandates it; this is the recorded host-mandated trailer exception in [CodeNote github/rules.md §2.4](<../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/github/rules.md>), not a lapse. Author and committer fields still show only the human owner.

## Project context from CLAUDE.md

# codexhost Claude Adapter

- Read the [project rule index](<README.md>) as the project entry.
- Parallel host adapter: [AGENTS.md](<../../AGENTS.md>). Keep the two files equivalent routers.

## Project context from vibe/rules/README.md

# codexhost AI Rules

## Initialization

- This file is the project entry. Links below are task routes, not an initialization preload list.
- Start with the smallest applicable owner and add another only when a distinct task signal or global guard requires it.

## Task Routes

- Project constraints: [project.md](<project.md>), for source, configuration, business behavior, or project-risk work.
- Commands and verification: [workflow.md](<workflow.md>), before running project commands or selecting checks.
- Knowledge routing: [knowledge.md](<knowledge.md>), when reusable project facts, ADRs, technical knowledge, or memory need lookup or synchronization.
- Documentation routing: [documentation.md](<documentation.md>), for Standard/Controlled, documentation-governance, or template-propagation work.
- Process hub: [PROJECT_STATUS.md](<../specs/PROJECT_STATUS.md>), for ongoing or overlapping work, Controlled tasks, or cross-repo work.
- Matching error memory: [project error-memory index](<../knowledge/error-memory/README.md>), only before repeating a known failed route or when the current symptom/fingerprint matches; load only the matching record.
- Error capture: [error-memory-capture](<../../../../CzzProj/CodeNote/AiRef/VibePractice/Skills/global/error-memory-capture/SKILL.md>), only after a verified reusable failure, user correction, repeated failed approach, or tool/runtime trap.

## Rule Boundary

- CodeNote stores cross-project AI collaboration rules.
- This project stores only project-specific stack, commands, paths, business rules, risk areas, and verification notes.
- No AI-DB workspace. Do not create empty `vibe/ai-db/`.
- Requirement Manifest is not configured; product behavior stays in `docs/`, `openspec/`, and source until a requirement owner is added.
- Existing product/integration task folders under `docs/tasks/` remain an approved authority. New CodeNote process docs use `vibe/specs/<yyMMdd>/<HHmm-task-id>/`.

## Task Closeout

- Verification performed or skipped with reason.
- When the error-capture trigger above applies, route it through `error-memory-capture` to the project error-memory index before closeout; otherwise do not preload the Skill or archive.
