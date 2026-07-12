# machine-event-ingestion Specification (delta)

## ADDED Requirements

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
