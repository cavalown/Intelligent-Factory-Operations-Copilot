# ADR-0001: Use Kafka as the Event Backbone

## Status

Accepted

## Context

IFOC needs one machine event to independently drive several different outcomes: immutable history storage, a current-state projection, alert detection, and (on demand) AI summary context. These consumers must be addable over time — Predictive Maintenance and Digital Twin consumers are already planned for later roadmap phases — without rewriting the producer or existing consumers.

Within a machine, event order matters: a `STATUS_CHANGED` followed by an `ERROR_OCCURRED` must be processed in that order, or the projection ends up wrong. Across different machines, ordering does not matter.

## Decision

Use Kafka as the event backbone. The Machine Simulator (and future producers) publish to a single `machine.events` topic, keyed by `machineId`. Event Service, Machine Service, and Alert Service each subscribe independently and build their own view from the same stream.

## Consequences

**Easier:**

* New consumers (Predictive Maintenance, Digital Twin) can subscribe to `machine.events` without touching the producer or existing consumers — see `docs/design/architecture.md` §9.5.
* Keying by `machineId` guarantees per-machine ordering within a partition without requiring a distributed lock or sequence number scheme.
* Event replay (`architecture.md` §10.4) is a natural fit for a log-structured system, supporting future Digital Twin simulation and projection recovery.

**Harder:**

* Consumers must handle asynchronous, eventually-consistent processing — a client that posts an event and immediately reads `GET /machines/:id` may see stale data (`architecture.md` §15).
* Consumers must implement `eventId`-based idempotency themselves; Kafka's at-least-once delivery does not guarantee exactly-once processing by default.
* Running Kafka locally adds operational weight (a broker plus Zookeeper/KRaft controller in Docker Compose) compared to a simpler queue.

## Alternatives Considered

* **RabbitMQ / a traditional message queue** — good at point-to-point work distribution, but multiple independent consumers reading the same message stream is a secondary concern for a queue, not its primary design point. Kafka's log-based pub/sub model fits IFOC's "one event, many projections" shape more directly.
* **Direct REST calls between modules** (simulator calls each service synchronously) — simplest to build, but couples the producer to every current and future consumer, and provides no event history or replay capability. Rejected because it works against the "events are the source of truth" principle in `architecture.md` §3.
* **Database polling / outbox table without a broker** — avoids running Kafka locally, but reinvents ordering, delivery, and multi-consumer fan-out that Kafka already solves, and does not set up the event-replay direction the architecture wants for later phases.
