## MODIFIED Requirements

### Requirement: Reject an unsupported event type
The system SHALL reject any `eventType` outside the 5 MVP event types (`STATUS_CHANGED`, `TEMPERATURE_REPORTED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`), without publishing to Kafka.

#### Scenario: Unsupported event type
- **WHEN** a client POSTs an event envelope with `eventType` outside the 5 MVP event types
- **THEN** the system responds `422` with error code `UNSUPPORTED_EVENT_TYPE` and does not publish to Kafka

### Requirement: Reject a payload that fails schema validation
The system SHALL reject any event whose payload does not match the required schema for its `eventType`, per `docs/design/event-schema.md` §9.2 (`STATUS_CHANGED` requires `currentStatus`; `TEMPERATURE_REPORTED` requires `temperature`, `unit`; `ERROR_OCCURRED` requires `errorCode`, `errorMessage`; `MAINTENANCE_REQUIRED` requires `maintenanceType`, `reason`; `PRODUCTION_COMPLETED` requires `quantity`), without publishing to Kafka.

#### Scenario: Invalid TEMPERATURE_REPORTED payload
- **WHEN** a client POSTs a `TEMPERATURE_REPORTED` event whose payload is missing `temperature` or `unit`
- **THEN** the system responds `422` with error code `PAYLOAD_VALIDATION_FAILED` and does not publish to Kafka

#### Scenario: Invalid STATUS_CHANGED payload
- **WHEN** a client POSTs a `STATUS_CHANGED` event whose payload is missing `currentStatus`
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

## ADDED Requirements

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
