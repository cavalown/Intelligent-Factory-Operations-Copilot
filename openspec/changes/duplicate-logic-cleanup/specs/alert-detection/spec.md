## ADDED Requirements

### Requirement: Unrecognized event types do not create an alert
The system SHALL NOT create an alert when consuming an event whose `eventType` is not one of the 5 known MVP event types, and SHALL log the skip.

#### Scenario: Unknown event type produces no alert
- **WHEN** Alert Service consumes an event whose `eventType` does not match any of `STATUS_CHANGED`, `TEMPERATURE_REPORTED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`
- **THEN** no alert document is created, and the event is logged as skipped
