# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This repository is currently in the **design phase**. All design documents live under `docs/`. No application code exists yet. When implementation begins, the expected top-level structure is:

```
frontend/    # Vue 3 + TypeScript dashboard
backend/     # NestJS modular monolith
docker-compose.yml
```

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3, TypeScript |
| Backend | NestJS (modular monolith) |
| Messaging | Kafka (topic: `machine.events`, key: `machineId`) |
| Database | MongoDB |
| AI | LLM API (direct summaries; no RAG in MVP) |
| Local Runtime | Docker Compose |

## Architecture

IFOC is an event-driven factory monitoring platform. **Events are the source of truth; projections are derived views.**

```
Machine Simulator
    → POST /simulator/events
    → Kafka: machine.events
    → Event Consumer (NestJS)
        ├── Event Service    → machine_events collection (immutable history)
        ├── Machine Service  → machines collection (current state projection)
        └── Alert Service    → alerts collection (WARNING/CRITICAL events only)
    → Insight Service        → ai_summaries collection (on-demand LLM calls)
    → API Layer              → REST responses to Vue 3 dashboard
```

The MVP uses a **NestJS modular monolith** with these modules, each owning its own persistence access:

```
backend/
├── events/      # Immutable event history — answers "what happened?"
├── machines/    # Current state projection — answers "what is the state now?"
├── alerts/      # Problem tracking — answers "what needs attention?"
├── insights/    # LLM summaries — answers "what does this mean?"
├── simulator/   # Generates fake machine events for demos
└── shared/      # Shared types, DTOs, utilities
```

### Key Design Rules

1. **Events are immutable.** `machine_events` is append-only. Never mutate stored events.
2. **Severity is a consumer interpretation, not a raw event field.** The raw event envelope has no `severity` field — Alert Service applies rules to decide whether to create an alert.
3. **AI explains data, it does not replace it.** Insight Service reads from Event/Machine/Alert collections; it is not the source of truth.
4. **Use `eventId` for idempotency.** Consumers must guard against duplicate event processing.
5. **`machineId` as Kafka message key** preserves per-machine event ordering within a partition.

## Event Schema

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

## Machine State Rules

When consumers process events, they apply these projection rules:

| Event | Machine Status | Health Score |
|---|---|---|
| `TEMPERATURE_REPORTED` (high) | WARNING | −10 |
| `ERROR_OCCURRED` | ERROR | −30 |
| `MAINTENANCE_REQUIRED` | MAINTENANCE | −20 |
| `STATUS_CHANGED` (sensor failure) | WARNING | −15 |
| `PRODUCTION_COMPLETED` | RUNNING | +2 |

## REST API Contract

```
GET  /machines
GET  /machines/:id
GET  /machines/:id/events
GET  /machines/:id/alerts
GET  /machines/:id/summary
POST /machines/:id/summary    # triggers LLM call
POST /simulator/events        # publishes event to Kafka
```

Full API contract: `docs/design/api.md` (to be populated).

## MongoDB Collections

| Collection | Purpose |
|---|---|
| `machine_events` | Immutable event history |
| `machines` | Machine profiles + current state projection |
| `alerts` | Alerts derived from WARNING/CRITICAL events |
| `ai_summaries` | LLM-generated summaries (traceable to `inputEventIds`) |

## Key Design Documents

- `docs/design/architecture.md` — full system architecture and principles
- `docs/design/event-schema.md` — event envelope, payload schemas, versioning rules
- `docs/product/mvp.md` — MVP scope, machine state rules, definition of done
- `docs/product/product-roadmap.md` — 5-phase roadmap (Foundation → Digital Twin)

## MVP Scope Boundaries

The following are **explicitly out of scope for MVP**: authentication, rule engine, RAG, WebSocket real-time updates, incident management, notification center, OPC UA/PLC integration, Kubernetes, predictive maintenance.

AI summary in MVP uses direct LLM calls only. RAG and SOP knowledge base belong to Phase 3.
