## 1. Consumer Error Boundary

- [x] 1.1 In `backend/src/shared/kafka/kafka-consumer.base.ts`, add a `Logger` instance and wrap the `eachMessage` callback's call to `this.handleMessage(payload)` in a try/catch that logs the error (message + stack) and does not rethrow
- [x] 1.2 Confirm the change applies uniformly to all 3 subclasses (`EventConsumerService`, `MachineProjectionConsumerService`, `AlertConsumerService`) with no per-subclass changes needed, per `design.md` Decision 1

## 2. Simulator Validation Gaps

- [x] 2.1 In `backend/src/simulator/simulator.service.ts`, update `validateEnvelope` to reject a `schemaVersion` that isn't a number, using error code `INVALID_EVENT_ENVELOPE` (400) — same code as the existing missing-field check
- [x] 2.2 Update `validateStatusChangedPayload` to reject a `currentStatus` that isn't one of the 5 allowed `MachineStatus` values (`RUNNING`, `IDLE`, `WARNING`, `ERROR`, `MAINTENANCE`), using error code `PAYLOAD_VALIDATION_FAILED` (422) — canonical `MACHINE_STATUSES` moved to `shared/types/machine-status.types.ts` (re-exported from `machines/schemas/machine.schema.ts`) so `simulator/` can import it without reaching into another module's schema file, per `ai/rules/module-boundaries.md`

## 3. Machine Service Guards

- [x] 3.1 In `backend/src/machines/machine-projection-consumer.service.ts`, add a `default` branch to the event-type switch that returns without updating `lastEventId`/`lastUpdatedAt`/calling `save()`
- [x] 3.2 In the `PRODUCTION_COMPLETED` branch, guard `machine.productionCount += event.payload.quantity` behind a `Number.isFinite(event.payload.quantity)` check — chose to skip only the `productionCount` increment (not the whole event) since `status`/`healthScore` effects don't depend on `quantity` being valid; logs a warning either way

## 4. Alert Service Guard

- [x] 4.1 In `backend/src/alerts/alert-consumer.service.ts`'s `resolveAlert`, guard the `TEMPERATURE_REPORTED` case so a missing/non-finite `temperature` returns `null` (no alert) instead of proceeding to the threshold comparison

## 5. Manual Verification (real running system, not just build)

- [x] 5.1 Rebuild and restart the `backend` container (`docker compose up -d --build backend`)
- [x] 5.2 POST a `STATUS_CHANGED` event with `currentStatus: "BOGUS"`; verify `422 PAYLOAD_VALIDATION_FAILED` and no Kafka publish (previously this would have crashed Machine Service)
- [x] 5.3 POST an event with `schemaVersion: "abc"`; verify `400 INVALID_EVENT_ENVELOPE` and no Kafka publish (previously this would have crashed Event Service)
- [x] 5.4 Confirm the backend container does NOT crash/restart after either of the above (check `docker logs ifoc-backend` for the previous crash signature, confirm absent; check `docker compose ps` shows `ifoc-backend` still `Up`, not `Restarting`)
- [x] 5.5 Manually publish a malformed (non-JSON) message directly to the `machine.events` topic (via a throwaway kafkajs script against `localhost:9093`) and confirm all 3 consumer groups (`EventConsumerService`, `MachineProjectionConsumerService`, `AlertConsumerService`) log an error but keep processing subsequent valid events published afterward — confirmed: a `TEMPERATURE_REPORTED` event published right after was processed normally
- [x] 5.6 Verified via a direct Kafka publish (bypassing simulator validation) with `quantity` omitted from a `PRODUCTION_COMPLETED` payload: `productionCount` stayed unchanged (not `NaN`), `healthScore`/`status` still updated normally, warning logged
- [x] 5.7 Re-ran the full event-type verification matrix (all 5 event types via valid `/simulator/events` calls on `M-003`); final `status`/`healthScore`/`productionCount`/alerts all matched expected values exactly, no regression

## 6. OpenSpec Closeout

- [x] 6.1 Run `openspec validate kafka-consumer-reliability-hardening --strict` and confirm it passes
- [x] 6.2 Archive the change once all tasks above are complete and verified
