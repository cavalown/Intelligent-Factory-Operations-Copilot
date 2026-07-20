# alert-detection Specification

## Purpose
TBD - created by archiving change backend-walking-skeleton. Update Purpose after archive.
## Requirements
### Requirement: Create a WARNING alert when temperature exceeds threshold
The system SHALL, upon consuming a `TEMPERATURE_REPORTED` event whose `temperatureExceedsThreshold` field is `true`, create an alert with `severity: WARNING` and `status: ACTIVE`, per the Alert Rules in `CLAUDE.md` and `docs/design/architecture.md` §9.3. Alert Service reads this classification from the event (computed once by the Rule Engine, per `openspec/changes/add-rule-engine/design.md`) rather than comparing `payload.temperature` to the machine's `temperatureThreshold` itself.

#### Scenario: Alert created for over-threshold temperature
- **WHEN** Alert Service consumes a `TEMPERATURE_REPORTED` event for `M-001` with `temperatureExceedsThreshold: true`
- **THEN** an alert document is created with `machineId: M-001`, `eventId` matching the source event, `severity: WARNING`, `status: ACTIVE`, and a human-readable `message`

### Requirement: No alert when within threshold
The system SHALL NOT create an alert for a `TEMPERATURE_REPORTED` event whose `temperatureExceedsThreshold` field is `false` or absent.

#### Scenario: No alert for normal-range temperature
- **WHEN** Alert Service consumes a `TEMPERATURE_REPORTED` event with `temperatureExceedsThreshold: false`
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

### Requirement: Create a CRITICAL alert on ERROR_OCCURRED
The system SHALL, upon consuming an `ERROR_OCCURRED` event, create an alert with `severity: CRITICAL` and `status: ACTIVE`, regardless of `payload.recoverable`.

#### Scenario: Alert created for error event
- **WHEN** Alert Service consumes an `ERROR_OCCURRED` event for `M-002`
- **THEN** an alert document is created with `machineId: M-002`, `eventId` matching the source event, `severity: CRITICAL`, `status: ACTIVE`, and a human-readable `message`

### Requirement: Create a WARNING alert on MAINTENANCE_REQUIRED
The system SHALL, upon consuming a `MAINTENANCE_REQUIRED` event, create an alert with `severity: WARNING` and `status: ACTIVE`.

#### Scenario: Alert created for maintenance event
- **WHEN** Alert Service consumes a `MAINTENANCE_REQUIRED` event for a machine
- **THEN** an alert document is created with `severity: WARNING`, `status: ACTIVE`, and a human-readable `message`

### Requirement: Conditionally create a WARNING alert on STATUS_CHANGED
The system SHALL create an alert with `severity: WARNING` and `status: ACTIVE` when consuming a `STATUS_CHANGED` event whose `isSensorFailure` field is `true`, and SHALL NOT create an alert when `isSensorFailure` is `false`. Alert Service reads this classification from the event (computed once by the Rule Engine, per `openspec/changes/add-rule-engine/design.md`) rather than inspecting `payload.currentStatus` itself.

#### Scenario: Alert created when STATUS_CHANGED is classified as sensor failure
- **WHEN** Alert Service consumes a `STATUS_CHANGED` event with `isSensorFailure: true`
- **THEN** an alert document is created with `severity: WARNING` and `status: ACTIVE`

#### Scenario: No alert for a STATUS_CHANGED not classified as sensor failure
- **WHEN** Alert Service consumes a `STATUS_CHANGED` event with `isSensorFailure: false`
- **THEN** no alert document is created

### Requirement: No alert on PRODUCTION_COMPLETED
The system SHALL NOT create an alert when consuming a `PRODUCTION_COMPLETED` event.

#### Scenario: No alert for production completion
- **WHEN** Alert Service consumes a `PRODUCTION_COMPLETED` event
- **THEN** no alert document is created

### Requirement: TEMPERATURE_REPORTED with invalid temperature does not create a malformed alert
The system SHALL NOT create an alert when a `TEMPERATURE_REPORTED` event's `payload.temperature` is missing or not a finite number.

#### Scenario: Missing temperature does not create an alert
- **WHEN** Alert Service consumes a `TEMPERATURE_REPORTED` event whose `payload.temperature` is missing or not a finite number
- **THEN** no alert document is created, and the event is logged as skipped

### Requirement: Unrecognized event types do not create an alert
The system SHALL NOT create an alert when consuming an event whose `eventType` is not one of the 5 known MVP event types, and SHALL log the skip.

#### Scenario: Unknown event type produces no alert
- **WHEN** Alert Service consumes an event whose `eventType` does not match any of `STATUS_CHANGED`, `TEMPERATURE_REPORTED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`
- **THEN** no alert document is created, and the event is logged as skipped

### Requirement: Alerts are queryable across machines
The system SHALL expose `GET /alerts`, optionally filtered by `status` and bounded by `limit` (default 20, server-capped), returning alerts across all machines most-recent-first in the same item shape as `GET /machines/:id/alerts`.

#### Scenario: Active alerts across the factory
- **WHEN** a client GETs `/alerts?status=ACTIVE`
- **THEN** ACTIVE alerts from all machines are returned most-recent-first, each with `alertId`, `machineId`, `eventId`, `severity`, `status`, `message`, `createdAt`

#### Scenario: Limit is applied and capped
- **WHEN** a client GETs `/alerts?limit=5`
- **THEN** at most 5 alerts are returned; requesting a limit above the server cap returns at most the cap

### Requirement: The status filter is validated against the alert-status domain

The system SHALL reject a `status` query value (on `GET /alerts` and `GET /machines/:id/alerts`) containing any comma-separated segment that is not a member of the alert-status set (`ACTIVE`, `ACKNOWLEDGED`, `RESOLVED`), responding `400` with error code `INVALID_QUERY_PARAMETER`, validating each segment's membership against the same constant the schema uses.

#### Scenario: Out-of-domain status rejected
- **WHEN** a client GETs `/alerts?status=foo` (or `?status=active`, wrong case)
- **THEN** the system responds `400` with error code `INVALID_QUERY_PARAMETER` instead of silently returning an empty list

#### Scenario: One invalid segment in a multi-value list rejects the whole request
- **WHEN** a client GETs `/alerts?status=ACTIVE,foo`
- **THEN** the system responds `400` with error code `INVALID_QUERY_PARAMETER`
