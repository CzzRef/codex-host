## ADDED Requirements

### Requirement: Last-turn replacement may stash a distinct Redo slot

When Mapping Store replaces a ready External Thread after last-turn rollback with a **distinct** NativeSessionRef, it SHALL persist `historyRedo` containing the previous NativeSessionRef and the previous complete Turn mapping set. The slot SHALL NOT contain conversation bodies. Same-Native-Session-ID replacement SHALL omit `historyRedo`. A later new Host Turn mapping or post-Fork ready replacement SHALL drop the slot.

#### Scenario: Distinct last-turn replacement stashes Redo

- **WHEN** Host replaces a ready multi-Turn Thread with a distinct Native Session whose mappings are the exact current prefix minus the final Turn
- **THEN** the durable record SHALL contain `historyRedo.nativeSessionRef` equal to the previous Native Session
- **AND** `historyRedo.turnMappings` SHALL equal the previous mapping set
- **AND** a restart SHALL recover that slot

#### Scenario: In-place last-turn replacement has no Redo slot

- **WHEN** last-turn replacement keeps the same Native Session ID
- **THEN** the durable record SHALL NOT contain `historyRedo`

#### Scenario: New Turn clears Redo

- **WHEN** a new Host Turn mapping is added while `historyRedo` is present
- **THEN** the next durable record SHALL omit `historyRedo`

### Requirement: Redo restores the stashed Native identity atomically

Mapping Store SHALL replace the current ready NativeSessionRef and Turn mappings with the exact `historyRedo` payload in one atomic write and SHALL omit `historyRedo` from the result. Failure SHALL leave the rolled-back record authoritative.

#### Scenario: Redo replacement succeeds

- **WHEN** Host commits Turn mappings and NativeSessionRef that exactly match the persisted `historyRedo`
- **THEN** restart SHALL recover that longer Native identity and mapping set without a Redo slot

#### Scenario: Redo payload does not match the slot

- **WHEN** Native identity or Host Turn IDs differ from `historyRedo`
- **THEN** the Store SHALL reject the write without changing the rolled-back record
