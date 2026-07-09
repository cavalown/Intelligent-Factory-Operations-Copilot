## ADDED Requirements

### Requirement: An explicit limit=0 is honored, not silently defaulted
The system SHALL treat an explicitly-supplied `limit=0` as `0` (then clamped to the existing minimum of `1`), not as "no limit provided" (which would otherwise fall back to the default of `20`), on both `GET /machines/:id/events` and `GET /events`.

#### Scenario: limit=0 is clamped to the minimum, not defaulted
- **WHEN** a client GETs `/events?limit=0` or `/machines/:id/events?limit=0`
- **THEN** the system returns at most 1 event (the clamped minimum), not the default of 20
