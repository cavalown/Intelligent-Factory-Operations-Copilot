## Context

`docs/design/machine-schema.md` §5.4 documents an accepted-but-risky consequence of the MVP's per-service classification: Machine Service and Alert Service each independently re-derive two conditional facts from the same raw event — "does `TEMPERATURE_REPORTED`'s `temperature` exceed `temperatureThreshold`?" and "does `STATUS_CHANGED`'s `currentStatus` indicate sensor failure?" A code review already caught these two independent derivations drifting apart (inverted boolean logic between the two services). The interim mitigation is a contract test asserting both services' logic stays in sync against shared fixtures — a safety net, not a fix, and explicitly scoped as temporary pending Phase 2. `architecture.md` §9.3 names the fix directly: "Future versions can replace simple code-based logic with a rule engine."

The user decided (2026-07-20) on the enrichment-topology shape: a new Kafka topic, with Machine Service and Alert Service switching their subscription to it, rather than inserting the Rule Engine into the synchronous API publish path.

## Goals / Non-Goals

**Goals:**

- One place computes `TEMPERATURE_REPORTED`-exceeds-threshold and `STATUS_CHANGED`-is-sensor-failure; Machine Service and Alert Service read the answer instead of each re-deriving it.
- Preserve every existing guarantee the two services currently rely on: per-`machineId` event ordering (`event-schema.md` §8), `eventId`-keyed idempotency (`machine-schema.md` §8), and `machine.events`'s own append-only "one event recorded once" semantics (`architecture.md` §9.1) — Event Service keeps consuming raw `machine.events` directly, untouched by this change.
- Retire the interim contract test once both services read the same computed value — there's nothing left to independently drift.

**Non-Goals:**

- A general-purpose, configurable, or user-authored rule DSL. This change fixes the two concrete, already-drifted conditionals named in `machine-schema.md` §5.4 — not a rules-engine *product*. A future change can generalize this if a third classification need appears; forcing an abstraction for a sample size of two would be premature.
- Any change to `machine.events` itself, to the API contract, to Insight Service, or to what the dashboard reads. This is an internal pipeline change between existing Kafka consumers.
- Backfilling or migrating historical data outside Kafka's own replay (`fromBeginning: true`) — see Migration Plan.

## Decisions

### D1: A new topic, `machine.events.enriched`, keyed by `machineId` — same partition key as `machine.events`

Rule Engine consumes `machine.events` (its own consumer group, per `ai/rules/kafka-consumer-conventions.md`) and republishes to `machine.events.enriched`, produced with the **same `machineId` key** as the source event. This preserves `event-schema.md` §8's per-machine ordering guarantee end-to-end: Kafka's per-partition ordering holds across the republish because the partition key is unchanged, so Machine/Alert Service still see each machine's events in the order they occurred, just one hop later. A new env var, `KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED` (default `machine.events.enriched`), follows the existing `KAFKA_TOPIC_MACHINE_EVENTS` pattern in `env.config.ts`/`docker-compose.md` §5 — auto-created by Kafka's existing `KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"`, no new infra step.

### D2: The republished event keeps the original `eventId` — it is a richer copy, not a new event

The enriched event carries every field of the source `MachineEventEnvelope` unchanged, plus the new classification fields (D3), under the **same `eventId`**. This is deliberate and load-bearing: Machine Service's and Alert Service's existing idempotency guards (`lastEventId` comparison, duplicate-key catches — `machine-schema.md` §8) key off `eventId`, and both services already assume "one `eventId`, one decision." Minting a new `eventId` on republish would silently break every downstream idempotency check this system already relies on. Rule Engine's own consumption of `machine.events` is itself idempotent the same way every other consumer's is (per-partition offset commit; a redelivered source event just republishes the identical enriched event again, which downstream idempotency absorbs as a no-op).

### D3: Classification fields are new top-level envelope fields, not additions to `payload`

`temperatureExceedsThreshold?: boolean` and `isSensorFailure?: boolean` are added as siblings to `correlationId` on the envelope (`MachineEventEnvelope`), each present only when relevant to that event's `eventType` (mirroring how `correlationId` itself is optional). They are **not** added into the type-specific `payload` interfaces (`TemperatureReportedPayload`, `StatusChangedPayload`) — `payload` stays exactly what the original producer sent, pass-through and untouched, so `event-schema.md` §5's payload contracts don't change shape and Event Service's stored raw history (which never sees these fields, since it consumes `machine.events` not the enriched topic) needs no schema change either.

### D4: Rule Engine is a `KafkaConsumerBase` subclass in a new `rules/` module

