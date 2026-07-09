## MODIFIED Requirements

### Requirement: Reject an invalid envelope
The system SHALL reject a request whose envelope is missing a required field, or whose `schemaVersion` field is not a number, without publishing to Kafka.

#### Scenario: Missing required envelope field
- **WHEN** a client POSTs an event envelope missing a required field (e.g. `occurredAt`)
- **THEN** the system responds `400` with error code `INVALID_EVENT_ENVELOPE` and does not publish to Kafka

#### Scenario: Non-numeric schemaVersion
- **WHEN** a client POSTs an event envelope whose `schemaVersion` is not a number (e.g. a string)
- **THEN** the system responds `400` with error code `INVALID_EVENT_ENVELOPE` and does not publish to Kafka

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
