## ADDED Requirements

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
The system SHALL create an alert with `severity: WARNING` and `status: ACTIVE` when consuming a `STATUS_CHANGED` event whose `payload.currentStatus` is `WARNING`, and SHALL NOT create an alert for any other `currentStatus` value, per this change's design decision on sensor-failure detection.

#### Scenario: Alert created when STATUS_CHANGED sets WARNING
- **WHEN** Alert Service consumes a `STATUS_CHANGED` event with `payload.currentStatus: "WARNING"`
- **THEN** an alert document is created with `severity: WARNING` and `status: ACTIVE`

#### Scenario: No alert for a non-WARNING STATUS_CHANGED
- **WHEN** Alert Service consumes a `STATUS_CHANGED` event with `payload.currentStatus: "RUNNING"`
- **THEN** no alert document is created

### Requirement: No alert on PRODUCTION_COMPLETED
The system SHALL NOT create an alert when consuming a `PRODUCTION_COMPLETED` event.

#### Scenario: No alert for production completion
- **WHEN** Alert Service consumes a `PRODUCTION_COMPLETED` event
- **THEN** no alert document is created
