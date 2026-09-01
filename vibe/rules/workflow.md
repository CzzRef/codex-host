# Workflow Rules

Tool: tool-neutral (codex, claude, grok, dsh, and any CodeNote-routed agent)

## Commands

Prefer documented project scripts over inventing new ones. Do not run destructive commands, live Gate probes, or production operations without explicit confirmation.

```bash
npm start                     # build nothing; launches the app from source via tools/dev-desktop/run.mjs
npm run build                 # build:typescript + build:renderer + build:rust, in that order
npm run build:typescript      # tsc -b across the TS workspaces
npm run build:renderer        # esbuild bundle for @codexhost/renderer-extension
npm run build:rust            # cargo build for launcher/platform/shim/updater crates

npm run typecheck             # tsc -b plus tests/tsconfig.json, no emit
npm run lint                  # eslint . + tools/check-boundaries.mjs (package boundary enforcement)
npm run format                # prettier --write . + cargo fmt --all
npm run format:check          # prettier --check . + cargo fmt --all --check

npm run test:typescript       # build:typescript, then vitest run --config tests/vitest.config.js
npm run test:rust             # cargo test --workspace --locked --features codexhost-shim/test-utils,codexhost-gate-a-native/gate-tools
npm test                      # test:typescript + test:rust
npm run test:e2e              # playwright test --config tests/e2e/playwright.config.js

npm run check                 # format:check + lint + typecheck + test:typescript + check:rust (full pre-PR gate)
npm run check:rust            # cargo fmt --check + clippy -D warnings + cargo test (Rust equivalent of `check`)
```

Running a single TS test:

```bash
npm run build:typescript
npx vitest run --config tests/vitest.config.js packages/harness-adapter/test/some-file.test.ts
npx vitest run --config tests/vitest.config.js -t "test name substring"
```

Running a single Rust test:

```bash
cargo test --locked --features codexhost-shim/test-utils,codexhost-gate-a-native/gate-tools -p codexhost-shim some_test_name
```

Do not run `gate:a` / `gate:c` / `gate:claude` unless specifically asked.

## Verification

- Small, low-risk changes do not require tests. High-risk or cross-package changes get focused tests for changed behavior.
- Do not claim a check passed unless it was executed. Report skipped or blocked checks and the reason.
- For rule-only edits, run the CodeNote project audit below. Do not start Desktop, run full `npm test`, or live Gates just to prove a docs/rules change.
- For documentation-heavy changes, validate Markdown links and record unresolved links.

## Required AI Rule Audit

From the repository root, using the CodeNote audit relative to this clone:

```bash
python3 ../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/scripts/audit_ai_rules.py . --mode project --fix-links
python3 ../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/scripts/audit_ai_rules.py . --mode project
```
