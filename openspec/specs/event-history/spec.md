# event-history Specification

## Purpose
TBD - created by archiving change backend-walking-skeleton. Update Purpose after archive.
## Requirements
### Requirement: Persist consumed events immutably
The system SHALL consume events of any MVP event type (`STATUS_CHANGED`, `TEMPERATURE_REPORTED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`) from the `machine.events` Kafka topic and persist each as an immutable document in the `machine_events` collection, preserving the full event envelope unchanged.

#### Scenario: Event persisted on consumption
- **WHEN** Event Service consumes a `TEMPERATURE_REPORTED` event from `machine.events`
- **THEN** it stores a document in `machine_events` containing all envelope fields (`eventId`, `eventType`, `schemaVersion`, `source`, `machineId`, `occurredAt`, `producedAt`, `correlationId`, `payload`) unchanged

#### Scenario: Non-temperature event types are persisted identically
- **WHEN** Event Service consumes a `STATUS_CHANGED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, or `PRODUCTION_COMPLETED` event from `machine.events`
- **THEN** it stores a document in `machine_events` containing all envelope fields unchanged, using the same persistence logic as `TEMPERATURE_REPORTED`

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

### Requirement: Event history is queryable across all machines
The system SHALL expose `GET /events`, returning events across all machines most-recent-first with cursor-based pagination (`limit`, `before`), optionally filtered by `machineId` and/or `eventType`, using the same response envelope as `GET /machines/:id/events`.

#### Scenario: Query recent events across all machines
- **WHEN** a client GETs `/events` with no query parameters
- **THEN** the system returns up to the default limit of events across all machines, ordered most-recent-first, with pagination metadata (`nextCursor`, `hasMore`)

#### Scenario: Filter by machineId
- **WHEN** a client GETs `/events?machineId=M-001`
- **THEN** the system returns only `M-001`'s events, in the same shape as `GET /machines/M-001/events`

#### Scenario: Filter by eventType across machines
- **WHEN** a client GETs `/events?eventType=ERROR_OCCURRED`
- **THEN** the system returns only `ERROR_OCCURRED` events across all machines, most-recent-first

#### Scenario: Unknown machineId filter returns 404
- **WHEN** a client GETs `/events?machineId=M-999` for a `machineId` that does not exist
- **THEN** the system responds `404` with error code `MACHINE_NOT_FOUND`

### Requirement: An explicit limit=0 is honored, not silently defaulted
The system SHALL treat an explicitly-supplied `limit=0` as `0` (then clamped to the existing minimum of `1`), not as "no limit provided" (which would otherwise fall back to the default of `20`), on both `GET /machines/:id/events` and `GET /events`.

#### Scenario: limit=0 is clamped to the minimum, not defaulted
- **WHEN** a client GETs `/events?limit=0` or `/machines/:id/events?limit=0`
- **THEN** the system returns at most 1 event (the clamped minimum), not the default of 20

