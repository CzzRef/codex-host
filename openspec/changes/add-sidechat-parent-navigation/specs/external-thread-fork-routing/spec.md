## MODIFIED Requirements

### Requirement: Side-conversation item injection is acknowledged on external Threads

Codex Desktop opens a side chat as an ephemeral `thread/fork` followed by `thread/inject_items` planting side-conversation boundary items into the derived Thread. For a mapped external Thread, Host SHALL validate that `items` is an array and acknowledge the injection with an empty result instead of rejecting the method. The derived Native Session already carries the same-harness parent context from the Fork, and injected Codex items have no native representation, so Host SHALL NOT project them into external history, forward them to the official app-server, or send them to the Harness. Official Codex Threads SHALL remain transparent.

The derived Thread SHALL remain bound to its source via persisted `forkSource`. Navigation, jump, and deep links for that ephemeral derived Thread SHALL target the source Thread. Host SHALL NOT present the derived Thread as a standalone projectless conversation in the sidebar. The derived Native Session SHALL still accept later Turns.

#### Scenario: Side chat opens on an external Thread

- **WHEN** Desktop Forks a mapped external Thread and sends `thread/inject_items` for the derived Thread
- **THEN** Host SHALL answer the injection with an empty success result
- **AND** the side conversation SHALL accept later Turns through the derived Native Session
- **AND** jump and sidebar navigation SHALL remain on the source Thread

#### Scenario: Projectless external Fork does not switch sidebar conversation

- **WHEN** Renderer intercepts a projectless external Fork and Host returns a derived Thread
- **THEN** Renderer SHALL NOT open the derived Thread as the current sidebar conversation
- **AND** the source Thread SHALL remain the navigation target

#### Scenario: Injection payload is malformed

- **WHEN** `thread/inject_items.items` is not an array for a mapped external Thread
- **THEN** Host SHALL reject the request with an explicit invalid-argument error

#### Scenario: Official Thread injection stays transparent

- **WHEN** `thread/inject_items.threadId` does not identify a mapped external Thread
- **THEN** the original request frame SHALL be forwarded unchanged to the official app-server
