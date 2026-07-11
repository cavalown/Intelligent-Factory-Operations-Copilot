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
