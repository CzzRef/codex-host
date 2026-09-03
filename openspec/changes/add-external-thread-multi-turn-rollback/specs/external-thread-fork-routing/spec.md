## ADDED Requirements

### Requirement: Host inspect publishes rollback ability

`codexhost/thread/inspect` for a mapped External Thread SHALL include `rollback: { lastTurn, multiTurn }`. `lastTurn` SHALL be true when `thread/rollback` with `numTurns = 1` would be served (Harness `history.rollbackLastTurn`, an untouched Fork-derived Thread whose source can be re-forked, or a Harness with `history.fork` whose second-to-last retained Turn carries a Native Checkpoint); `multiTurn` SHALL be true when `numTurns > 1` would be served (Fork lineage, or `history.fork` with a Native Checkpoint on any Turn before the last two). Official Codex Threads SHALL NOT carry the field. The bits are advisory: execution SHALL still validate every boundary.

#### Scenario: Harness without rollback

- **WHEN** a live External Thread's Harness reports `rollbackLastTurn: false` and `fork: false`
- **THEN** inspect SHALL report `rollback: { lastTurn: false, multiTurn: false }`

#### Scenario: Last-turn-only Harness

- **WHEN** a live External Thread's Harness reports `rollbackLastTurn: true` and `fork: false`
- **THEN** inspect SHALL report `lastTurn: true` and `multiTurn: false`

#### Scenario: Fork-capable Harness with Checkpoints

- **WHEN** a live Pi Thread (`rollbackLastTurn: false`, `fork: true`) has three completed Turns, each mapped with a Native Checkpoint
- **THEN** inspect SHALL report `rollback: { lastTurn: true, multiTurn: true }`

### Requirement: Host rolls a live External Thread back at its own Checkpoint

For `thread/rollback` on a live External Thread that is not served by `history.rollbackLastTurn` or by an untouched Fork-derived prefix, the Host SHALL fork the Thread's own Native Session at the Native Checkpoint of the last retained Turn (`open({ kind: "fork", sourceRef: <own Session>, checkpoint })`), require the result to be a distinct Native Session holding exactly the retained Turns with unchanged transport configuration, persist the shorter Host Turn prefix on the new Session, stash the previous Session and full Turn list in the single Redo slot, and replace the runtime Session. The first Turn SHALL always be retained: `numTurns >= turns` is rejected with `-32076` before any Fork. A missing Checkpoint on the boundary is `-32080`; nothing is written and no Session is replaced on any failure. Project files are not rewound.

#### Scenario: Two Turns dropped from a three-Turn Pi Thread

- **WHEN** Desktop sends `thread/rollback { numTurns: 2 }` for a live Pi Thread with three completed Turns
- **THEN** the Host responds with the Thread holding only the first Turn on a new Native Session, the mapping record's `historyRedo` holds the previous Session with all three Turn mappings, the previous Session is closed, and `codexhost/thread/redo` restores the three-Turn Session

#### Scenario: Rolling back every Turn

- **WHEN** Desktop sends `thread/rollback { numTurns: 3 }` for the same Thread
- **THEN** the Host responds `-32076` and opens no Session

#### Scenario: Fork-derived Thread that grew past its boundary

- **WHEN** a Fork-derived Thread has completed a Turn after the Fork boundary and Desktop sends `thread/rollback { numTurns: 1 }`
- **THEN** the Host rolls it back on its own lineage at the boundary Turn's Checkpoint instead of failing with `-32076`

### Requirement: History replacement notifies paginated Desktop transcripts

After a successful External `thread/rollback` or `codexhost/thread/redo` on a Thread whose `historyMode` is `paginated`, the Host SHALL emit `thread/reverted { threadId }` so Desktop re-reads the transcript the same way it does after the official Revert path. Legacy-history Threads SHALL NOT receive the notification; their transcript updates from the response.

#### Scenario: Renderer-initiated rollback on a paginated Thread

- **WHEN** the injected Turn actions send `thread/rollback` for a paginated External Thread and the Host serves it
- **THEN** the Host writes the `thread/rollback` response followed by `thread/reverted { threadId }`
