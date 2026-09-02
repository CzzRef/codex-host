## ADDED Requirements

### Requirement: In-turn user message items
A HarnessSession SHALL be able to publish a `userMessage` Host Item inside a running or historical Turn. Such an item represents user input that the native Harness accepted into that Turn after it started (a steer / interjection). It SHALL carry the text the user actually sent, without Harness-added wrapper text, and SHALL keep a stable item identity across live and historical projection. The Turn's initial prompt remains the Turn input and is not duplicated as an item.

#### Scenario: Steer delivered during a running Turn
- **WHEN** the native Harness delivers a steer inside the running Turn
- **THEN** the Session SHALL emit `item.started` and `item.completed` for a `userMessage` item carrying the steer text
- **AND** SHALL NOT start a new Host Turn

#### Scenario: Steer read back from native history
- **WHEN** the Session reads a historical Turn whose native history contains a delivered steer
- **THEN** the snapshot SHALL fold that steer into the same Turn as a `userMessage` item at its delivered position
- **AND** the Turn input SHALL contain only the initial prompt text

#### Scenario: Wrapper text is stripped
- **WHEN** the native Harness persists the steer inside a wrapper template (for example Grok's `<user_query>` envelope)
- **THEN** the item text SHALL be the inner user text
- **AND** an unrecognized wrapper SHALL be preserved verbatim rather than dropped
