## Why

Machine Service and Alert Service each independently re-derive the same two conditional classifications from the same raw `machine.events` — "does `TEMPERATURE_REPORTED`'s `temperature` exceed `temperatureThreshold`?" and "does `STATUS_CHANGED`'s `currentStatus` indicate sensor failure?" — with no single source of truth for either. This has already drifted once in practice: a code review caught the two services' boolean checks inverted relative to each other (`machine-projection-consumer.service.ts` checked `currentStatus === 'WARNING'`, `alert-consumer.service.ts` checked `currentStatus !== 'WARNING'`). The interim mitigation is a contract test asserting the two services' independent logic stays in sync — a safety net, not a fix. `docs/design/machine-schema.md` §5.4 and `docs/design/architecture.md` §9.3 both name this as exactly what Phase 2's Rule Engine should resolve, and Phase 2 (Event Streaming) is the current roadmap phase.

## What Changes

- **New Rule Engine consumer/producer**: an enrichment consumer that reads raw `machine.events`, computes the derived classification once per event (starting with the two known-duplicated conditionals), and republishes an enriched event carrying the original envelope plus the derived classification fields.
- Machine Service and Alert Service **stop independently re-deriving** `TEMPERATURE_REPORTED`-exceeds-threshold and `STATUS_CHANGED`-is-sensor-failure — they read the already-computed classification from the enriched event instead.
- The interim contract test (shared fixtures asserted against both services' independent classification logic) is **retired** once both services read the same computed value — there is nothing left to independently derive, so nothing left to drift.
- New module for the Rule Engine (module-boundaries.md forbids business logic in `shared/`, and this logic doesn't belong inside `machines/` or `alerts/` specifically since it must be computed upstream of, and independently from, both).

Out of scope for this change: expanding the Rule Engine to new classification types beyond the two that already exist and already drifted (e.g. a general-purpose configurable rule DSL) — this change fixes the named, concrete duplication; a general rule authoring system is a separate, larger scope call the design doc should flag but not commit to here.

## Capabilities

### New Capabilities
- `rule-engine`: the enrichment consumer/producer — reads raw machine events, computes derived classification, republishes enriched events; owns the "single source of truth for derived classification" guarantee.

### Modified Capabilities
- `machine-state-projection`: Machine Service's `TEMPERATURE_REPORTED`-exceeds-threshold and `STATUS_CHANGED`-is-sensor-failure handling changes from independently computing the classification to reading it from the enriched event.
- `alert-detection`: Alert Service's same two conditionals change the same way.

## Impact

- **Code**: new Rule Engine module (Kafka consumer + producer), changes to `machine-projection-consumer.service.ts` and `alert-consumer.service.ts` (read enriched fields instead of computing), removal of the interim contract test once both services are migrated.
- **Kafka**: a new topic (or an equivalent mechanism — the design doc decides) carrying enriched events; `machine.events` itself is unaffected (append-only, one event recorded once, per `architecture.md` §9.1).
- **Event schema**: the enriched event's shape (original envelope + derived classification fields) needs a documented contract, likely in `docs/design/event-schema.md` or a new dedicated section.
- **No API contract changes** anticipated — this is an internal pipeline change; Machine/Alert projections' external shape (what the dashboard reads) doesn't change.
