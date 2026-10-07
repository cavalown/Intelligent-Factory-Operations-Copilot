## Context

Machines are currently created at backend startup by an idempotent `$setOnInsert` roster. Events enter through `POST /api/simulator/events`, then three independent Kafka consumer groups build history, machine state, and alerts. Direct MongoDB event insertion would leave those derived views inconsistent, while automatic event publication at every backend startup would unexpectedly mutate developer data.

## Goals / Non-Goals

**Goals:**

- Produce a visually useful spread of machine states, health scores, temperatures, production counts, recent events, alerts, and status transitions.
- Preserve the same ingestion and projection behavior exercised by a real demo operator.
- Keep the event seed explicit, dependency-free, and safe after a complete or partial prior run.

**Non-Goals:**

- Random or continuous event generation.
- Resetting existing data or restoring machines to a canonical state.
- Adding seed-only API endpoints or writing directly to MongoDB/Kafka.
- Modeling a real factory's exact equipment inventory or telemetry distribution.

## Decisions

### D1: Expand the existing startup roster

Add five profiles to the current three-machine `DEMO_MACHINES` array. Keep `$setOnInsert` so application restarts add missing profiles but never overwrite event-derived state. This uses the established ownership boundary; a separate machine import script would duplicate registration behavior for a fixed demo roster.

### D2: Publish curated events through the Simulator API

Add `backend/scripts/seed-demo-events.mjs` and expose it as `npm run seed:demo`. It uses Node's built-in `fetch`, requires no runtime dependency, and defaults to `http://localhost:3000/api` with an environment-variable override. Going through HTTP validates envelopes and machine IDs, publishes to Kafka, and lets every consumer create its own projection.

Direct collection inserts were rejected because they would require duplicating Machine and Alert Service business rules and manually maintaining `machine_status_transitions`. Direct Kafka publishing was rejected because it would bypass the public ingestion validation and require Kafka client configuration in the host script.

### D3: Use deterministic event IDs and history-based skipping

Every curated event has a stable `eventId`. Before publishing, the script pages through `GET /events` and collects existing IDs, then posts only missing events in chronological order. Checking every ID rather than a single completion marker makes an interrupted run recoverable without replaying earlier projection effects.

### D4: Generate timestamps relative to execution time

The script assigns chronological timestamps within the recent 24-hour window when it runs. Stable IDs provide deduplication, while fresh timestamps keep rolling dashboard production and utilization metrics populated after a database reset. Existing deterministic events retain their original stored timestamps because they are skipped.

### D5: Curate states instead of randomizing them

The dataset covers all five MVP event types and intentionally leaves machines across `RUNNING`, `IDLE`, `WARNING`, `ERROR`, and `MAINTENANCE`. Fixed payloads make screenshots and demos understandable and tests deterministic; random data could produce an empty alert view or an unbalanced status distribution.

## Risks / Trade-offs

- **[Risk] Kafka consumers are asynchronous, so the dashboard may not update immediately when the command exits.** → Print a completion note explaining that consumers may need a few seconds.
- **[Risk] A rebuilt backend is required before newly added machine profiles exist in a running container.** → Validate the roster before publishing and show a clear rebuild instruction when machines are missing.
- **[Risk] Stable IDs mean re-running later does not refresh timestamps in an existing database.** → This is intentional idempotency; resetting volumes remains the explicit way to create a fresh demo timeline.
- **[Trade-off] The host-side script assumes an HTTP-accessible backend.** → The default Compose mapping satisfies this, and an API base override supports other local layouts.

## Migration Plan

1. Rebuild/restart the backend so its startup seed adds the new machine profiles.
2. Run `npm run seed:demo` from `backend/` after the API is ready.
3. Roll back by reverting the roster/script changes. Existing seeded MongoDB documents are intentionally not deleted; removing data remains an explicit operator action.
