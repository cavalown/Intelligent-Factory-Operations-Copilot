# Proposal: dashboard-operational-metrics

## Why

The Dashboard currently shows static aggregates (status counts, cumulative production, average health) that carry little operational meaning at 3 machines — the 2026-07-11 exploration concluded it reads as "an event viewer, not a monitoring page". The data to fix this is **already recorded** (full `STATUS_CHANGED`/`PRODUCTION_COMPLETED`/alert history); what's missing is time-windowed computation and actionable surfaces. This change adds utilization (runtime/downtime), rolling-24h production, an Active Alerts widget, and tile drill-down — the highest-value slice that needs no new event types and no schema extensions to `machine_events`.

## What Changes

- **Record machine status transitions**: the machines projection consumer appends a `(machineId, fromStatus, toStatus, at, eventId)` record to a new `machine_status_transitions` collection whenever a machine's projected status changes — a rebuildable projection, idempotent on `eventId`, enabling time-in-status arithmetic.
- **Utilization computation** over a rolling 24-hour window: operating time (`RUNNING` + `WARNING`), stopped time (`ERROR` + `MAINTENANCE`), idle time (`IDLE`), per machine (`GET /machines/:id/utilization`) and factory-wide (folded into `GET /dashboard/stats`).
- **Rolling-24h production count** (sum of `PRODUCTION_COMPLETED` quantities in the window) added to `GET /dashboard/stats`.
- **Cross-machine alerts endpoint**: expose the existing internal `AlertsService.listAlerts` over HTTP as `GET /alerts?status=&limit=` — the Dashboard's Active Alerts widget reads it.
- **Frontend**: Dashboard gains an Active Alerts widget and 24h production/utilization tiles; status tiles become clickable, navigating to Machine List filtered by status (new `?status=` filter); Machine Detail shows its machine's 24h utilization.
- Docs: `docs/design/api.md` and `ai/context/api-contract-summary.md` gain the new/extended endpoints.

Explicitly not in scope (recorded for later waves, per the exploration): good/defect production split, power/current sensing events, error-code registry, alert acknowledgment lifecycle (Phase 2), error-recovery tracking, timezone-aware "calendar day" windows (rolling 24h avoids the timezone question).

## Capabilities

### New Capabilities

- `machine-utilization`: status-transition projection and rolling-24h time-in-status computation, served per machine and factory-wide.

### Modified Capabilities

- `dashboard-stats`: response gains `last24h` aggregates (production count, operating/stopped/idle durations). (Delta adds requirements; existing stats requirements unchanged.)
- `alert-detection`: alerts become queryable across machines (`GET /alerts`), not only per machine.
- `operator-ui`: Dashboard Active Alerts widget, clickable status tiles → filtered Machine List, utilization display on Dashboard and Machine Detail.

## Impact

- **Code**: backend `machines` module (transition recording in the projection consumer, utilization service + endpoint, extended stats), `alerts` module (HTTP route for cross-machine reads); frontend Dashboard/MachineList/MachineDetail pages and API layer.
- **API**: new `GET /machines/:id/utilization`, new `GET /alerts`, extended `GET /dashboard/stats` response (additive).
- **Database**: new `machine_status_transitions` collection (projection — rebuildable from `machine_events`).
- **Docs**: api.md, api-contract-summary.md.
- **Dependencies**: none new.
- **Sequencing**: builds on `add-frontend-mvp` (still active/unarchived); its `dashboard-stats`/`operator-ui` delta specs are extended here via ADDED requirements, so archive order is not blocking.
