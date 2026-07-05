# Workflow: Adding a New MVP Event Type

End-to-end steps for adding one of the remaining MVP event types (e.g. `STATUS_CHANGED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED` — whichever hasn't been implemented yet). Docs first, then code — this project treats `docs/` as the contract (`ai/rules/documentation-sync.md`), so the behavior should be nailed down in writing before it's coded.

## 1. Confirm the behavior is actually decided

Check `docs/design/event-schema.md` §5 and `docs/design/machine-schema.md` §4.3/§5.2 for this event type. If its payload shape, status mapping, or health-score delta aren't already written down, decide them first — following the same ask-rather-than-assume approach used for the existing event types (see the extensive Q&A trail already in this project's history) — before touching any file below.

## 2. Update the design docs (if not already current)

- `docs/design/event-schema.md`: payload schema (§5.x), entry in the Event Types table (§4), validation rule (§9.2), one example event (§11).
- `docs/design/machine-schema.md`: row in the Event → Status Mapping table (§4.3) and Health Score Deltas table (§5.2).
- `docs/design/architecture.md` §9.3: row in the Alert Projection table.

## 3. Update the duplicate summary tables

This project has duplicate copies of the machine-state and alert rules tables in more than one place — that's how `architecture.md` drifted out of sync with `event-schema.md` earlier in this project's history. Update all of these together, not just one:

- `docs/product/mvp.md` — Supported Events list, Alert Rules table, Machine State Rules table.
- `ai/context/event-schema-summary.md`, `ai/context/machine-state-rules.md`, `ai/context/alert-rules.md`.

## 4. Consider `docs/design/event-flow.md`

Optional. Only add a new contrast-case section there if the new event type demonstrates something genuinely new about the system's rules (the way the existing contrast cases show "within threshold → no change" and "severity precedence blocks a downgrade"). Don't add a case that just repeats the same pattern with different numbers.

## 5. Implement the code

Follow [`skills/add-mvp-event-type.md`](../skills/add-mvp-event-type.md) for the standard pattern across ingestion, projection, and alerting.

## 6. Verify manually

Per `ai/rules/testing.md` (automated strategy not finalized yet): publish a test event via `POST /simulator/events` and confirm the resulting machine projection, alert (or deliberate absence of one), and event history all match what the docs from steps 2-3 say.

## 7. Update tracking

If this event type was scoped as a task in an `openspec/changes/*/tasks.md` (e.g. the follow-up to `backend-walking-skeleton` that covers the remaining 4 event types), check it off there. If it's being done as its own proposal, create a new OpenSpec change instead of freeform work.
