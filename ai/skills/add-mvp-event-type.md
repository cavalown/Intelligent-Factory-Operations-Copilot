# Skill: Add an MVP Event Type

How to implement support for one of the 5 MVP event types (`STATUS_CHANGED`, `TEMPERATURE_REPORTED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`) once its behavior is already documented in `docs/design/event-schema.md` and `docs/design/machine-schema.md`. This skill assumes the docs are already correct — see [`workflows/adding-a-new-event-type.md`](../workflows/adding-a-new-event-type.md) for when doc updates are also needed.

## 1. Payload type (`shared/`)

Add a TypeScript type/DTO for the event's `payload` shape, matching `event-schema.md` §5. Reuse the same field names and required/optional-ness — don't paraphrase the schema.

## 2. Ingestion validation (`simulator/`)

In the `POST /simulator/events` handler:
- Add the new `eventType` to the set of accepted types (it currently returns `422 UNSUPPORTED_EVENT_TYPE` for anything not yet implemented — see `ai/rules/error-handling.md`).
- Add payload validation for the new type's required fields, returning `422 PAYLOAD_VALIDATION_FAILED` on failure, per `api.md` §4.7.

## 3. Machine State Projection (`machines/`)

In the event-processing switch (see `machine-schema.md` §7's pseudocode):
- Add a case for the new `eventType`.
- Apply its status mapping and health-score delta from `machine-schema.md` §4.3 / §5.2.
- Route the implied status change through the severity-precedence check (`machine-schema.md` §4.2) — never set `status` directly; use the same "raise, don't lower" helper the other event types use.
- Health-score deltas apply independently of whether the status change was allowed through — don't gate the health-score update on the precedence check.

## 4. Alert Detection (`alerts/`)

In the alert-evaluation switch:
- Add a case matching the new event's row in `ai/context/alert-rules.md` (severity, and the condition under which an alert is created at all — some events never create one).
- Reuse the existing idempotency pattern (unique index on `eventId`, duplicate-key-as-no-op) — don't invent a new one per event type.

## 5. Idempotency

Every consumer path above already has an established idempotency mechanism (`ai/rules/kafka-consumer-conventions.md`). Extend the existing mechanism to cover the new event type; don't add a parallel one.
