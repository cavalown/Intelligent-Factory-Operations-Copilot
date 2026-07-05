## ADDED Requirements

### Requirement: Persist consumed events immutably
The system SHALL consume `TEMPERATURE_REPORTED` events from the `machine.events` Kafka topic and persist each as an immutable document in the `machine_events` collection, preserving the full event envelope unchanged.

#### Scenario: Event persisted on consumption
- **WHEN** Event Service consumes a `TEMPERATURE_REPORTED` event from `machine.events`
- **THEN** it stores a document in `machine_events` containing all envelope fields (`eventId`, `eventType`, `schemaVersion`, `source`, `machineId`, `occurredAt`, `producedAt`, `correlationId`, `payload`) unchanged

### Requirement: Idempotent on duplicate eventId
The system SHALL NOT create a duplicate `machine_events` document for an `eventId` that has already been stored.

#### Scenario: Duplicate event is ignored
- **WHEN** Event Service consumes an event whose `eventId` already exists in `machine_events`
- **THEN** it does not insert a second document and does not error the consumer

### Requirement: Event history is queryable per machine
The system SHALL expose `GET /machines/:id/events`, returning that machine's events most-recent-first with cursor-based pagination (`limit`, `before`), per `docs/design/api.md` §4.3.

#### Scenario: Query recent events
- **WHEN** a client GETs `/machines/M-001/events` with no query parameters
- **THEN** the system returns up to the default limit of events for `M-001`, ordered most-recent-first, with pagination metadata (`nextCursor`, `hasMore`)

#### Scenario: Unknown machine returns 404
- **WHEN** a client GETs `/machines/:id/events` for a `machineId` that does not exist
- **THEN** the system responds `404` with error code `MACHINE_NOT_FOUND`
