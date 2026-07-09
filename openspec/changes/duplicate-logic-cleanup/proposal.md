## Why

The same `/code-review` pass that found the reliability bugs (see `kafka-consumer-reliability-hardening`) also found 4 lower-severity issues: one real edge-case bug (`limit=0` silently ignored), two pieces of duplicated implementation with no shared source of truth (Mongo duplicate-key detection; the "STATUS_CHANGED to WARNING = sensor failure" classification, found duplicated with **inverted boolean polarity** between Machine Service and Alert Service), and one now-dead type alias left over from the walking-skeleton phase. None of these crash anything today, but the sensor-failure duplication is a real drift risk — the follow-up explore session (see `docs/design/machine-schema.md` §5.4) concluded the two services should stay structurally independent (no shared business-logic module, consistent with `ai/rules/module-boundaries.md`), but a **contract test** should exist so future drift between them fails loudly instead of silently.

**Update**: a second `/code-review` pass, run against this change's own implementation (plus the already-archived `kafka-consumer-reliability-hardening`), found 10 further CONFIRMED issues — including a regression this change's own `limit=0` fix introduced, and a case where `kafka-consumer-reliability-hardening`'s `TEMPERATURE_REPORTED` finite-number guard was applied to Alert Service but not to Machine Service for the identical field. All 10 are folded into this change's scope below rather than opening a third change, since they're small, directly related fixes to code this change is already touching.

## What Changes

- `events.service.ts`'s `listEvents()` fixes the `limit=0` handling: `Number(query.limit) || DEFAULT_LIMIT` treats an explicit `0` as "not provided" due to JS falsy coercion; switch to an explicit `undefined` check so `limit=0` is honored (clamped to the existing `[1, MAX_LIMIT]` range per current behavior, i.e. `limit=0` becomes `limit=1`, not silently `limit=20`). **Round 2 fix**: the `undefined` check alone introduced a new regression — a non-numeric `limit` (e.g. `?limit=abc`) now produces `NaN` instead of falling back to the default; added a `Number.isFinite` check so both edge cases are handled correctly.
- `isDuplicateKeyError` (currently duplicated verbatim in `event-consumer.service.ts` and `alert-consumer.service.ts`) moves to one shared helper.
- A new contract test asserts that `MachineProjectionConsumerService`'s and `AlertConsumerService`'s independent "is this `STATUS_CHANGED` event a sensor failure" classification agree, across a shared set of fixtures — without merging their implementations (per `machine-schema.md` §5.4's decision to keep them structurally independent for now).
- `IMPLEMENTED_EVENT_TYPES`/`ImplementedEventType` (now byte-for-byte identical to `MVP_EVENT_TYPES`/`MvpEventType` since all 5 event types are implemented) are deleted; `simulator.service.ts`'s one usage switches to `MVP_EVENT_TYPES` directly.
- **Round 2 additions** (from the second code-review pass):
  - `machine-projection-consumer.service.ts`'s `TEMPERATURE_REPORTED` case gains the same `Number.isFinite(temperature)` guard `alert-consumer.service.ts` already had — closing a gap where Machine Service could still write `Infinity`/`NaN` into `currentTemperature`.
  - `simulator.service.ts`'s `schemaVersion` validation switches from `typeof !== 'number'` to `Number.isFinite(...)`, since `typeof NaN`/`typeof Infinity` are both `'number'` and slipped through the original check.
  - `alert-consumer.service.ts`'s `resolveAlert` switch gains a `default` branch logging unrecognized `eventType`s (mirroring `machine-projection-consumer.service.ts`'s equivalent branch from `kafka-consumer-reliability-hardening`), and its `TEMPERATURE_REPORTED` case now logs when skipping an invalid temperature, closing a spec/code mismatch (the spec already said "logged as skipped"; the code didn't log).
  - `alert-consumer.service.ts`'s `Number.isFinite` check on `temperature` is reordered to run before the `machinesService.findRaw()` DB call instead of after, avoiding a wasted query on malformed payloads.
  - `KafkaConsumerBase` now owns a single `protected readonly logger`, reused by all 3 subclasses via `this.logger` — removing 3 duplicate `Logger` instantiations (one per subclass) that each carried the same class-name context as the base class's own new logger.
  - Two comments referencing `openspec/changes/kafka-consumer-reliability-hardening/design.md` updated to the archived path (`openspec/changes/archive/2026-07-08-kafka-consumer-reliability-hardening/design.md`), since that change was archived before this round of fixes landed.
- **Explicitly not changed** (assessed and left as-is): `KafkaConsumerBase`'s catch-all also swallowing transient infra errors (not just malformed messages) is a real, separate design question — see `design.md` Risks, deferred pending user input rather than silently redesigned. The temperature-threshold comparison duplicated (without a contract test) between Machine Service and Alert Service is already documented as accepted debt in `machine-schema.md` §5.4 alongside the sensor-failure duplication — no new action taken here.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `event-history`: new requirement that an explicit `limit=0` is honored (clamped to the minimum) rather than silently treated as "no limit provided."
- `machine-state-projection`: new requirement that a non-finite `TEMPERATURE_REPORTED` temperature does not corrupt `currentTemperature`/`status`/`healthScore`.
- `alert-detection`: new requirement that an unrecognized `eventType` does not create an alert and is logged.

## Impact

- **Code**: `backend/src/events/events.service.ts`, `backend/src/events/event-consumer.service.ts`, `backend/src/alerts/alert-consumer.service.ts`, `backend/src/machines/machine-projection-consumer.service.ts`, `backend/src/simulator/simulator.service.ts`, `backend/src/shared/kafka/kafka-consumer.base.ts`, `backend/src/shared/types/machine-event.types.ts`, plus a new shared Mongo-error utility and a new test file for the contract test.
- **Behavior change**: `GET /events?limit=0` / `GET /machines/:id/events?limit=0` now returns 1 item instead of the default 20 — a minor, arguably-more-correct API behavior change, not expected to affect any existing caller since no frontend exists yet. `GET /events?limit=abc` (or similar non-numeric input) now falls back to the default 20 instead of producing `NaN`-driven undefined query behavior.
- **No API contract changes to document** beyond the `limit=0` clarification, which is a bug fix to already-documented behavior (`docs/design/api.md` §4.3/§4.4 already document `limit`'s default/max; this doesn't change the documented contract, just the implementation's fidelity to it).
- **Docs**: `machine-schema.md` §5.4 already recorded the explore session that led to this change; no further doc changes beyond the spec deltas listed above.
