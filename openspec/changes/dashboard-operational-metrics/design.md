# Design: dashboard-operational-metrics

## Context

All inputs already exist in `machine_events` (immutable history) and `alerts`. The machines projection consumer (`machine-projection-consumer.service.ts`) already derives status changes from **multiple** event types (STATUS_CHANGED, ERROR_OCCURRED, MAINTENANCE_REQUIRED, over-threshold TEMPERATURE_REPORTED) per the Machine State Rules. The 2026-07-11 exploration identified utilization and rolling-24h production as the "pure computation" wave: no new event types, no `machine_events` schema changes.

## Goals / Non-Goals

**Goals:**

- Time-in-status (operating / stopped / idle) over a rolling 24h window, per machine and factory-wide.
- Rolling-24h production count on the dashboard.
- Active Alerts visible on the Dashboard; status tiles drill down to a filtered Machine List.
- All projections rebuildable from `machine_events` (key design rule 1 preserved).

**Non-Goals:**

- OEE proper (performance/quality legs need good/defect counts and ideal cycle times — later wave).
- Calendar-day windows and timezone configuration (rolling 24h sidesteps it; revisit when a real factory timezone exists).
- Alert acknowledgment lifecycle (Phase 2 commitment), alert-triggered navigation beyond machine links.
- Historical utilization charts (this change computes one window, not a time series).

## Decisions

### D1: Record status transitions in the projection consumer, not re-derive at query time

Utilization needs a status **timeline**, but projected status changes are driven by four event types under interpretation rules that live in the projection consumer. Re-deriving the timeline at query time would duplicate those rules (the codebase already had one bug-class from duplicated interpretation logic — see the sensor-failure contract test). Instead, the consumer appends to `machine_status_transitions` at the moment it changes a machine's status:

```
{ machineId, fromStatus, toStatus, at (event occurredAt), eventId }
unique index on eventId (idempotency, key design rule 4)
index { machineId: 1, at: -1 }
```

This is a projection, not new truth: rebuildable by replaying `machine_events` through the same consumer. Alternative considered — lifetime per-status counters on the machine doc: rejected, cannot answer windowed queries.

### D2: Rolling 24h window, computed on read

`GET /machines/:id/utilization` reconstructs the window: fetch transitions in `[now-24h, now]` plus the latest transition before the window start (to know the status at window start), then interval arithmetic. Buckets: **operating** = RUNNING + WARNING (machine producing, possibly degraded), **stopped** = ERROR + MAINTENANCE, **idle** = IDLE. Three buckets are reported; the UI labels them 運轉/停機/閒置. At 3 machines and a 20-event demo cadence this is trivial query load; a 300-machine deployment would precompute rollups (noted, not built).

**Bootstrap approximation:** machines whose current status predates any recorded transition (transitions only start accruing when this change deploys) are treated as having held their current status since the window start. Documented in the endpoint description; disappears naturally after 24h of transition history — and entirely after an event replay rebuild.

### D3: 24h production folded into `/dashboard/stats`, utilization too

`GET /dashboard/stats` response gains one additive key:

```json
"last24h": {
  "productionCount": 42,
  "operatingMs": 61200000,
  "stoppedMs": 4300000,
  "idleMs": 20900000
}
```

Production = aggregation over `PRODUCTION_COMPLETED` events with `occurredAt >= now-24h` (sum of `payload.quantity`); durations = sum of per-machine utilization. Additive change — existing consumers unaffected.

**Amended at apply time:** the original plan ("MachinesService consumes an exported EventsService method") would create a module cycle — `EventsModule` already imports `MachinesModule`. The stats route therefore moved to a new thin `dashboard/` composition module (`DashboardModule` → imports `MachinesModule` + `EventsModule`; `DashboardService` merges `getDashboardStats()` + `sumProductionSince()` + `getFactoryUtilization()`). This supersedes add-frontend-mvp design D4's "stats lives in the machines module" — that decision's premise (stats reads only the machines projection) stopped holding the moment 24h production entered the response. Composition-only modules are the API-layer aggregation role architecture.md §7.7 describes; `machines/` keeps owning `GET /machines/:id/utilization` since it reads only machine-owned data.

### D4: `GET /alerts` is a thin route over the existing internal read

`AlertsService.listAlerts({ status?, limit? })` already exists (built for insights). Add `AlertsListController` (`@Controller('alerts')`) exposing it with `status` and `limit` (default 20, capped) query params. Response shape identical to `GET /machines/:id/alerts`. This intentionally mirrors the events module's per-machine/cross-machine route pair.

