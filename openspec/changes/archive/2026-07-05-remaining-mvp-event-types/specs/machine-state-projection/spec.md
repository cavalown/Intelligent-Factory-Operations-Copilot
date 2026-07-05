## MODIFIED Requirements

### Requirement: Severity precedence is enforced
The system SHALL NOT lower a machine's status to a lower-severity value via `TEMPERATURE_REPORTED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, or `PRODUCTION_COMPLETED` events. The system SHALL always set `machine.status` to `payload.currentStatus` when consuming a `STATUS_CHANGED` event, regardless of the current status's severity rank — this is the only event type permitted to downgrade status, per `docs/design/machine-schema.md` §4.2.

#### Scenario: Lower-severity event does not downgrade a higher-severity status
- **WHEN** Machine Service consumes a `TEMPERATURE_REPORTED` event implying `WARNING` for a machine currently in `ERROR` status
- **THEN** the machine's `status` remains `ERROR`, but `healthScore` still decreases by 10 if `temperature` exceeds threshold

#### Scenario: STATUS_CHANGED overrides status regardless of rank
- **WHEN** Machine Service consumes a `STATUS_CHANGED` event with `payload.currentStatus: "RUNNING"` for a machine currently in `ERROR` status
- **THEN** the machine's `status` becomes `RUNNING`

## ADDED Requirements

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
