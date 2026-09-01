# Knowledge Rules

Tool: tool-neutral (codex, claude, grok, dsh, and any CodeNote-routed agent)

## Routing

- Canonical product/domain docs: `docs/`
- Domain glossary: `docs/领域术语表.md`
- OpenSpec capability specs: `openspec/`
- Existing product/integration tasks: `docs/tasks/`
- Architecture map: `vibe/knowledge/architecture.md`
- Error memories: `vibe/knowledge/error-memory/`
- ADRs: `vibe/knowledge/adr/`
- New process docs: `vibe/specs/`

## Initialization Notes

- No AI-DB workspace was created.
- `docs/` and `openspec/` remain the product/capability authorities; `vibe/knowledge/` indexes them.
- Existing `docs/tasks/` packages stay in place. New CodeNote process work uses `vibe/specs/`.

## Write Policy

- Search existing knowledge before adding new records.
- Store only reusable, verified, safe knowledge.
- Mark evidence as code, test, user-confirmed, official-doc, or inference.
- Never store credentials, install paths with secrets, or private receipts.
- Link old and new docs when business behavior changes.

## Document Governance Map

- Knowledge index: [../knowledge/README.md](../knowledge/README.md)
- Specs index: [../specs/README.md](../specs/README.md)
- DB workspace: not configured for this project
- Use `--all-markdown` only for deep historical document hygiene; default audit covers active AI rule surfaces.
