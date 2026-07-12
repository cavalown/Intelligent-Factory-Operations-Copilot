# machine-utilization Specification (delta)

## ADDED Requirements

### Requirement: Status transitions are recorded as a rebuildable projection
The system SHALL append a record `(machineId, fromStatus, toStatus, at, eventId)` to `machine_status_transitions` whenever the machines projection consumer changes a machine's projected status, SHALL NOT record anything when an event leaves the status unchanged, and SHALL be idempotent on `eventId`.

#### Scenario: Transition recorded on status change
- **WHEN** the projection consumer processes an event that moves `M-001` from `RUNNING` to `WARNING`
- **THEN** one transition record is stored with `machineId: M-001`, `fromStatus: RUNNING`, `toStatus: WARNING`, `at` equal to the event's `occurredAt`, and the triggering `eventId`

#### Scenario: No record when status is unchanged
- **WHEN** the consumer processes an event that does not change the machine's projected status (e.g. a within-threshold `TEMPERATURE_REPORTED`)
- **THEN** no transition record is created

#### Scenario: Duplicate event does not duplicate a transition
- **WHEN** the consumer processes an event whose `eventId` already has a transition record
- **THEN** no second record is created

#### Scenario: Transition write failure never blocks the primary projection
- **WHEN** the transition write fails for any reason other than a duplicate key (e.g. a validation error on a malformed field)
- **THEN** the failure is logged and the machines projection update (`machine.save()`) still proceeds — transitions are a rebuildable secondary projection and must not abort the primary one

### Requirement: Per-machine rolling-24h utilization is served over HTTP
The system SHALL expose `GET /machines/:id/utilization` returning `operatingMs` (time in `RUNNING`+`WARNING`), `stoppedMs` (`ERROR`+`MAINTENANCE`), and `idleMs` (`IDLE`) over the window `[now − 24h, now]`, computed from the transitions projection and the status in effect at window start.

#### Scenario: Utilization reflects the transition timeline
- **WHEN** `M-001` spent the last 24h partly `RUNNING`, partly `ERROR`, per its recorded transitions
- **THEN** `GET /machines/M-001/utilization` returns durations whose sum equals the window length and whose split matches the timeline

#### Scenario: No transitions in the window
- **WHEN** a machine has no transition records inside the window
- **THEN** its entire window is attributed to the status in effect at window start (falling back to the current status when no earlier transition exists)

#### Scenario: Bootstrap approximation is flagged
- **WHEN** a machine has no transition records at all (the current-status fallback was used)
- **THEN** the response carries `approximate: true`, and the dashboard aggregate carries `last24h.approximate: true` when any machine's window was approximate; fully-derived windows carry `approximate: false`

#### Scenario: Malformed transition timestamps do not poison the computation
- **WHEN** a stored transition's `at` cannot be parsed as a timestamp
- **THEN** that transition is skipped and logged, and the returned durations remain finite numbers

#### Scenario: Unknown machine returns 404
- **WHEN** a client GETs `/machines/:id/utilization` for a nonexistent `machineId`
- **THEN** the system responds `404` with error code `MACHINE_NOT_FOUND`
