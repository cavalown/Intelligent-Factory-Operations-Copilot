# alert-lifecycle Specification

## Purpose
TBD - created by syncing change add-alert-lifecycle. Update Purpose after archive.

## Requirements

### Requirement: Acknowledge an ACTIVE or ACKNOWLEDGED alert

The system SHALL expose `POST /machines/:id/alerts/:alertId/acknowledge`. When the alert's current `status` is `ACTIVE`, the system SHALL set `status: ACKNOWLEDGED` and set `acknowledgedAt` to the current time. When the alert's current `status` is already `ACKNOWLEDGED`, the system SHALL leave the alert unchanged and return it as-is (idempotent no-op). Either case SHALL respond `200` with the full updated alert.

#### Scenario: Acknowledging an ACTIVE alert
- **WHEN** a client POSTs `/machines/M-001/alerts/:alertId/acknowledge` for an alert with `status: ACTIVE`
- **THEN** the system responds `200` with the alert now showing `status: ACKNOWLEDGED` and a non-null `acknowledgedAt`

#### Scenario: Re-acknowledging an already-ACKNOWLEDGED alert is a no-op
- **WHEN** a client POSTs `.../acknowledge` for an alert with `status: ACKNOWLEDGED`
- **THEN** the system responds `200` with the alert unchanged, including its original `acknowledgedAt`

### Requirement: Resolve an ACTIVE, ACKNOWLEDGED, or RESOLVED alert

The system SHALL expose `POST /machines/:id/alerts/:alertId/resolve`. When the alert's current `status` is `ACTIVE` or `ACKNOWLEDGED`, the system SHALL set `status: RESOLVED` and set `resolvedAt` to the current time, leaving `acknowledgedAt` unchanged (`null` if the alert was never acknowledged). When the alert's current `status` is already `RESOLVED`, the system SHALL leave the alert unchanged and return it as-is (idempotent no-op). All cases SHALL respond `200` with the full updated alert.

#### Scenario: Resolving an ACTIVE alert directly (skipping acknowledgment)
- **WHEN** a client POSTs `/machines/M-001/alerts/:alertId/resolve` for an alert with `status: ACTIVE`
- **THEN** the system responds `200` with the alert now showing `status: RESOLVED`, a non-null `resolvedAt`, and `acknowledgedAt: null`

#### Scenario: Resolving an ACKNOWLEDGED alert
- **WHEN** a client POSTs `.../resolve` for an alert with `status: ACKNOWLEDGED` and a non-null `acknowledgedAt`
- **THEN** the system responds `200` with `status: RESOLVED`, a non-null `resolvedAt`, and the original `acknowledgedAt` unchanged

#### Scenario: Re-resolving an already-RESOLVED alert is a no-op
- **WHEN** a client POSTs `.../resolve` for an alert with `status: RESOLVED`
- **THEN** the system responds `200` with the alert unchanged, including its original `resolvedAt`

### Requirement: A RESOLVED alert cannot be acknowledged

The system SHALL reject an `acknowledge` request for an alert whose current `status` is `RESOLVED`, responding `409` with error code `INVALID_ALERT_TRANSITION`, and SHALL NOT modify the alert.

#### Scenario: Acknowledging a RESOLVED alert is rejected
- **WHEN** a client POSTs `.../acknowledge` for an alert with `status: RESOLVED`
- **THEN** the system responds `409` with error code `INVALID_ALERT_TRANSITION`, and the alert's `status` remains `RESOLVED`

### Requirement: Both actions validate the machine and alert exist together

The system SHALL respond `404` with error code `MACHINE_NOT_FOUND` if the `:id` path parameter does not match an existing machine. Given a valid machine, the system SHALL respond `404` with error code `ALERT_NOT_FOUND` if `:alertId` does not match an alert belonging to that machine (including when `:alertId` is valid but belongs to a *different* machine).

#### Scenario: Unknown machine
- **WHEN** a client POSTs `/machines/M-999/alerts/:alertId/acknowledge` (or `/resolve`) for a `machineId` that doesn't exist
- **THEN** the system responds `404` with error code `MACHINE_NOT_FOUND`

#### Scenario: Alert ID belongs to a different machine
- **WHEN** a client POSTs `/machines/M-002/alerts/:alertId/acknowledge` where `:alertId` exists but belongs to `M-001`
- **THEN** the system responds `404` with error code `ALERT_NOT_FOUND`

### Requirement: Acknowledged and unresolved alerts are queryable together

The system SHALL accept a comma-separated list of values in the `status` query parameter on `GET /alerts` and `GET /machines/:id/alerts` (e.g. `status=ACTIVE,ACKNOWLEDGED`), returning alerts whose `status` matches any listed value, most-recent-first. A single value (e.g. `status=ACTIVE`) SHALL continue to behave exactly as before this change.

#### Scenario: Multi-status filter returns alerts in any listed status
- **WHEN** a client GETs `/alerts?status=ACTIVE,ACKNOWLEDGED`
- **THEN** the system returns alerts whose `status` is `ACTIVE` or `ACKNOWLEDGED`, most-recent-first, excluding `RESOLVED` alerts

#### Scenario: Single-value status filter is unchanged
- **WHEN** a client GETs `/alerts?status=ACTIVE`
- **THEN** the system returns only `ACTIVE` alerts, exactly as before this change
