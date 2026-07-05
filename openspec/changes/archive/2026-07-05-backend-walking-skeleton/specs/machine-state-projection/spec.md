## ADDED Requirements

### Requirement: Update projection when temperature exceeds threshold
The system SHALL, upon consuming a `TEMPERATURE_REPORTED` event whose `payload.temperature` exceeds the machine's `temperatureThreshold`, raise the machine's `status` to `WARNING` (subject to severity precedence) and decrease `healthScore` by 10, clamped to `[0, 100]`, per `docs/design/machine-schema.md` §4-§5.

#### Scenario: Temperature over threshold raises status and lowers health score
- **WHEN** Machine Service consumes a `TEMPERATURE_REPORTED` event for `M-001` with `temperature` above `M-001`'s `temperatureThreshold`, and `M-001`'s current status has severity rank at or below `WARNING`
- **THEN** `M-001`'s `status` becomes `WARNING`, `healthScore` decreases by 10 (clamped at 0), `currentTemperature` is set to the reported value, and `lastEventId`/`lastUpdatedAt` are updated

### Requirement: No status or health-score change when within threshold
The system SHALL update only `currentTemperature`, `lastEventId`, and `lastUpdatedAt` when a reported temperature is within threshold.

#### Scenario: Temperature within threshold only updates telemetry
- **WHEN** Machine Service consumes a `TEMPERATURE_REPORTED` event for a machine with `temperature` at or below its `temperatureThreshold`
- **THEN** the machine's `status` and `healthScore` remain unchanged, but `currentTemperature`, `lastEventId`, and `lastUpdatedAt` are updated

### Requirement: Severity precedence is enforced
The system SHALL NOT lower a machine's status to a lower-severity value; only `STATUS_CHANGED` events may do so (out of scope for this change).

#### Scenario: Lower-severity event does not downgrade a higher-severity status
- **WHEN** Machine Service consumes a `TEMPERATURE_REPORTED` event implying `WARNING` for a machine currently in `ERROR` status
- **THEN** the machine's `status` remains `ERROR`, but `healthScore` still decreases by 10 if `temperature` exceeds threshold

### Requirement: Idempotent on immediately-repeated eventId
The system SHALL NOT re-apply a status/health-score change for an `eventId` matching the machine's current `lastEventId`.

#### Scenario: Repeated eventId does not double-apply
- **WHEN** Machine Service consumes an event whose `eventId` matches the machine's current `lastEventId`
- **THEN** it does not reapply the status/healthScore change a second time

### Requirement: Machine state is queryable
The system SHALL expose `GET /machines` and `GET /machines/:id` returning the current machine projection, per `docs/design/api.md` §4.1-4.2.

#### Scenario: List all machines
- **WHEN** a client GETs `/machines`
- **THEN** the system returns the current projection for every seeded machine

#### Scenario: Get one machine
- **WHEN** a client GETs `/machines/M-001`
- **THEN** the system returns `M-001`'s current projection

#### Scenario: Unknown machine returns 404
- **WHEN** a client GETs `/machines/:id` for a `machineId` that does not exist
- **THEN** the system responds `404` with error code `MACHINE_NOT_FOUND`
