## Context

The design phase is complete and documented under `docs/`: event envelope and payload schemas (`docs/design/event-schema.md`), REST contract (`docs/design/api.md`), machine domain model and status/health-score rules (`docs/design/machine-schema.md`), overall architecture (`docs/design/architecture.md`), and local infra (`docs/deployment/docker-compose.md`). Kafka (KRaft mode, dual listener) and MongoDB are already running locally via the root `docker-compose.yml` and have been validated end to end with a manual produce/consume test.

No application code exists yet. This is the first change that writes real backend code, and it deliberately scopes to one event type (`TEMPERATURE_REPORTED`) to prove the architecture before expanding breadth.

## Goals / Non-Goals

**Goals:**
- Prove the core architectural pattern with real code: independent Kafka consumers, each building its own projection from the same event, with no direct in-process coupling between them.
- Stand up the module boundaries from `docs/design/architecture.md` §14.1 (`events/`, `machines/`, `alerts/`, `insights/`, `simulator/`, `shared/`) so future modules (including a later Event Translation Layer) have an obvious home, without committing to ever extracting them into separate services (see the reference-option note added to `architecture.md` §14.2).
- Cover one event type completely: ingestion → Kafka publish → 3 independent consumers → read APIs.

**Non-Goals:**
- Implementing the other 4 event types (`STATUS_CHANGED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`) — follow-up change.
- Insight Service / AI summary endpoints — follow-up change, deliberately last per the agreed development order and `ADR-0004`.
- The frontend.
- Alert acknowledgment/resolution workflow and escalation rules — these are Phase 2 roadmap items (`docs/product/product-roadmap.md`), not MVP scope.
- Authentication — explicitly excluded from MVP scope (`CLAUDE.md`).

## Decisions

**Kafka client: `kafkajs` directly, wrapped in plain NestJS providers — not `@nestjs/microservices`' Kafka transport.**
*(Revised during implementation — see note below.)* `kafkajs` has no native bindings to compile and is well-documented. Alternative considered: `node-rdkafka` (C++ bindings) — faster in theory, but adds native-dependency build complexity with no real payoff at this event volume.

This decision was originally written as "`@nestjs/microservices` with the Kafka transport," on the assumption that using NestJS's own blessed integration path was the idiomatic choice. Implementation revealed a problem: `@nestjs/microservices`' hybrid-application model (`app.connectMicroservice()`) attaches every `@EventPattern`-decorated handler in the app to *every* microservice context you connect — there's no built-in way to scope "these handlers belong to consumer group A, those to group B" within one Nest application. Getting 3 genuinely independent consumer groups (Event/Machine/Alert Service) the official way would require splitting into 3 separate Node processes, which directly contradicts the modular-monolith decision in `ai/rules/module-boundaries.md`. Using `kafkajs`'s client directly — creating one `kafka.consumer({ groupId })` per module, managed via ordinary `OnModuleInit`/`OnModuleDestroy` lifecycle hooks — supports this cleanly in one process. This is also the pattern Kafka itself is designed around: independent consumer groups reading the same topic is the standard mechanism for "multiple independent applications each get a full copy of the stream," not an edge case.

`@nestjs/microservices` is removed from dependencies (it added nothing once its transport abstraction isn't used).

**MongoDB access: `@nestjs/mongoose`.**
Schema-based access matching the field definitions already written in `machine-schema.md` and `architecture.md` §12. Alternative considered: raw `mongodb` driver — more control, but we'd hand-roll the validation that Mongoose schemas give for free, with no corresponding benefit at this stage.

**Each consumer gets its own Kafka consumer group ID** (e.g. `event-service-group`, `machine-service-group`, `alert-service-group`), not a shared group.
This is the detail that actually makes "independent consumers" true — if Event Service and Machine Service shared a consumer group, Kafka would split messages between them (load-balancing), and each would only see half the events. Separate groups mean every consumer sees every message, matching the fan-out design in `architecture.md` §9.

**Idempotency, scoped minimally for this change:**
- Event Service: unique index on `machine_events.eventId` (already recommended in `architecture.md` §12.1); a duplicate-key insert error is caught and treated as a no-op.
- Alert Service: unique index on `alerts.eventId`, same duplicate-key-as-no-op handling. (One event produces at most one alert in the current design, so this 1:1 index is valid.)
- Machine Service: compare the incoming event's `eventId` against the machine document's `lastEventId` before applying, per the pseudocode already in `machine-schema.md` §7. This only guards against re-processing the *immediately preceding* event twice — `machine-schema.md` §8 already documents this limitation and defers a fuller solution to when it's actually needed. This change does not attempt to solve that here.

**Topic creation:** rely on `KAFKA_AUTO_CREATE_TOPICS_ENABLE=true`, already set and validated in the root `docker-compose.yml` — no explicit topic-creation code needed in the backend for this change.

**Demo machine seeding:** a small hardcoded seed step (run on backend startup or via a seed script) upserts a fixed roster of machines by `machineId`, per `machine-schema.md` §11 (machines are pre-seeded, not auto-created). Reuse the `M-001` / "CNC Mill 01" / `temperatureThreshold: 80` example already used consistently across `api.md`, `machine-schema.md`, and `event-flow.md`, plus 1-2 additional machines for a believable multi-machine demo later.

## Risks / Trade-offs

- **[Risk]** Machine Service's `lastEventId`-only duplicate guard doesn't protect against out-of-order redelivery of an older event. → **Mitigation:** accepted for MVP per `machine-schema.md` §8; revisit only if real duplicate-processing bugs actually surface.
- **[Risk]** Seed step could duplicate machine documents if run more than once. → **Mitigation:** seed by upserting on `machineId`, not unconditional insert.
- **[Risk]** The root `docker-compose.yml`'s `backend` service block is currently commented out (pointing at a `backend/` directory that didn't exist until this change) and could be forgotten. → **Mitigation:** uncommenting and validating it is an explicit task in `tasks.md`.
- **[Risk]** Scoping validation to `TEMPERATURE_REPORTED` only means `POST /simulator/events` will reject the other 4 event types until the follow-up change lands. → **Mitigation:** acceptable and intentional per the agreed walking-skeleton-first development order; not a regression since no other event type is implemented anywhere yet either.

## Migration Plan

Greenfield — no existing data or deployed code to migrate.

1. Scaffold `backend/` (NestJS project + module folders).
2. Uncomment and align the `backend` service block in the root `docker-compose.yml`.
3. Implement ingestion, the 3 consumers, and read endpoints for `TEMPERATURE_REPORTED`.
4. Add the machine seed step.
5. `docker compose up --build backend` alongside the already-running `kafka`/`mongodb`, and manually walk through the scenario in `docs/design/event-flow.md` §3 to confirm it now works with real code, not just on paper.

No rollback concerns beyond `docker compose down` — nothing external depends on this yet.

## Open Questions

- Exact seed roster (how many demo machines, names, thresholds) beyond `M-001` — can be decided while writing the seed step; low-stakes, easily changed later.
- Automated testing strategy (unit tests vs. integration tests against real Kafka/Mongo, e.g. via Testcontainers) is not decided here — out of scope for this change, worth a dedicated follow-up decision once the walking skeleton exists to test against.
