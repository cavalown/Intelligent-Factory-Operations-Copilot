## MODIFIED Requirements

### Requirement: Persist consumed events immutably
The system SHALL consume events of any MVP event type (`STATUS_CHANGED`, `TEMPERATURE_REPORTED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`) from the `machine.events` Kafka topic and persist each as an immutable document in the `machine_events` collection, preserving the full event envelope unchanged.

#### Scenario: Event persisted on consumption
- **WHEN** Event Service consumes a `TEMPERATURE_REPORTED` event from `machine.events`
- **THEN** it stores a document in `machine_events` containing all envelope fields (`eventId`, `eventType`, `schemaVersion`, `source`, `machineId`, `occurredAt`, `producedAt`, `correlationId`, `payload`) unchanged

#### Scenario: Non-temperature event types are persisted identically
- **WHEN** Event Service consumes a `STATUS_CHANGED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, or `PRODUCTION_COMPLETED` event from `machine.events`
- **THEN** it stores a document in `machine_events` containing all envelope fields unchanged, using the same persistence logic as `TEMPERATURE_REPORTED`