Per `ai/rules/module-boundaries.md`, this logic can't live in `shared/` (business logic ban) and doesn't belong inside `machines/` or `alerts/` specifically — it must be computed upstream of, and independently from, both. A new `rules/` module (added to the module list in `architecture.md` §14.1 and `module-boundaries.md` in the same change — registry sweep, per the observability retrospective's Pattern 3 lesson about enumerated docs not updating themselves) owns it. Extending `KafkaConsumerBase` (not a hand-rolled consumer, per `ai/rules/observability-conventions.md`) means Rule Engine gets its own consumer group, `isDataError`-classified error handling, and — for free — `ifoc.correlation_id`/`event_id`/`event_type` span attributes and an `ifoc.events.processed` count for the `rules-service-group` label, with zero extra code.

### D5: Machine Service and Alert Service switch their subscription entirely to `machine.events.enriched`; Event Service does not

Machine Service and Alert Service's `super(kafka, '<group>', env.kafkaTopicMachineEvents)` calls change to `env.kafkaTopicMachineEventsEnriched`. Event Service keeps consuming raw `machine.events` unchanged — it stores history verbatim and has no classification logic to fix. This means Machine/Alert Service's freshness is now bounded by Rule Engine's own consumer lag, not just Kafka's (see Risks).

### D6: The interim contract test is deleted once both services are migrated, not kept as a redundant check

Once Machine Service and Alert Service both read `temperatureExceedsThreshold`/`isSensorFailure` off the enriched event rather than computing it, there are no longer two independent implementations for the contract test to compare — keeping it would mean asserting a tautology (both services reading the same field always agree). Its job is fully absorbed by whatever test coverage Rule Engine's own classification logic gets.

## Risks / Trade-offs

### Data safety and completeness under Rule Engine failure — the compensation mechanism this design relies on

This design adds no new safety mechanism of its own; it relies on three guarantees this system already has, composed the same way the existing three consumers already compose them:

1. **Kafka's durable log + committed offsets**: Rule Engine crashing and restarting resumes from its last committed offset — no event is skipped and none needs to be manually replayed. This is identical to how Event/Machine/Alert Service already recover from a restart.
2. **`eventId`-keyed idempotency, end to end (D2)**: Kafka's delivery guarantee is at-least-once, so Rule Engine *will* sometimes reprocess and republish the same source event more than once (e.g. a crash between processing and offset commit). Because the republished event keeps the original `eventId` (D2), Machine/Alert Service's existing idempotency guards (`lastEventId` comparison, duplicate-key catches) absorb the duplicate as a no-op — this is the actual answer to "what happens on a mid-stream failure": duplicates are safe by construction, not by luck.
3. **The existing `isDataError` poison-pill classification**: a source event that makes Rule Engine's own classification logic throw is handled exactly like any other consumer's bad-message case — a data error is logged and skipped (that one event never gets an enriched counterpart, same accepted trade-off the other three consumers already make), a transient error is rethrown to kafkajs's own retry.

Net effect: [Rule Engine is down or lagging] → Machine/Alert Service simply see no new events until it catches up; nothing is lost or double-counted once it does. Event Service is entirely unaffected, since it doesn't consume the enriched topic.

**The one gap not covered by reusing existing guarantees**: `docker-compose.yml` sets no explicit Kafka retention, so the broker's default (168h / 7 days) applies. If Rule Engine were down longer than that with nobody noticing, the oldest unprocessed `machine.events` messages could age out before Rule Engine catches up to them. This exposure already exists identically for the other three consumers today — it isn't new to this change — and isn't worth mitigating with additional machinery at this project's demo scale; noted here for honesty, not as an action item.

- [One more Kafka hop adds latency between an event occurring and Machine/Alert Service seeing it] → negligible at this project's demo scale (same "demo-weight" posture already established for observability); not a concern worth optimizing for here.
- [Retiring the contract test removes a safety net] → the risk it guarded against (two independent implementations silently drifting) is structurally eliminated, not just untested — there's exactly one implementation left. Its replacement is direct test coverage on Rule Engine's own classification logic, in `backend/src/rules/rule-engine-consumer.service.spec.ts`.
- [A future third classification need reopens the "shared logic" question] → deliberately deferred (Non-Goals) rather than solved speculatively; Rule Engine's module boundary is the natural place to add it when it's real, not hypothetical.
- [`rules-service-group`'s `ifoc.events.processed` count can double-count on redelivery] → Rule Engine owns no persistence (module-boundaries.md), so unlike the other three consumers it has no `lastEventId`/duplicate-key state to detect a redelivered source event and skip re-counting it. A crash between publishing the enriched event and committing the source offset will re-increment the counter for an event already counted once. Accepted rather than fixed with new state, since adding persistence purely to deduplicate a metric would contradict the module's own reason for existing (`ai/rules/observability-conventions.md`'s Rule Engine exception documents this explicitly).
- [No net reduction in MongoDB reads for a `TEMPERATURE_REPORTED` event] → Rule Engine's `findRaw` lookup (D1 above) replaces, not eliminates, Alert Service's former lookup — Machine Service still does its own separate `findOne` on the same document to update the projection. Total reads against a given machine document per event is unchanged at 2; what changed is that Machine/Alert Service's processing is now serialized behind Rule Engine's consume-classify-produce step instead of running in parallel with each other from the moment the raw event landed, as they did before this change. Accepted at this project's demo scale for the same reason as the added latency above — not treated as a correctness issue, since nothing here breaks the guarantees D1/D2 depend on.

## Migration Plan

1. Add the `rules/` module, `machine.events.enriched` topic/env var, and Rule Engine's `KafkaConsumerBase` subclass (consumes `machine.events`, republishes enriched events).
2. Switch Machine Service and Alert Service to consume `machine.events.enriched` instead of `machine.events`, reading the new fields instead of computing them.
3. Remove the interim contract test.
4. No data migration: all consumers already use `fromBeginning: true` and replay full topic history on fresh deployment (existing pattern, `kafka-consumer-conventions.md`). On first boot, Rule Engine will itself replay all of `machine.events` from the beginning to fully populate `machine.events.enriched` before Machine/Alert Service's own replay catches up to current — consistent with how every other consumer in this system already bootstraps.

Rollback: revert Machine Service and Alert Service to consuming `machine.events` directly with their original inline classification logic (restore the deleted code from version control); the enriched topic and Rule Engine module can be left running unused or removed. No destructive step in either direction — Kafka topics are additive, not migrated in place.

## Open Questions

None blocking — the one deferred question (whether a third classification need eventually justifies a more general rule mechanism) is explicitly out of scope (Non-Goals) until it's a real, current need.
