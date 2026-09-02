## ADDED Requirements

### Requirement: Ephemeral derived External Threads are omitted from the default directory

Host SHALL omit ready External records that are both `ephemeral` and have `forkSource` from default `thread/list` aggregation. Those records remain readable by Host Thread id. Host SHALL NOT treat Fork lineage as a Codex Subagent relationship and SHALL NOT match them through `parentThreadId` / `ancestorThreadId` filters.

#### Scenario: Side-chat derived row is hidden

- **WHEN** Desktop requests a non-archived Thread list
- **AND** a ready External record is ephemeral and has `forkSource`
- **THEN** Host SHALL omit that record from the aggregated page
- **AND** a later `thread/read` of that Host Thread id SHALL still succeed when the Thread is loaded

#### Scenario: Independent extra-process Thread remains listed

- **WHEN** a ready External record is not ephemeral or has no `forkSource`
- **THEN** Host SHALL keep applying the existing directory filters to that record
