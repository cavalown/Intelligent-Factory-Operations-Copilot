## ADDED Requirements

### Requirement: Unrecognized event types do not update the projection or mark themselves processed
The system SHALL skip updating any machine field and SHALL NOT update `lastEventId`/`lastUpdatedAt` when consuming an event whose `eventType` is not one of the 5 known MVP event types.

#### Scenario: Unknown event type is skipped without being marked processed
- **WHEN** Machine Service consumes an event whose `eventType` does not match any of `STATUS_CHANGED`, `TEMPERATURE_REPORTED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`
- **THEN** the machine document is not modified, and a later valid event with a different `eventId` is still processed normally (i.e. `lastEventId` was not advanced by the skipped event)

### Requirement: PRODUCTION_COMPLETED does not corrupt productionCount on invalid quantity
The system SHALL NOT apply `payload.quantity` to `productionCount` when `quantity` is not a finite number.

#### Scenario: Non-numeric quantity is not applied
- **WHEN** Machine Service consumes a `PRODUCTION_COMPLETED` event whose `payload.quantity` is missing or not a finite number
- **THEN** `productionCount` is left unchanged (not set to `NaN`), and the event is logged as skipped
