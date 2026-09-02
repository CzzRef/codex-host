---
id: codexhost-worktree-root-node-modules-symlink-misses-workspace-nested-deps
status: verified
scope: codexhost npm-workspace verification in a Git worktree
fingerprint: fresh worktree + only root node_modules symlinked from primary checkout + root tsc build reports TS2307 for workspace-local dependencies that npm ls resolves in the primary checkout
first_seen: 2026-09-02
last_verified: 2026-09-02
review_after: 2026-12-01
evidence:
  - ../../specs/260902/1340-worktree-checkbox-routing/task-card.md
tags:
  - worktree
  - npm-workspaces
  - typescript
  - verification
---

# Root `node_modules` symlink misses workspace-local dependencies

## Symptom

A fresh codexhost Git worktree reused the primary checkout by symlinking only the repository-root `node_modules`. Running the root TypeScript build then failed in the DeepSeek Harness Adapter with errors including:

```text
TS2307: Cannot find module '@deepseek-ai/dsh-host-apiproxy/api'
TS2307: Cannot find module '@deepseek-ai/dsh-session/types'
```

The affected Renderer source still passed its focused TypeScript build, tests, lint, boundary check, and bundle build.

## Wrong assumption

A root `node_modules` symlink was assumed to reproduce the complete npm workspace installation for a sibling Git worktree.

## Verified root cause

The locked DeepSeek dependencies are declared by `packages/adapters/deepseek-harness/package.json` and installed under the primary checkout's package-local `packages/adapters/deepseek-harness/node_modules`. A sibling worktree that links only the root installation cannot resolve those package-local modules from its own Adapter source path. `npm ls` in the primary checkout succeeds because that checkout has both root and package-local installation trees.

This fingerprint applies to reused npm workspace installations with nested package-local dependencies. It does not indicate a Renderer regression and does not apply after the child worktree has received its own complete install.

## Detection order

1. Confirm the missing module is declared in the owning workspace package and lockfile.
2. Compare package resolution from the primary checkout with the child worktree; inspect package-local `node_modules`, not only the root.
3. Classify a root build failure as environmental only when affected-project checks independently pass and the missing modules are outside the changed dependency surface.
4. Do not claim the full root build passed.

## Prevention rule

Do not use a root-only `node_modules` symlink as evidence for a full codexhost workspace build. Bootstrap the child with a complete lockfile installation, mirror both root and every package-local workspace installation, or run and report only focused affected-project checks.

## Alternative route

Status: verified

Preconditions:

- The task does not modify the missing workspace package, its dependencies, root dependency metadata, or cross-package contracts consumed by it.

Steps:

1. Build the affected referenced TypeScript projects directly.
2. Run the affected package suite and browser E2E.
3. Run the Renderer bundle, lint, boundaries, formatting, and requirement validation.
4. Report the root build as blocked by the incomplete reused installation.

Verification:

- The Worktree checkbox task passed focused `shared-contracts` + `renderer-extension` TypeScript build, 225 Renderer tests, Composer Playwright E2E, Renderer bundle, ESLint, boundaries, Prettier, and strict OpenSpec validation.
- A temporary complete dependency mirror covering the repository root plus every package-local workspace `node_modules` then passed the full root `npm run typecheck`.

Fallback:

- Run a complete lockfile install inside the child worktree before retrying the full root build. This installation fallback remains candidate until separately exercised.
