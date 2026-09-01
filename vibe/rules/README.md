# codexhost AI Rules

Tool: tool-neutral (codex, claude, grok, dsh, and any CodeNote-routed agent)

## Initialization

- Reuse the injected [CodeNote master](../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/VibeAi.md), or read it once if it was not injected.
- This file is the project entry. Links below are task routes, not an initialization preload list.
- Start with the smallest applicable owner and add another only when a distinct task signal or global guard requires it.

## Task Routes

- Global owner discovery: [CodeNote rule index](../../../../CzzProj/CodeNote/AiRef/VibePractice/Vibe_Rules/README.md), only for AI-rule governance or unresolved global owner lookup.
- Project constraints: [project.md](project.md), for source, configuration, business behavior, or project-risk work.
- Commands and verification: [workflow.md](workflow.md), before running project commands or selecting checks.
- Knowledge routing: [knowledge.md](knowledge.md), when reusable project facts, ADRs, technical knowledge, or memory need lookup or synchronization.
- Documentation routing: [documentation.md](documentation.md), for Standard/Controlled, documentation-governance, or template-propagation work.
- Process hub: [PROJECT_STATUS.md](../specs/PROJECT_STATUS.md), for ongoing or overlapping work, Controlled tasks, or cross-repo work.
- Matching error memory: [project error-memory index](../knowledge/error-memory/README.md), only before repeating a known failed route or when the current symptom/fingerprint matches; load only the matching record.
- Error capture: [error-memory-capture](../../../../CzzProj/CodeNote/AiRef/VibePractice/Skills/global/error-memory-capture/SKILL.md), only after a verified reusable failure, user correction, repeated failed approach, or tool/runtime trap.

## Rule Boundary

- CodeNote stores cross-project AI collaboration rules.
- This project stores only project-specific stack, commands, paths, business rules, risk areas, and verification notes.
- No AI-DB workspace. Do not create empty `vibe/ai-db/`.
- Requirement Manifest is not configured; product behavior stays in `docs/`, `openspec/`, and source until a requirement owner is added.
- Existing product/integration task folders under `docs/tasks/` remain an approved authority. New CodeNote process docs use `vibe/specs/<yyMMdd>/<HHmm-task-id>/`.

## Task Closeout

Every AI task must report:

- Verification performed or skipped with reason.
- Memory routing: none, project memory, error archive, ADR, or needs user confirmation.
- Process document status: not needed, created, updated, compacted, or archived.
- When the error-capture trigger above applies, route it through `error-memory-capture` to the project error-memory index before closeout; otherwise do not preload the Skill or archive.
