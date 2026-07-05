## Why

The walking skeleton (`backend-walking-skeleton`) proved the end-to-end pipeline (`simulator → Kafka → 3 consumers → MongoDB → REST API`) for exactly one of the 5 MVP event types, `TEMPERATURE_REPORTED`. The MVP is not feature-complete until the remaining 4 event types — `STATUS_CHANGED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED` — flow through the same pipeline, since `docs/product/mvp.md` and `docs/design/machine-schema.md` already document rules for all 5.

## What Changes

- Simulator validation (`SimulatorService`) accepts and payload-validates all 4 remaining event types instead of rejecting them with `UNSUPPORTED_EVENT_TYPE`.
- Event Service consumer persists all 4 remaining event types into `machine_events` unchanged (already type-agnostic at the storage level, but the consumed set expands).
- Machine Service consumer (`MachineProjectionConsumerService`) implements the per-event-type status/health-score rules from `docs/design/machine-schema.md` §4.3/§5.2:
  - `STATUS_CHANGED`: sets `status` to `payload.currentStatus` directly (the one event type allowed to override severity precedence, including downgrades); only creates a WARNING alert when the change reason is sensor failure.
  - `ERROR_OCCURRED`: sets `status` to `ERROR` (subject to severity precedence like other non-`STATUS_CHANGED` events), `healthScore -30`.
  - `MAINTENANCE_REQUIRED`: sets `status` to `MAINTENANCE` (subject to severity precedence), `healthScore -20`.
  - `PRODUCTION_COMPLETED`: sets `status` to `RUNNING` if severity precedence allows, `healthScore +2` (clamped at 100), `productionCount += payload.quantity`.
- Alert Service consumer (`AlertConsumerService`) creates alerts per event type: CRITICAL for `ERROR_OCCURRED`, WARNING for `MAINTENANCE_REQUIRED`, WARNING for `STATUS_CHANGED` only when the reason is sensor failure, no alert for `PRODUCTION_COMPLETED`.
- `IMPLEMENTED_EVENT_TYPES` in `backend/src/shared/types/machine-event.types.ts` expands from `['TEMPERATURE_REPORTED']` to all 5 MVP event types, with a new typed payload interface per event type.
- No new REST endpoints or route shapes — existing `GET /machines`, `GET /machines/:id`, `GET /machines/:id/events`, `GET /machines/:id/alerts` already return whatever exists in the collections regardless of which event type produced it.

## Capabilities

### New Capabilities

(none — this change extends existing capabilities to cover the remaining event types rather than introducing new ones)

### Modified Capabilities

- `machine-event-ingestion`: the "Reject an unsupported event type" requirement narrows to only the still-truly-unsupported case (there is none left in MVP scope); a new requirement covers payload validation for each of the 4 additional event types.
- `machine-state-projection`: the "Severity precedence is enforced" requirement changes from "only `STATUS_CHANGED` events may [downgrade status] (out of scope for this change)" to actually implementing that exception, plus new requirements for the `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, and `PRODUCTION_COMPLETED` status/health-score/production-count rules.
- `alert-detection`: new requirements for CRITICAL alerts on `ERROR_OCCURRED`, WARNING alerts on `MAINTENANCE_REQUIRED`, conditional WARNING alerts on `STATUS_CHANGED` (sensor-failure reason only), and no-alert on `PRODUCTION_COMPLETED`.
- `event-history`: the "Persist consumed events immutably" requirement broadens from `TEMPERATURE_REPORTED`-only to all 5 MVP event types (no scenario-level change, since persistence is already envelope-shape-agnostic).

## Impact

- **Code**: `backend/src/shared/types/machine-event.types.ts`, `backend/src/simulator/simulator.service.ts`, `backend/src/machines/machine-projection-consumer.service.ts`, `backend/src/machines/machine-status.util.ts`, `backend/src/alerts/alert-consumer.service.ts`. No changes expected to `events/` beyond the widened type union, and no changes to any controller or schema.
- **Specs**: `openspec/specs/{machine-event-ingestion,machine-state-projection,alert-detection,event-history}/spec.md` all gain delta specs in this change.
- **Docs**: `docs/design/machine-schema.md` §7 needs a small fix — its `isSensorFailure(reason)` pseudocode call is undefined (see `design.md` Decision 1); this change replaces it with a direct `currentStatus == "WARNING"` check and documents that as the MVP rule. `docs/design/event-schema.md` and `docs/design/architecture.md` §9.3 already specify everything else needed; no other doc changes anticipated.
- **Dependencies**: none new.
