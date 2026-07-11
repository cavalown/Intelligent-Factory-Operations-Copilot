# dashboard-stats Specification (delta)

## ADDED Requirements

### Requirement: Factory-wide statistics are served as one aggregate
The system SHALL expose `GET /dashboard/stats` returning machine counts per status (all five statuses always present, zero-filled), `machineCount`, `totalProductionCount`, and `averageHealthScore`, aggregated from the `machines` projection.

#### Scenario: Stats reflect current projections
- **WHEN** a client GETs `/dashboard/stats` while machines exist with mixed statuses
- **THEN** the response contains `statusCounts` with an entry for each of `RUNNING`, `IDLE`, `WARNING`, `ERROR`, `MAINTENANCE` (0 when no machine has that status), plus `machineCount`, `totalProductionCount` (sum), and `averageHealthScore` (mean)

#### Scenario: Empty machines collection
- **WHEN** a client GETs `/dashboard/stats` and no machines exist
- **THEN** the response has `machineCount: 0`, zero-filled `statusCounts`, `totalProductionCount: 0`, and `averageHealthScore: null`

#### Scenario: Stats change after an event is processed
- **WHEN** a machine's status projection changes (e.g. an over-threshold `TEMPERATURE_REPORTED` moves it to `WARNING`) and the client refetches `/dashboard/stats`
- **THEN** the returned `statusCounts` reflect the new status distribution
