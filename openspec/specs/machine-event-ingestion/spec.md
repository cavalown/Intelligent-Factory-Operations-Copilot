# machine-event-ingestion Specification

## Purpose
TBD - created by archiving change backend-walking-skeleton. Update Purpose after archive.
## Requirements
### Requirement: Accept and publish a valid TEMPERATURE_REPORTED event
The system SHALL validate an incoming event envelope and its `TEMPERATURE_REPORTED` payload against `docs/design/event-schema.md`, and SHALL publish valid events to the `machine.events` Kafka topic keyed by `machineId`.

#### Scenario: Valid event is published
- **WHEN** a client POSTs a well-formed `TEMPERATURE_REPORTED` event envelope for an existing machine to `/simulator/events`
- **THEN** the system publishes the event to the `machine.events` topic keyed by `machineId` and responds `202 Accepted` with `{ eventId, status: "PUBLISHED" }`

### Requirement: Reject an invalid envelope
The system SHALL reject a request whose envelope is missing a required field, or whose `schemaVersion` field is not a number, without publishing to Kafka.

#### Scenario: Missing required envelope field
- **WHEN** a client POSTs an event envelope missing a required field (e.g. `occurredAt`)
- **THEN** the system responds `400` with error code `INVALID_EVENT_ENVELOPE` and does not publish to Kafka

#### Scenario: Non-numeric schemaVersion
- **WHEN** a client POSTs an event envelope whose `schemaVersion` is not a number (e.g. a string)
- **THEN** the system responds `400` with error code `INVALID_EVENT_ENVELOPE` and does not publish to Kafka

### Requirement: Reject an unknown machine
The system SHALL reject an event referencing a `machineId` that has not been pre-seeded, without publishing to Kafka.

#### Scenario: Unknown machineId
- **WHEN** a client POSTs a valid event envelope for a `machineId` that does not exist in the `machines` collection
- **THEN** the system responds `404` with error code `UNKNOWN_MACHINE` and does not publish to Kafka

### Requirement: Reject an unsupported event type
The system SHALL reject any `eventType` outside the 5 MVP event types (`STATUS_CHANGED`, `TEMPERATURE_REPORTED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`), without publishing to Kafka.

#### Scenario: Unsupported event type
- **WHEN** a client POSTs an event envelope with `eventType` outside the 5 MVP event types
- **THEN** the system responds `422` with error code `UNSUPPORTED_EVENT_TYPE` and does not publish to Kafka

### Requirement: Reject a payload that fails schema validation
The system SHALL reject any event whose payload does not match the required schema for its `eventType`, per `docs/design/event-schema.md` §9.2 (`STATUS_CHANGED` requires `currentStatus` to be one of the 5 allowed machine statuses; `TEMPERATURE_REPORTED` requires `temperature`, `unit`; `ERROR_OCCURRED` requires `errorCode`, `errorMessage`; `MAINTENANCE_REQUIRED` requires `maintenanceType`, `reason`; `PRODUCTION_COMPLETED` requires `quantity`), without publishing to Kafka.

#### Scenario: Invalid TEMPERATURE_REPORTED payload
- **WHEN** a client POSTs a `TEMPERATURE_REPORTED` event whose payload is missing `temperature` or `unit`
- **THEN** the system responds `422` with error code `PAYLOAD_VALIDATION_FAILED` and does not publish to Kafka

#### Scenario: Invalid STATUS_CHANGED payload — missing field
- **WHEN** a client POSTs a `STATUS_CHANGED` event whose payload is missing `currentStatus`
- **THEN** the system responds `422` with error code `PAYLOAD_VALIDATION_FAILED` and does not publish to Kafka

#### Scenario: Invalid STATUS_CHANGED payload — unrecognized status
- **WHEN** a client POSTs a `STATUS_CHANGED` event whose `payload.currentStatus` is a string but not one of `RUNNING`, `IDLE`, `WARNING`, `ERROR`, `MAINTENANCE`
- **THEN** the system responds `422` with error code `PAYLOAD_VALIDATION_FAILED` and does not publish to Kafka

#### Scenario: Invalid ERROR_OCCURRED payload
- **WHEN** a client POSTs an `ERROR_OCCURRED` event whose payload is missing `errorCode` or `errorMessage`
- **THEN** the system responds `422` with error code `PAYLOAD_VALIDATION_FAILED` and does not publish to Kafka

