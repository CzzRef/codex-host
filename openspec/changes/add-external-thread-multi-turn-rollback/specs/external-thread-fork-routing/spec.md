## ADDED Requirements

### Requirement: Host inspect publishes rollback ability

`codexhost/thread/inspect` for a mapped External Thread SHALL include `rollback: { lastTurn, multiTurn }`. `lastTurn` SHALL be true when `thread/rollback` with `numTurns = 1` would be served (Harness `history.rollbackLastTurn`, or an untouched Fork-derived Thread whose source can be re-forked); `multiTurn` SHALL be true when `numTurns > 1` would be served. Official Codex Threads SHALL NOT carry the field. The bits are advisory: execution SHALL still validate every boundary.

#### Scenario: Harness without rollback

- **WHEN** a live External Thread's Harness reports `rollbackLastTurn: false` and the Thread is not Fork-derived
- **AND** no retained Turn boundary carries a Native Checkpoint usable for a Fork
- **THEN** inspect SHALL report `rollback: { lastTurn: false, multiTurn: false }`

#### Scenario: Last-turn-only Harness

- **WHEN** a live External Thread's Harness reports `rollbackLastTurn: true` and `fork: false`
- **THEN** inspect SHALL report `lastTurn: true` and `multiTurn: false`
