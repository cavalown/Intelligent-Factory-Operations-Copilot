# dashboard-stats Specification

## Purpose
Serve the factory-wide aggregate behind the Dashboard's stat tiles — machine counts per status, production totals, and average health — computed from the `machines` projection and exposed as one read (`GET /dashboard/stats`), so the aggregate lives behind the API instead of client-side arithmetic. Introduced by change `add-frontend-mvp` (2026-07-11).

## Requirements

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

### Requirement: Stats include rolling-24h operational aggregates
The `GET /dashboard/stats` response SHALL additionally contain a `last24h` object with `productionCount` (sum of `PRODUCTION_COMPLETED` `payload.quantity` for events with `occurredAt` in `[now − 24h, now]`) and factory-wide `operatingMs` / `stoppedMs` / `idleMs` (sums of the per-machine utilization buckets). The addition SHALL be backward-compatible: all previously specified fields remain unchanged.

#### Scenario: 24h production counted from events
- **WHEN** two `PRODUCTION_COMPLETED` events with quantities 3 and 4 occurred within the last 24h and older ones exist outside the window
- **THEN** `last24h.productionCount` is `7`

#### Scenario: Factory utilization sums the machines
- **WHEN** per-machine 24h utilization is known for every machine
- **THEN** `last24h.operatingMs`/`stoppedMs`/`idleMs` equal the sums across machines

#### Scenario: Empty factory
- **WHEN** no machines exist
- **THEN** `last24h` reports zeros for all four fields
