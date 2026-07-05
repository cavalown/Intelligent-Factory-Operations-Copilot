## ADDED Requirements

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
