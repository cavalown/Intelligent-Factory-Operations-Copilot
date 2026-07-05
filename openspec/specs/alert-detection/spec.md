# alert-detection Specification

## Purpose
TBD - created by archiving change backend-walking-skeleton. Update Purpose after archive.
## Requirements
### Requirement: Create a WARNING alert when temperature exceeds threshold
The system SHALL, upon consuming a `TEMPERATURE_REPORTED` event whose `payload.temperature` exceeds the machine's `temperatureThreshold`, create an alert with `severity: WARNING` and `status: ACTIVE`, per the Alert Rules in `CLAUDE.md` and `docs/design/architecture.md` §9.3.

#### Scenario: Alert created for over-threshold temperature
- **WHEN** Alert Service consumes a `TEMPERATURE_REPORTED` event for `M-001` with `temperature` above `M-001`'s `temperatureThreshold`
- **THEN** an alert document is created with `machineId: M-001`, `eventId` matching the source event, `severity: WARNING`, `status: ACTIVE`, and a human-readable `message`

### Requirement: No alert when within threshold
The system SHALL NOT create an alert for a `TEMPERATURE_REPORTED` event within threshold.

#### Scenario: No alert for normal-range temperature
- **WHEN** Alert Service consumes a `TEMPERATURE_REPORTED` event with `temperature` at or below the machine's `temperatureThreshold`
- **THEN** no alert document is created

### Requirement: Idempotent on duplicate eventId
The system SHALL NOT create a second alert for an `eventId` that has already produced one.

#### Scenario: Duplicate event does not create a duplicate alert
- **WHEN** Alert Service consumes an event whose `eventId` already has a corresponding alert in the `alerts` collection
- **THEN** no second alert is created

### Requirement: Alerts are queryable per machine
The system SHALL expose `GET /machines/:id/alerts`, optionally filtered by `status`, per `docs/design/api.md` §4.4.

#### Scenario: Query alerts for a machine
- **WHEN** a client GETs `/machines/M-001/alerts`
- **THEN** the system returns all alerts for `M-001`, most-recent-first

#### Scenario: Filter by status
- **WHEN** a client GETs `/machines/M-001/alerts?status=ACTIVE`
- **THEN** only alerts with `status: ACTIVE` are returned

#### Scenario: Unknown machine returns 404
- **WHEN** a client GETs `/machines/:id/alerts` for a `machineId` that does not exist
- **THEN** the system responds `404` with error code `MACHINE_NOT_FOUND`

