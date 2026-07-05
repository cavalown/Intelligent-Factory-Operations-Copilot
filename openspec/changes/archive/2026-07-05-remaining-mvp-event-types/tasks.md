## 1. Shared Types

- [x] 1.1 In `backend/src/shared/types/machine-event.types.ts`, add `StatusChangedPayload` (`previousStatus?`, `currentStatus` required, `reason?`) and `StatusChangedEvent` type, per `event-schema.md` §5.1
- [x] 1.2 Add `ErrorOccurredPayload` (`errorCode`, `errorMessage` required, `recoverable?`) and `ErrorOccurredEvent` type, per `event-schema.md` §5.3
- [x] 1.3 Add `MaintenanceRequiredPayload` (`maintenanceType`, `reason` required) and `MaintenanceRequiredEvent` type, per `event-schema.md` §5.4
- [x] 1.4 Add `ProductionCompletedPayload` (`quantity` required, `batchId?`) and `ProductionCompletedEvent` type, per `event-schema.md` §5.5
- [x] 1.5 Widen `IMPLEMENTED_EVENT_TYPES` to all 5 MVP event types and add a `MachineEvent` union type covering all 5 event+payload combinations; remove the stale "this change implements TEMPERATURE_REPORTED only" file comment

## 2. Simulator (Event Ingestion)

- [x] 2.1 In `backend/src/simulator/simulator.service.ts`, add a payload validator per event type (`validateStatusChangedPayload`, `validateErrorOccurredPayload`, `validateMaintenanceRequiredPayload`, `validateProductionCompletedPayload`), each throwing `PAYLOAD_VALIDATION_FAILED` on missing required fields
- [x] 2.2 Dispatch to the correct validator based on `body.eventType` instead of always calling `validateTemperatureReportedPayload`
- [x] 2.3 Replace the `TemperatureReportedEvent`-only cast with the `MachineEvent` union type from task 1.5

## 3. Machine Service (Projection)

- [x] 3.1 In `backend/src/machines/machine-projection-consumer.service.ts`, replace the `if (event.eventType !== 'TEMPERATURE_REPORTED') return;` guard with a per-event-type dispatch (switch or if/else) covering all 5 types
- [x] 3.2 Implement `STATUS_CHANGED`: set `machine.status = event.payload.currentStatus` directly (bypassing `raiseSeverity`); if `currentStatus === 'WARNING'`, apply `healthScore -15` (clamped); otherwise no health-score change — per `design.md` Decision 1
- [x] 3.3 Implement `ERROR_OCCURRED`: `machine.status = raiseSeverity(machine.status, 'ERROR')`, `healthScore -30` (clamped)
- [x] 3.4 Implement `MAINTENANCE_REQUIRED`: `machine.status = raiseSeverity(machine.status, 'MAINTENANCE')`, `healthScore -20` (clamped)
- [x] 3.5 Implement `PRODUCTION_COMPLETED`: `machine.status = raiseSeverity(machine.status, 'RUNNING')`, `healthScore +2` (clamped), `machine.productionCount += event.payload.quantity`
- [x] 3.6 Confirm the existing `lastEventId`/idempotency check and `lastEventId`/`lastUpdatedAt` update at the end of `handleMessage` apply uniformly to all 5 branches (no per-type duplication)

## 4. Alert Service

- [x] 4.1 In `backend/src/alerts/alert-consumer.service.ts`, replace the `if (event.eventType !== 'TEMPERATURE_REPORTED') return;` guard with a per-event-type dispatch covering all 5 types
- [x] 4.2 Implement `ERROR_OCCURRED`: always create an alert with `severity: 'CRITICAL'`
- [x] 4.3 Implement `MAINTENANCE_REQUIRED`: always create an alert with `severity: 'WARNING'`
- [x] 4.4 Implement `STATUS_CHANGED`: create an alert with `severity: 'WARNING'` only when `payload.currentStatus === 'WARNING'`; no alert otherwise
- [x] 4.5 Implement `PRODUCTION_COMPLETED`: no alert (explicit no-op branch, not a silent fallthrough)
- [x] 4.6 Confirm the existing duplicate-key idempotency handling wraps all 4 new `alertModel.create` call sites, not just the `TEMPERATURE_REPORTED` one

## 5. Documentation Fix

- [x] 5.1 In `docs/design/machine-schema.md` §7, replace the undefined `isSensorFailure(event.payload.reason)` pseudocode call with a direct `event.payload.currentStatus == "WARNING"` check, and add a short note documenting this as the MVP sensor-failure rule (per `design.md` Decision 1 of this change)

## 6. Manual Verification (real running system, not just build)

- [x] 6.1 Rebuild and restart the `backend` container (`docker compose up -d --build backend`)
- [x] 6.2 POST a `STATUS_CHANGED` event with `currentStatus: "WARNING"` for a machine currently `RUNNING`; verify `202`, a `machine_events` doc is created, `machine.status` becomes `WARNING`, `healthScore` drops by 15, and an `ACTIVE`/`WARNING` alert is created
- [x] 6.3 POST a `STATUS_CHANGED` event with `currentStatus: "RUNNING"` for a machine currently `ERROR`; verify the severity-precedence bypass works — `status` actually becomes `RUNNING` despite `ERROR` having a higher rank — and confirm no alert is created and `healthScore` is unchanged
- [x] 6.4 POST an `ERROR_OCCURRED` event; verify `status` becomes `ERROR`, `healthScore` drops by 30, and a `CRITICAL` alert is created
- [x] 6.5 POST a `MAINTENANCE_REQUIRED` event; verify `status` becomes `MAINTENANCE`, `healthScore` drops by 20, and a `WARNING` alert is created
- [x] 6.6 POST a `PRODUCTION_COMPLETED` event with `quantity: 5` for a machine currently `IDLE`; verify `productionCount` increases by 5, `healthScore` increases by 2, `status` becomes `RUNNING`, and no alert is created
- [x] 6.7 POST a `PRODUCTION_COMPLETED` event for a machine currently `ERROR`; verify `status` remains `ERROR` while `healthScore` and `productionCount` still update (health score is independent of status-ranking, per `machine-schema.md` §5.2)
- [x] 6.8 Re-POST one already-processed `eventId`; verify no duplicate `machine_events`/`alerts` documents are created and the machine projection's health score/status is not double-applied
- [x] 6.9 GET `/machines/:id/events` and `/machines/:id/alerts` for a machine touched by the above events; verify all new event types and alerts appear correctly

## 7. OpenSpec Closeout

- [x] 7.1 Run `openspec validate remaining-mvp-event-types --strict` and confirm it passes
- [x] 7.2 Archive the change once all tasks above are complete and verified
