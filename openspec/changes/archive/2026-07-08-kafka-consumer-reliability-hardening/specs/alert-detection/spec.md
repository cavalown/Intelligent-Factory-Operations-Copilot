## ADDED Requirements

### Requirement: TEMPERATURE_REPORTED with invalid temperature does not create a malformed alert
The system SHALL NOT create an alert when a `TEMPERATURE_REPORTED` event's `payload.temperature` is missing or not a finite number.

#### Scenario: Missing temperature does not create an alert
- **WHEN** Alert Service consumes a `TEMPERATURE_REPORTED` event whose `payload.temperature` is missing or not a finite number
- **THEN** no alert document is created, and the event is logged as skipped
