# machine-state-projection Specification

## Purpose
TBD - created by archiving change backend-walking-skeleton. Update Purpose after archive.
## Requirements
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
The system SHALL NOT lower a machine's status to a lower-severity value via `TEMPERATURE_REPORTED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, or `PRODUCTION_COMPLETED` events. The system SHALL always set `machine.status` to `payload.currentStatus` when consuming a `STATUS_CHANGED` event, regardless of the current status's severity rank — this is the only event type permitted to downgrade status, per `docs/design/machine-schema.md` §4.2.

#### Scenario: Lower-severity event does not downgrade a higher-severity status
- **WHEN** Machine Service consumes a `TEMPERATURE_REPORTED` event implying `WARNING` for a machine currently in `ERROR` status
- **THEN** the machine's `status` remains `ERROR`, but `healthScore` still decreases by 10 if `temperature` exceeds threshold

#### Scenario: STATUS_CHANGED overrides status regardless of rank
- **WHEN** Machine Service consumes a `STATUS_CHANGED` event with `payload.currentStatus: "RUNNING"` for a machine currently in `ERROR` status
- **THEN** the machine's `status` becomes `RUNNING`

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

### Requirement: Apply STATUS_CHANGED health-score rule
The system SHALL, upon consuming a `STATUS_CHANGED` event whose `payload.currentStatus` is `WARNING`, decrease `healthScore` by 15, clamped to `[0, 100]`. Per this change's design decision, any `STATUS_CHANGED` event that sets `currentStatus` to `WARNING` is treated as the "sensor failure" case referenced in `docs/design/machine-schema.md` §7, with no inspection of `payload.reason` text. Any other `currentStatus` value results in no health-score change from this event.

#### Scenario: STATUS_CHANGED to WARNING decreases health score
- **WHEN** Machine Service consumes a `STATUS_CHANGED` event with `payload.currentStatus: "WARNING"`
- **THEN** the machine's `healthScore` decreases by 15 (clamped at 0)

#### Scenario: STATUS_CHANGED to a non-WARNING status leaves health score unchanged
- **WHEN** Machine Service consumes a `STATUS_CHANGED` event with `payload.currentStatus: "RUNNING"`
- **THEN** the machine's `healthScore` is unchanged by this event

### Requirement: Update projection on ERROR_OCCURRED
The system SHALL, upon consuming an `ERROR_OCCURRED` event, raise the machine's `status` to `ERROR` (subject to severity precedence) and decrease `healthScore` by 30, clamped to `[0, 100]`.

#### Scenario: Error event raises status and lowers health score
- **WHEN** Machine Service consumes an `ERROR_OCCURRED` event for a machine currently at or below `ERROR` severity rank
- **THEN** the machine's `status` becomes `ERROR`, `healthScore` decreases by 30 (clamped at 0), and `lastEventId`/`lastUpdatedAt` are updated

### Requirement: Update projection on MAINTENANCE_REQUIRED
The system SHALL, upon consuming a `MAINTENANCE_REQUIRED` event, raise the machine's `status` to `MAINTENANCE` (subject to severity precedence) and decrease `healthScore` by 20, clamped to `[0, 100]`.

#### Scenario: Maintenance event raises status and lowers health score
- **WHEN** Machine Service consumes a `MAINTENANCE_REQUIRED` event for a machine currently at or below `MAINTENANCE` severity rank
- **THEN** the machine's `status` becomes `MAINTENANCE`, `healthScore` decreases by 20 (clamped at 0), and `lastEventId`/`lastUpdatedAt` are updated

### Requirement: Update projection on PRODUCTION_COMPLETED
The system SHALL, upon consuming a `PRODUCTION_COMPLETED` event, raise the machine's `status` to `RUNNING` (subject to severity precedence), increase `healthScore` by 2 (clamped to `[0, 100]`), and increase `productionCount` by `payload.quantity`.

#### Scenario: Production event updates count, status, and health score
- **WHEN** Machine Service consumes a `PRODUCTION_COMPLETED` event with `payload.quantity: 5` for a machine currently in `RUNNING` or `IDLE` status
- **THEN** the machine's `status` becomes `RUNNING`, `healthScore` increases by 2 (clamped at 100), `productionCount` increases by 5, and `lastEventId`/`lastUpdatedAt` are updated

#### Scenario: Production event does not downgrade a higher-severity status
- **WHEN** Machine Service consumes a `PRODUCTION_COMPLETED` event for a machine currently in `ERROR` status
- **THEN** the machine's `status` remains `ERROR`, but `healthScore` still increases by 2 and `productionCount` still increases by `payload.quantity`

### Requirement: Unrecognized event types do not update the projection or mark themselves processed
The system SHALL skip updating any machine field and SHALL NOT update `lastEventId`/`lastUpdatedAt` when consuming an event whose `eventType` is not one of the 5 known MVP event types.

#### Scenario: Unknown event type is skipped without being marked processed
- **WHEN** Machine Service consumes an event whose `eventType` does not match any of `STATUS_CHANGED`, `TEMPERATURE_REPORTED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`
- **THEN** the machine document is not modified, and a later valid event with a different `eventId` is still processed normally (i.e. `lastEventId` was not advanced by the skipped event)

### Requirement: PRODUCTION_COMPLETED does not corrupt productionCount on invalid quantity
The system SHALL NOT apply `payload.quantity` to `productionCount` when `quantity` is not a finite number.

#### Scenario: Non-numeric quantity is not applied
- **WHEN** Machine Service consumes a `PRODUCTION_COMPLETED` event whose `payload.quantity` is missing or not a finite number
- **THEN** `productionCount` is left unchanged (not set to `NaN`), and the event is logged as skipped

