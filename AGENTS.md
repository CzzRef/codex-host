# codexhost AI Adapter

Tool: tool-neutral (codex, claude, grok, dsh, and any CodeNote-routed agent)

Initialize once:
- Reuse the injected [CodeNote master](../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/VibeAi.md), or read it once if it was not injected.
- Read the [project rule index](vibe/rules/README.md) as the project entry.
- Parallel host adapter: [CLAUDE.md](CLAUDE.md). Keep the two files equivalent routers.

Load by task signal:
- Read [documentation rules](vibe/rules/documentation.md) for Standard/Controlled, documentation-governance, or template-propagation work.
- Read the [process hub](vibe/specs/PROJECT_STATUS.md) for ongoing or overlapping work, Controlled tasks, or cross-repo work.
- From the project index, load only the smallest applicable owner; do not preload route targets or error memory without a matching task, retry, or failure signal.

Project facts:
- Brand is lowercase `codexhost`. Domain terms: [docs/领域术语表.md](docs/领域术语表.md).
- Rust owns native launch, process, update, and platform only. Host protocol and Harness semantics stay in TypeScript.
- `shared-contracts` is browser-safe. `renderer-extension` must not import Node builtins, Electron private APIs, or Harness SDKs. Harness protocol stays in `packages/adapters/*`.

Hard constraints:
- Keep project-specific rules in `vibe/rules/`; do not copy the CodeNote master into this repository.
- Preserve existing behavior and unrelated dirty work.
- Do not run `gate:a` / `gate:c` / `gate:claude` unless asked.
- Write Markdown links relative to the target document location.
- Final replies must include verification status and memory/process-document status.
