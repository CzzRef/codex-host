## Why

Codex Desktop Side Chat on an external Thread currently becomes a second, projectless conversation: Host forks a derived Native Session, Renderer opens that child in the sidebar, and `thread/list` keeps the ephemeral row. Jump then lands on the child, which has no project affiliation. Users expect Codex GPT behavior: the child stays bound to the main conversation.

## What Changes

- Bind navigation of ephemeral derived External Threads to `forkSource` (already persisted as `forkedFromId`).
- Omit those rows from the default Desktop/CLI Thread directory, without treating Fork lineage as a Subagent `parentThreadId` filter.
- After a projectless external Fork, Renderer stays on the source Thread instead of clicking the derived sidebar row.
- When a Host deep link is emitted for an ephemeral derived Thread, it targets the source Thread.
- The derived Session still accepts Turns; `thread/read` of the child id still works.
- Cross-harness parent transcript injection is out of this change.

## Capabilities

### New Capabilities

- none (navigation uses existing `forkSource`)

### Modified Capabilities

- `external-thread-fork-routing`: Side Chat remains a derived Session but navigation/jump stay on the source Thread.
- `external-thread-list-archive-routing`: default list omits ephemeral derived External records.

## Impact

- `packages/host-runtime`: list filter; optional navigation id helper.
- `packages/renderer-extension`: projectless Fork open path.
- Official Codex Threads remain passthrough.
