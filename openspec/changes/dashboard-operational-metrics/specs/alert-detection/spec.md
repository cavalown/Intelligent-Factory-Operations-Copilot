# alert-detection Specification (delta)

## ADDED Requirements

### Requirement: Alerts are queryable across machines
The system SHALL expose `GET /alerts`, optionally filtered by `status` and bounded by `limit` (default 20, server-capped), returning alerts across all machines most-recent-first in the same item shape as `GET /machines/:id/alerts`.

#### Scenario: Active alerts across the factory
- **WHEN** a client GETs `/alerts?status=ACTIVE`
- **THEN** ACTIVE alerts from all machines are returned most-recent-first, each with `alertId`, `machineId`, `eventId`, `severity`, `status`, `message`, `createdAt`

#### Scenario: Limit is applied and capped
- **WHEN** a client GETs `/alerts?limit=5`
- **THEN** at most 5 alerts are returned; requesting a limit above the server cap returns at most the cap

### Requirement: The status filter is validated against the alert-status domain
The system SHALL reject a `status` query value (on `GET /alerts` and `GET /machines/:id/alerts`) that is not a member of the alert-status set (`ACTIVE`, `RESOLVED`), responding `400` with error code `INVALID_QUERY_PARAMETER`, validating membership against the same constant the schema uses.

#### Scenario: Out-of-domain status rejected
- **WHEN** a client GETs `/alerts?status=foo` (or `?status=active`, wrong case)
- **THEN** the system responds `400` with error code `INVALID_QUERY_PARAMETER` instead of silently returning an empty list
