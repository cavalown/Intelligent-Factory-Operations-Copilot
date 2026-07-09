## 1. limit=0 Fix

- [x] 1.1 In `backend/src/events/events.service.ts`'s `listEvents()`, replace `Number(query.limit) || DEFAULT_LIMIT` with an explicit `query.limit !== undefined ? Number(query.limit) : DEFAULT_LIMIT` check, keeping the existing `Math.max(..., 1)` / `Math.min(..., MAX_LIMIT)` clamp

## 2. Shared Mongo Error Utility

- [x] 2.1 Create `backend/src/shared/database/mongo-error.util.ts` exporting `isDuplicateKeyError(err: unknown): boolean`, moved from the identical private methods in `event-consumer.service.ts` and `alert-consumer.service.ts`
- [x] 2.2 Update `backend/src/events/event-consumer.service.ts` to import and use the shared function, deleting its private copy
- [x] 2.3 Update `backend/src/alerts/alert-consumer.service.ts` to import and use the shared function, deleting its private copy

## 3. Dead Type Alias Removal

- [x] 3.1 In `backend/src/shared/types/machine-event.types.ts`, delete `IMPLEMENTED_EVENT_TYPES` and `ImplementedEventType`
- [x] 3.2 In `backend/src/simulator/simulator.service.ts`, replace the one usage of `IMPLEMENTED_EVENT_TYPES` with `MVP_EVENT_TYPES`

## 4. Sensor-Failure Contract Test

- [x] 4.1 In `backend/src/machines/machine-projection-consumer.service.ts`, extract the `STATUS_CHANGED` sensor-failure check into a named function `isStatusChangedSensorFailure(currentStatus: string): boolean`, called from the existing switch branch
- [x] 4.2 In `backend/src/alerts/alert-consumer.service.ts`, extract the equivalent check into a same-named, same-logic (but not shared/imported) function `isStatusChangedSensorFailure(currentStatus: string): boolean`, fixing the inverted polarity found by code review (`!== 'WARNING'` → the function should return `true` for `'WARNING'`, matching Machine Service's definition)
- [x] 4.3 Added `backend/src/shared/sensor-failure-contract.spec.ts` importing both `isStatusChangedSensorFailure` functions, asserting agreement across all 5 `MachineStatus` values plus one unrecognized string
- [x] 4.4 Ran `npm test` (Jest) — passes (9/9). Unblocked by an unplanned but necessary fix: this was the first test to transitively load `Machine`/`Alert` Mongoose schemas, which surfaced a pre-existing latent issue (`@nestjs/mongoose`'s decorator can't resolve a `design:type` for string-literal-union `@Prop()` fields without an explicit `type: String`) on `Machine.status`, `Alert.severity`, `Alert.status` — added `type: String` to all 3, no behavior change (Mongoose already validated via `enum`)

## 5. Manual Verification (real running system, not just build)

- [x] 5.1 Rebuild and restart the `backend` container (`docker compose up -d --build backend`)
- [x] 5.2 GET `/events?limit=0`; verify it returns at most 1 event, not the default 20
- [x] 5.3 POST a `TEMPERATURE_REPORTED` event over threshold and a `STATUS_CHANGED` event to `WARNING`; verify both still create alerts correctly (regression check on the moved `isDuplicateKeyError` and extracted sensor-failure function)
- [x] 5.4 Re-POST an already-processed `eventId`; verify idempotency still works for both Event Service and Alert Service (regression check on `isDuplicateKeyError`'s new shared location)

## 6. Second Code-Review Round Fixes

- [x] 6.1 `backend/src/machines/machine-projection-consumer.service.ts`: add `Number.isFinite(temperature)` guard to `TEMPERATURE_REPORTED`, mirroring `alert-consumer.service.ts`'s existing guard; skip with a warn log on invalid input
- [x] 6.2 `backend/src/events/events.service.ts`: fix the regression from task 1.1 — a non-numeric `limit` (e.g. `?limit=abc`) now produces `NaN`; add a `Number.isFinite` check on the parsed value, falling back to `DEFAULT_LIMIT` when not finite
- [x] 6.3 `backend/src/alerts/alert-consumer.service.ts`: add a `default` branch to `resolveAlert`'s switch logging unrecognized `eventType`, mirroring `machine-projection-consumer.service.ts`'s equivalent branch
- [x] 6.4 `backend/src/alerts/alert-consumer.service.ts`: add a warn log to the `TEMPERATURE_REPORTED` invalid-temperature branch, closing the spec/code mismatch (`openspec/specs/alert-detection/spec.md` already said "logged as skipped")
- [x] 6.5 `backend/src/alerts/alert-consumer.service.ts`: reorder the `Number.isFinite(temperature)` check to run before `machinesService.findRaw()`, avoiding a wasted DB round-trip on malformed payloads
- [x] 6.6 `backend/src/simulator/simulator.service.ts`: change `schemaVersion` validation from `typeof !== 'number'` to `Number.isFinite(...)`, since `typeof NaN`/`typeof Infinity` are both `'number'`
- [x] 6.7 `backend/src/shared/kafka/kafka-consumer.base.ts`: promote the base class's logger to `protected readonly logger`, reused via `this.logger` by all 3 subclasses; remove the now-redundant `private readonly logger = new Logger(...)` from `event-consumer.service.ts`, `machine-projection-consumer.service.ts`, `alert-consumer.service.ts` (and the now-unused `Logger` import from `event-consumer.service.ts`, which never used its own copy)
- [x] 6.8 Update 2 comments referencing the pre-archive path `openspec/changes/kafka-consumer-reliability-hardening/design.md` to the archived path
- [x] 6.9 Add spec deltas for the two new behaviors: `machine-state-projection` (non-finite temperature doesn't corrupt the projection) and `alert-detection` (unrecognized eventType doesn't create an alert, is logged)
- [x] 6.10 Rebuilt, restarted backend, manually verified: `GET /events?limit=abc` → falls back to 20 (was NaN); `GET /events?limit=0` → still clamps to 1 (no regression); a `TEMPERATURE_REPORTED` event with `temperature: 1e400` (JSON-parses to `Infinity`) published directly to Kafka left `currentTemperature` unchanged at 95 (not corrupted) and both `AlertConsumerService` and `MachineProjectionConsumerService` logged "Skipping non-finite temperature"; an unrecognized `eventType` published directly to Kafka was logged as skipped by both consumers (confirms the new Alert Service `default` branch and the logger-consolidation refactor both work); full 5-event-type happy-path regression on `M-003` matched expected status/healthScore/productionCount/currentTemperature exactly
- [x] 6.11 Run `npm test` again to confirm the sensor-failure contract test and app.controller.spec.ts still pass after the logger refactor — 9/9 pass; `npx tsc --noEmit`, `npm run build`, `npm run lint` all clean (lint shows only the same 2 pre-existing unrelated issues in `event-consumer.service.ts`/`main.ts`)

**Explicitly deferred, not fixed in this change**: `KafkaConsumerBase`'s catch-all swallowing transient infra errors (not just malformed messages) — this is a real design question (see `design.md` Risks addendum) surfaced to the user rather than silently resolved. The temperature-threshold comparison duplicated without a contract test between Machine Service and Alert Service — already accepted as deferred debt in `machine-schema.md` §5.4 alongside the sensor-failure duplication; not treated as a new action item.

## 7. OpenSpec Closeout

- [x] 7.1 Run `openspec validate duplicate-logic-cleanup --strict` and confirm it passes
- [ ] 7.2 Archive the change once all tasks above are complete and verified
