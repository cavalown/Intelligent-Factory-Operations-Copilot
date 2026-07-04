# ADR-0002: Use MongoDB for Events and Projections

## Status

Accepted

## Context

IFOC stores two structurally different kinds of data. `machine_events` holds an append-only history where every event type (`STATUS_CHANGED`, `TEMPERATURE_REPORTED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`) has its own `payload` shape (`docs/design/event-schema.md` §5). `machines`, `alerts`, and `ai_summaries` hold projections that are read far more often than they're written, and whose shape may still change as the MVP evolves.

The MVP also needs to move fast — this is a design-phase project with no production data yet, so schema flexibility during early iteration matters more than strict upfront normalization.

## Decision

Use MongoDB for all four MVP collections: `machine_events`, `machines`, `alerts`, `ai_summaries`.

## Consequences

**Easier:**

* Each `eventType`'s distinct `payload` shape can be stored as-is in `machine_events` without a rigid, pre-declared column schema or a wide table full of nullable columns.
* Projection documents (`machines`, `alerts`, `ai_summaries`) map directly onto the JSON shapes returned by the API (`docs/design/api.md` §5) — no ORM/relational-to-JSON translation layer.
* Schema changes during MVP iteration (adding a field to a payload, adding a new event type) don't require a migration before the next event can be written.

**Harder:**

* MongoDB does not enforce the event envelope or payload schemas at the database level — validation must happen entirely in application code (`event-schema.md` §9), so a bug in a consumer can write a malformed document that a relational schema would have rejected outright.
* Cross-collection consistency (e.g. an alert whose `eventId` no longer exists) is not enforced by foreign keys; it depends on consumers being correct.
* As noted in `docs/design/architecture.md` §14.2, if dashboard queries become expensive at scale, MongoDB's flexibility trades off against the kind of indexed, normalized query performance a relational store gives for free.

## Alternatives Considered

* **PostgreSQL (relational)** — would enforce the envelope schema and foreign-key integrity at the database level, which is real value. Rejected for the MVP because per-event-type payloads would need either a wide nullable-column table or a JSONB column that gives up most of the relational benefit anyway, and because the team's fastest path to a working MVP is a schema-flexible document store.
* **DynamoDB / managed NoSQL** — similar flexibility to MongoDB, but ties the MVP to a specific cloud vendor before the deployment story (`architecture.md` §13) has moved past Docker Compose. MongoDB runs identically locally and in any future cloud target.
* **Elasticsearch as primary store** — good fit for the event-search feature planned in `docs/product/product-roadmap.md` Phase 3, but is not designed to be a system of record with strong consistency guarantees. Better suited as a future secondary index over `machine_events`, not the primary store.
