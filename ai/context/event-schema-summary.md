# Event Schema (Summary)

All machine events share this envelope (see `docs/design/event-schema.md` for full payload schemas):

```json
{
  "eventId": "evt_...",
  "eventType": "TEMPERATURE_REPORTED",
  "schemaVersion": 1,
  "source": "MACHINE_SIMULATOR",
  "machineId": "M-001",
  "occurredAt": "2026-07-02T10:30:00.000Z",
  "producedAt": "2026-07-02T10:30:01.000Z",
  "correlationId": "corr_...",
  "payload": { ... }
}
```

MVP event types: `STATUS_CHANGED`, `TEMPERATURE_REPORTED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`.

Topic naming convention: `<domain>.<event-stream>` in lowercase dot notation (e.g. `machine.events`).
