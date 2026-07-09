## ADDED Requirements

### Requirement: TEMPERATURE_REPORTED does not corrupt currentTemperature on invalid temperature
The system SHALL NOT apply `payload.temperature` to `currentTemperature`, `status`, or `healthScore` when `temperature` is not a finite number.

#### Scenario: Non-finite temperature is not applied
- **WHEN** Machine Service consumes a `TEMPERATURE_REPORTED` event whose `payload.temperature` is missing or not a finite number
- **THEN** `currentTemperature`, `status`, and `healthScore` are left unchanged, and the event is logged as skipped
