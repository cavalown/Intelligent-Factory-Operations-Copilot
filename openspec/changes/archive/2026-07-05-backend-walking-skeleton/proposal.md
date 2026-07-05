## Why

The design phase is complete (architecture, event schema, API contract, machine domain model, deployment docs), but no application code exists yet. Before building out all 5 event types, the frontend, and AI summaries, we need to validate that the core architectural assumption — an event-driven pipeline where independent Kafka consumers each build their own projection from the same event — actually works, end to end, with real code. This change scaffolds the NestJS backend and proves the full pipeline using one representative event type (`TEMPERATURE_REPORTED`) before expanding to the rest.

## What Changes

- Scaffold `backend/` as a NestJS modular monolith per `docs/design/architecture.md` §14.1: `events/`, `machines/`, `alerts/`, `insights/`, `simulator/`, `shared/` module folders.
- Implement `POST /simulator/events` to accept a fully-formed event envelope, validate it, and publish it to the `machine.events` Kafka topic keyed by `machineId` (`docs/design/api.md` §4.7). Initial payload validation covers `TEMPERATURE_REPORTED` only.
- Implement the Event Service Kafka consumer: persist events immutably to `machine_events` (`docs/design/architecture.md` §12.1).
- Implement the Machine Service Kafka consumer: apply the `TEMPERATURE_REPORTED` projection rule (status/healthScore/currentTemperature, per `docs/design/machine-schema.md` §4/§5/§7) and maintain the `machines` collection.
- Implement the Alert Service Kafka consumer: create a `WARNING` alert when a reported temperature exceeds the machine's threshold (per the Alert Rules in `CLAUDE.md` / `docs/design/architecture.md` §9.3), and maintain the `alerts` collection.
- Implement read endpoints: `GET /machines`, `GET /machines/:id`, `GET /machines/:id/events`, `GET /machines/:id/alerts`.
- Seed a small fixed roster of demo machines directly (per `docs/design/machine-schema.md` §11: machines are pre-seeded, not auto-created from unknown `machineId`s).
- Uncomment and align the `backend` service block in the root `docker-compose.yml` now that `backend/` exists.

**Out of scope for this change** (deferred to follow-up changes, per the agreed development order):
- The other 4 event types (`STATUS_CHANGED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`).
- Insight Service / AI summary endpoints (`POST`/`GET /machines/:id/summary`).
- The frontend (`frontend/` is not scaffolded in this change).

## Capabilities

### New Capabilities
- `machine-event-ingestion`: Accept a machine event envelope over REST, validate it against the envelope and payload schema, and publish it to Kafka for asynchronous processing. Initial scope covers the `TEMPERATURE_REPORTED` payload only.
- `event-history`: Consume machine events from Kafka and persist them as immutable, append-only history.
- `machine-state-projection`: Consume machine events from Kafka and maintain each machine's current state (status, health score, latest telemetry) as a read model exposed over REST.
- `alert-detection`: Consume machine events from Kafka, apply severity rules, and create/expose alert records over REST.

### Modified Capabilities
(none — no existing specs in `openspec/specs/` yet)

## Impact

- New `backend/` directory (NestJS project).
- Root `docker-compose.yml`: the `backend` service block (currently commented out) is uncommented and wired up.
- New MongoDB collections in use: `machine_events`, `machines`, `alerts`.
- Uses the `machine.events` Kafka topic, already validated running locally via Docker Compose (KRaft mode, dual listener) earlier in this project.
- No changes to `docs/` design documents — this change implements what they already specify, narrowed to one event type.
- No frontend impact.
