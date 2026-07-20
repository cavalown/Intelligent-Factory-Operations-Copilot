# rule-engine Specification

## Purpose
TBD - created by syncing change add-rule-engine. Update Purpose after archive.

## Requirements

### Requirement: Every consumed event is republished to the enriched topic

The system SHALL, for every event consumed from `machine.events`, republish it to `machine.events.enriched` keyed by the same `machineId`, preserving every original envelope field (including `eventId`) unchanged, so downstream consumers relying on per-machine ordering and `eventId`-keyed idempotency see the same guarantees they had consuming `machine.events` directly.

#### Scenario: Event is republished with identity preserved
- **WHEN** Rule Engine consumes an event with `eventId: "evt_001"` for `machineId: "M-001"`
- **THEN** an event with `eventId: "evt_001"` is published to `machine.events.enriched`, keyed by `M-001`, with every original field unchanged

#### Scenario: Per-machine ordering is preserved end to end
- **WHEN** Rule Engine consumes two events for the same `machineId` in a given order
- **THEN** the corresponding enriched events are published to `machine.events.enriched` in the same relative order, keyed by the same `machineId`

### Requirement: Temperature-exceeds-threshold classification

The system SHALL, when republishing a `TEMPERATURE_REPORTED` event, add a `temperatureExceedsThreshold: boolean` field set to whether `payload.temperature` exceeds the machine's current `temperatureThreshold`, per `docs/design/machine-schema.md` §5.4's known duplicated conditional.

#### Scenario: Over-threshold temperature is classified true
- **WHEN** Rule Engine consumes a `TEMPERATURE_REPORTED` event for `M-001` with `temperature` above `M-001`'s `temperatureThreshold`
- **THEN** the republished event carries `temperatureExceedsThreshold: true`

#### Scenario: Within-threshold temperature is classified false
- **WHEN** Rule Engine consumes a `TEMPERATURE_REPORTED` event with `temperature` at or below the machine's `temperatureThreshold`
- **THEN** the republished event carries `temperatureExceedsThreshold: false`

### Requirement: Sensor-failure classification

The system SHALL, when republishing a `STATUS_CHANGED` event, add an `isSensorFailure: boolean` field set to `true` when `payload.currentStatus` is `WARNING`, and `false` for any other `currentStatus` value, per this project's existing sensor-failure convention (`docs/design/machine-schema.md` §7).

#### Scenario: STATUS_CHANGED to WARNING is classified as sensor failure
- **WHEN** Rule Engine consumes a `STATUS_CHANGED` event with `payload.currentStatus: "WARNING"`
- **THEN** the republished event carries `isSensorFailure: true`

#### Scenario: STATUS_CHANGED to a non-WARNING status is not a sensor failure
- **WHEN** Rule Engine consumes a `STATUS_CHANGED` event with `payload.currentStatus: "RUNNING"`
- **THEN** the republished event carries `isSensorFailure: false`

### Requirement: Classification fields are omitted where not applicable

The system SHALL NOT add `temperatureExceedsThreshold` to any event whose `eventType` is not `TEMPERATURE_REPORTED`, and SHALL NOT add `isSensorFailure` to any event whose `eventType` is not `STATUS_CHANGED`.

#### Scenario: Unrelated event type carries neither classification field
- **WHEN** Rule Engine republishes an `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, or `PRODUCTION_COMPLETED` event
- **THEN** the republished event carries neither `temperatureExceedsThreshold` nor `isSensorFailure`

### Requirement: Unknown machine is republished unclassified, not dropped

The system SHALL still republish a `TEMPERATURE_REPORTED` event referencing a `machineId` with no corresponding machine document, omitting `temperatureExceedsThreshold` rather than dropping the event — downstream consumers already handle an unknown `machineId` as their own no-op skip.

#### Scenario: Event for unknown machine is passed through unclassified
- **WHEN** Rule Engine consumes a `TEMPERATURE_REPORTED` event for a `machineId` that has no corresponding machine document
- **THEN** the event is still republished to `machine.events.enriched` with the same `eventId`/`machineId`, without a `temperatureExceedsThreshold` field