### D5: Frontend drill-down via URL state

Status tiles navigate to `/machines?status=WARNING` etc.; Machine List reads the query param and filters client-side (3 machines — no server-side filter param needed yet; the URL shape is the stable interface). Active Alerts widget lists the top ACTIVE alerts (severity tag, machine link, message, relative time) polling on the 5s default. Machine Detail adds an utilization strip (three durations) from the per-machine endpoint.

## Code-review fixes (added 2026-07-11, after the 10-finding review)

### D6: Timestamps are validated at ingestion — strict canonical form

The review traced four correctness findings to one root cause: `occurredAt`/`producedAt` enter the system with only a null-check, while everything downstream (lexicographic window queries, transition sorting, Date.parse arithmetic) assumes canonical ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`). Fix at the source: simulator envelope validation requires the canonical regex plus `Number.isFinite(Date.parse(...))`, rejecting with the existing `400 INVALID_EVENT_ENVELOPE` — this enforces what api.md §2.3 already declares, using no new error code. Rejected alternative: accept-and-normalize (silently rewriting a producer's fact is more surprising than rejecting it).

### D7: Transition writes are best-effort; the primary projection always wins

Transitions are a rebuildable secondary projection — their write failure must never abort the machines projection update (the review showed a ValidationError there is classified as a poison pill, committing the offset and permanently losing the event's projection effect). The consumer's transition write now swallows **all** errors (logging non-duplicates as warnings) and always proceeds to `machine.save()`. Failure semantics verified: data errors → transition skipped + logged, projection preserved; transient Mongo errors → the subsequent `save()` fails too → rethrow → redelivery retries both (duplicate-key swallow keeps it idempotent). Defense-in-depth on read: `computeWindow` skips (and logs) transitions whose `at` fails to parse, and re-sorts parsed timestamps numerically in memory so the walk never depends on lexicographic order.

### D8: Query-parameter validation gets one documented error code

`status` on `GET /alerts` (and the per-machine route) is validated for membership in `ALERT_STATUSES` — inside `AlertsService.listAlerts` so every HTTP path is covered. New documented code `400 INVALID_QUERY_PARAMETER` (api.md §6): the existing codes couldn't be reused without repurposing (`PAYLOAD_VALIDATION_FAILED` is simulator-payload-specific), and silent-ignore would hide frontend typos as "no alerts".

### D9: Bootstrap approximation is surfaced, not silent

Utilization responses gain `approximate: boolean` — true only on the `?? currentStatus` fallback (zero transition records anywhere), which is exactly the fabricated case; a machine with a pre-window transition is real data. `last24h.approximate` is true when any machine's window is approximate. The frontend prefixes affected durations with `≈`.

### D10: Efficiency fixes now vs. scale path later

Now: `beforeWindow` is fetched only when no in-window transitions exist (`inWindow[0].fromStatus` already supplies the window-start status), and both transition queries use `.lean()` with a field projection — the common per-machine case drops from 2 queries to 1. Later (documented, not built): batching all machines into one in-window find + one grouped pre-window aggregation (2N+1 → 3), and response caching — the 300-machine path. Status-mutation encapsulation (review finding 8) is deferred the same way: `machine.status` has exactly one write path today; we extract a named `recordTransitionIfChanged` and record the contract in `machine-schema.md` ("any future status-mutating path MUST record a transition"), refactoring to an owned `applyStatus` only when Phase 2 actually adds a second path.

## Risks / Trade-offs

- [Transitions collection only starts accruing at deploy] → bootstrap approximation (D2) is mildly wrong for the first 24h; an event-replay rebuild (architecture.md §10.4) makes history complete whenever replay tooling lands.
- [Clock skew between `occurredAt` (simulator-supplied) and `now`] → durations use event `occurredAt` consistently; a simulator event dated in the past/future skews the window like it skews everything else in the MVP — acceptable.
- [Duplicate/out-of-order events] → `eventId` unique index makes writes idempotent; per-machine Kafka key preserves ordering (rule 5), so transitions arrive in order per machine.
- [Rolling window recomputed every poll (5s × pages open)] → interval arithmetic over ≤ dozens of transitions; negligible. Precompute only when machine count demands it.

## Open Questions

1. Should the Machine List surface per-machine 24h utilization columns too (not just Detail)? Lean no for now — table width; revisit after seeing the Detail strip.
2. Does the Active Alerts widget need a "view all" destination (a future Alerts page), or is the widget itself enough until Phase 2's ACK workflow forces a real page? (Widget-only for this change.)
