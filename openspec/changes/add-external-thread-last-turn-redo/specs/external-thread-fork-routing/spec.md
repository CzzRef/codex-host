## ADDED Requirements

### Requirement: Host-owned last-turn Redo resumes the displaced Native Session

When Desktop or Renderer requests `codexhost/thread/redo` for a mapped ready External Thread that has `historyRedo`, Host SHALL resume that Native Session through the owning Adapter, verify the Snapshot has exactly the stashed Turns, keep the Host Thread ID and stashed Host Turn IDs, atomically restore Native refs, and clear the slot. Host SHALL NOT modify project files, SHALL NOT call Adapter `open(redo)`, and SHALL NOT forward the method to Codex.

#### Scenario: Redo after distinct last-turn rollback

- **WHEN** an idle capable External Thread with two mapped Turns is rolled back by `numTurns: 1` to a distinct Native Session
- **AND** Renderer sends `codexhost/thread/redo` for that Thread before any new Turn
- **THEN** Host SHALL restore the previous Native Session and both Host Turn IDs
- **AND** a later Turn SHALL continue that restored Native Session

#### Scenario: Redo is unavailable

- **WHEN** the Thread is official/unmapped, busy, missing `historyRedo`, or the resumed Snapshot does not match the slot
- **THEN** Host SHALL reject the request explicitly
- **AND** it SHALL NOT forward `codexhost/thread/redo` to the official app-server

#### Scenario: Official Codex Redo stays native

- **WHEN** the injected Redo button runs on a Codex-owned Thread
- **THEN** Host SHALL reject `codexhost/thread/redo`
- **AND** Renderer MAY click the official Desktop Redo control as fallback
