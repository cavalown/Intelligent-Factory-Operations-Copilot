## ADDED Requirements

### Requirement: Accept and publish a valid TEMPERATURE_REPORTED event
The system SHALL validate an incoming event envelope and its `TEMPERATURE_REPORTED` payload against `docs/design/event-schema.md`, and SHALL publish valid events to the `machine.events` Kafka topic keyed by `machineId`.

#### Scenario: Valid event is published
- **WHEN** a client POSTs a well-formed `TEMPERATURE_REPORTED` event envelope for an existing machine to `/simulator/events`
- **THEN** the system publishes the event to the `machine.events` topic keyed by `machineId` and responds `202 Accepted` with `{ eventId, status: "PUBLISHED" }`

### Requirement: Reject an invalid envelope
The system SHALL reject a request whose envelope is missing a required field, without publishing to Kafka.

#### Scenario: Missing required envelope field
- **WHEN** a client POSTs an event envelope missing a required field (e.g. `occurredAt`)
- **THEN** the system responds `400` with error code `INVALID_EVENT_ENVELOPE` and does not publish to Kafka

### Requirement: Reject an unknown machine
The system SHALL reject an event referencing a `machineId` that has not been pre-seeded, without publishing to Kafka.

#### Scenario: Unknown machineId
- **WHEN** a client POSTs a valid event envelope for a `machineId` that does not exist in the `machines` collection
- **THEN** the system responds `404` with error code `UNKNOWN_MACHINE` and does not publish to Kafka

### Requirement: Reject an unsupported event type
The system SHALL reject any `eventType` other than `TEMPERATURE_REPORTED`, without publishing to Kafka. Support for the remaining MVP event types is added by a follow-up change.

#### Scenario: Unsupported event type
- **WHEN** a client POSTs an event envelope with `eventType` other than `TEMPERATURE_REPORTED`
- **THEN** the system responds `422` with error code `UNSUPPORTED_EVENT_TYPE` and does not publish to Kafka

### Requirement: Reject a payload that fails schema validation
The system SHALL reject a `TEMPERATURE_REPORTED` event whose payload does not match the required schema (`temperature`, `unit`), without publishing to Kafka.

#### Scenario: Invalid payload
- **WHEN** a client POSTs a `TEMPERATURE_REPORTED` event whose payload is missing `temperature` or `unit`
- **THEN** the system responds `422` with error code `PAYLOAD_VALIDATION_FAILED` and does not publish to Kafka
