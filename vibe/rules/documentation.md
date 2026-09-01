# Documentation Rules

Tool: tool-neutral (codex, claude, grok, dsh, and any CodeNote-routed agent)
Date: 2026-09-01

## Purpose

Define codexhost-specific documentation routing. Cross-project documentation and process rules stay in CodeNote; this file maps those rules onto this repository.

## Authoritative Sources

| Layer | Location | Role |
| --- | --- | --- |
| Global master | [../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/VibeAi.md](../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/VibeAi.md) | Cross-project AI workflow, safety, memory, verification, and documentation rules. |
| Process layout authority | [../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/process/rules.md](../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/process/rules.md#3-project-location) | Task date grouping, task folder layout, and flat-folder repair. |
| DB governance | [../../../../CzzProj/CodeNote/DevelopRef/调试工具/db/governance/README.md](../../../../CzzProj/CodeNote/DevelopRef/调试工具/db/governance/README.md#5-workspace-shape-and-naming) | AI-DB workspace shape; unused here until DB/data work is authorized. |
| Project adapters | [../../AGENTS.md](../../AGENTS.md), [../../CLAUDE.md](../../CLAUDE.md) | Short tool routing surfaces; keep them equivalent. |
| Project rules | [README.md](README.md), [project.md](project.md), [workflow.md](workflow.md), [knowledge.md](knowledge.md), [documentation.md](documentation.md) | Stack, risk boundaries, verification, and local documentation routing. |
| Process hub | [../specs/PROJECT_STATUS.md](../specs/PROJECT_STATUS.md) | Current focus, active task docs, verification status, and open gates. |
| New process docs | [../specs/](../specs/) | CodeNote-dated task folders for new AI-rule and process work. |
| Existing task docs | [../../docs/tasks/](../../docs/tasks/) | Approved existing product/integration task authority. |
| Product docs | [../../docs/](../../docs/) | Domain glossary, harness integration, and current product notes. |
| OpenSpec | [../../openspec/](../../openspec/) | Accepted capability specs and in-flight change packages. |
| Project knowledge | [../knowledge/README.md](../knowledge/README.md) | Reusable project facts, ADR/error-memory indexes, and architecture. |

## Project Mapping

- Keep reusable cross-project rules in CodeNote; keep only this repository's stack, commands, paths, and risk boundaries here.
- Task/archive folder date grouping and flat-folder repair are not redefined here; follow the global process layout authority above.
- Existing `docs/tasks/` folders remain the authority for work already started there. Do not copy those packages into `vibe/specs/` unless a later task is authorized to migrate them.
- New CodeNote process work uses `vibe/specs/<yyMMdd>/<HHmm-task-id>/`.
- Canonical product/domain facts stay in `docs/` and `openspec/`; `vibe/knowledge/` indexes them instead of duplicating bodies.
- DB workspace is not configured. If AI-DB/data work becomes active, initialize `vibe/ai-db/` through the DB governance authority above.
- Requirement Manifest is absent. Do not invent `vibe/requirements/` until a requirement delta is authorized.

## Process Contract Routing

- [Process rules](../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/process/rules.md) solely own `Quick`, `Standard`, `Standard requirement`, and `Controlled`. Legacy `L0/L1`, `L2`, and `L3/L4` labels are compatibility vocabulary only and never force a level.
- `Standard non-requirement` routes to its Task Card; `Standard requirement` routes to `raw-requirement.md + spec.md`, with the Spec owner holding the complete requirement evidence. Controlled routes to the globally defined five owners.
- Communication and final-response behavior routes to [process/communication-io.md](../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/process/communication-io.md); rollout and runtime supervision route to [codex-evolution/rollout/README.md](../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/codex-evolution/rollout/README.md) and [codex-evolution/runtime-supervision/README.md](../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/codex-evolution/runtime-supervision/README.md). This project adapter does not duplicate those algorithms.
- Sidecar and Evolution Candidate routing stay in the process owner above; this adapter does not restate those algorithms.

## Closeout

- Update [../specs/PROJECT_STATUS.md](../specs/PROJECT_STATUS.md) when current focus, active task docs, verification state, gates, sibling links, or memory routing changes.
- Promote reusable conclusions to [../knowledge/README.md](../knowledge/README.md), ADR/error-memory equivalents, or project rules when applicable.
- Report verification, memory routing, and process document status in final delivery.