#### Scenario: Invalid MAINTENANCE_REQUIRED payload
- **WHEN** a client POSTs a `MAINTENANCE_REQUIRED` event whose payload is missing `maintenanceType` or `reason`
- **THEN** the system responds `422` with error code `PAYLOAD_VALIDATION_FAILED` and does not publish to Kafka

#### Scenario: Invalid PRODUCTION_COMPLETED payload
- **WHEN** a client POSTs a `PRODUCTION_COMPLETED` event whose payload is missing `quantity`
- **THEN** the system responds `422` with error code `PAYLOAD_VALIDATION_FAILED` and does not publish to Kafka

### Requirement: Accept and publish a valid STATUS_CHANGED event
The system SHALL validate an incoming event envelope and its `STATUS_CHANGED` payload against `docs/design/event-schema.md`, and SHALL publish valid events to the `machine.events` Kafka topic keyed by `machineId`.

#### Scenario: Valid event is published
- **WHEN** a client POSTs a well-formed `STATUS_CHANGED` event envelope for an existing machine to `/simulator/events`
- **THEN** the system publishes the event to the `machine.events` topic keyed by `machineId` and responds `202 Accepted` with `{ eventId, status: "PUBLISHED" }`

### Requirement: Accept and publish a valid ERROR_OCCURRED event
The system SHALL validate an incoming event envelope and its `ERROR_OCCURRED` payload against `docs/design/event-schema.md`, and SHALL publish valid events to the `machine.events` Kafka topic keyed by `machineId`.

#### Scenario: Valid event is published
- **WHEN** a client POSTs a well-formed `ERROR_OCCURRED` event envelope for an existing machine to `/simulator/events`
- **THEN** the system publishes the event to the `machine.events` topic keyed by `machineId` and responds `202 Accepted` with `{ eventId, status: "PUBLISHED" }`

### Requirement: Accept and publish a valid MAINTENANCE_REQUIRED event
The system SHALL validate an incoming event envelope and its `MAINTENANCE_REQUIRED` payload against `docs/design/event-schema.md`, and SHALL publish valid events to the `machine.events` Kafka topic keyed by `machineId`.

#### Scenario: Valid event is published
- **WHEN** a client POSTs a well-formed `MAINTENANCE_REQUIRED` event envelope for an existing machine to `/simulator/events`
- **THEN** the system publishes the event to the `machine.events` topic keyed by `machineId` and responds `202 Accepted` with `{ eventId, status: "PUBLISHED" }`

### Requirement: Accept and publish a valid PRODUCTION_COMPLETED event
The system SHALL validate an incoming event envelope and its `PRODUCTION_COMPLETED` payload against `docs/design/event-schema.md`, and SHALL publish valid events to the `machine.events` Kafka topic keyed by `machineId`.

#### Scenario: Valid event is published
- **WHEN** a client POSTs a well-formed `PRODUCTION_COMPLETED` event envelope for an existing machine to `/simulator/events`
- **THEN** the system publishes the event to the `machine.events` topic keyed by `machineId` and responds `202 Accepted` with `{ eventId, status: "PUBLISHED" }`

### Requirement: Event timestamps must be canonical ISO-8601 UTC
The system SHALL reject a simulator event whose `occurredAt` or `producedAt` is not a canonical ISO-8601 UTC string (`YYYY-MM-DDTHH:mm:ss.sssZ`) or does not parse to a valid instant, responding `400` with error code `INVALID_EVENT_ENVELOPE` — enforcing the timestamp convention `docs/design/api.md` §2.3 declares. Downstream consumers (window queries, transition ordering, duration arithmetic) MAY rely on lexicographic order of stored timestamps equaling chronological order.

#### Scenario: Offset-form timestamp rejected
- **WHEN** a client POSTs `/simulator/events` with `occurredAt: "2026-07-11T10:00:00+00:00"`
- **THEN** the system responds `400` with error code `INVALID_EVENT_ENVELOPE` and nothing is published to Kafka

#### Scenario: Unparseable timestamp rejected
- **WHEN** a client POSTs an event whose `occurredAt` matches the shape but is not a real instant (e.g. `"2026-13-01T00:00:00.000Z"`) or is an empty string
- **THEN** the system responds `400` with error code `INVALID_EVENT_ENVELOPE`

#### Scenario: Canonical timestamp accepted
- **WHEN** a client POSTs an event with `occurredAt`/`producedAt` in `YYYY-MM-DDTHH:mm:ss.sssZ` form
- **THEN** validation passes and the event is published as before
