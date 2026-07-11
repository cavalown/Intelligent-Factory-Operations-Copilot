# dashboard-stats Specification (delta)

## ADDED Requirements

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
