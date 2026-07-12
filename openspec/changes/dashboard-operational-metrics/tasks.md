# Tasks: dashboard-operational-metrics

## 1. Transitions projection

- [x] 1.1 Create `machine-status-transition.schema.ts` (`machine_status_transitions`): machineId, fromStatus, toStatus, at, eventId; unique index on eventId, index `{ machineId: 1, at: -1 }` (explicit `type: String` on the status enums per the Mongoose union-type gotcha)
- [x] 1.2 Append a transition record in the machines projection consumer wherever it changes projected status (all four driving event types); skip when status is unchanged; swallow duplicate-key on eventId (idempotency, reuse `isDuplicateKeyError`)
- [x] 1.3 Unit-test transition recording: change recorded with event's occurredAt, no record on unchanged status, duplicate eventId ignored

## 2. Utilization computation + endpoints

- [x] 2.1 Implement rolling-24h interval arithmetic in the machines module: fetch window transitions + latest pre-window transition, bucket into operatingMs (RUNNING+WARNING) / stoppedMs (ERROR+MAINTENANCE) / idleMs (IDLE), with the D2 bootstrap approximation (current status spans window when no transitions exist)
- [x] 2.2 Expose `GET /machines/:id/utilization` (404 MACHINE_NOT_FOUND on unknown id)
- [x] 2.3 Add an exported `EventsService` aggregation for 24h production sum (`PRODUCTION_COMPLETED`, occurredAt window, sum payload.quantity) — machines module consumes it per module-boundaries rule
- [x] 2.4 Extend `getDashboardStats()` with `last24h` (productionCount + summed utilization buckets; zeros on empty factory)
- [x] 2.5 Unit-test: timeline split sums to window length, no-transition fallback, empty factory zeros, production window sum excludes events older than 24h

## 3. Cross-machine alerts endpoint

- [x] 3.1 Add `AlertsListController` (`@Controller('alerts')`, GET with `status`/`limit`, default 20 with server cap) delegating to the existing `AlertsService.listAlerts`
- [x] 3.2 Unit-test: status filter passthrough, default/capped limit

## 4. Frontend

- [x] 4.1 API layer: add `getUtilization(machineId)`, `listAlerts({status, limit})`, extend `DashboardStats` type with `last24h`; add human-readable duration formatter
- [x] 4.2 Dashboard: Active Alerts widget (severity tag, machine link, message, relative time; polls); 24h production + operating/stopped/idle tiles/strip
- [x] 4.3 Dashboard: make Running/Warning/Critical tiles navigate to `/machines?status=...`
- [x] 4.4 Machine List: read `?status=` from the URL, filter client-side, show a clearable filter indicator
- [x] 4.5 Machine Detail: 24h utilization strip from `GET /machines/:id/utilization`

## 5. Documentation

- [x] 5.1 api.md: document `GET /machines/:id/utilization`, `GET /alerts`, and the extended `/dashboard/stats` response (including the D2 bootstrap approximation note)
- [x] 5.2 Update `ai/context/api-contract-summary.md` with the two new routes

## 6. Verification

- [x] 6.1 Docker Compose demo (verified 2026-07-11 via API drive + headless Chrome): send a status-changing event sequence (RUNNING → ERROR → RUNNING), confirm transitions recorded, utilization durations shift accordingly on Machine Detail and Dashboard, 24h production increments after PRODUCTION_COMPLETED, new CRITICAL alert appears in the Dashboard widget within one poll, Warning tile drills into the filtered Machine List

## 7. Code-review fixes (2026-07-11 review, design D6–D10)

- [x] 7.1 Simulator envelope validation: `occurredAt`/`producedAt` must match canonical `YYYY-MM-DDTHH:mm:ss.sssZ` and `Number.isFinite(Date.parse(...))`; reject with existing `400 INVALID_EVENT_ENVELOPE`; unit tests for offset-form, unparseable, empty, and canonical cases
- [x] 7.2 Consumer: transition write becomes best-effort — swallow all errors (log non-duplicates as warnings), always proceed to `machine.save()`; extract `recordTransitionIfChanged` private method; update the affected unit test (non-dup error no longer rethrows)
- [x] 7.3 `computeWindow` hardening: skip+log transitions with unparseable `at`; re-sort parsed timestamps numerically in memory; fetch `beforeWindow` only when `inWindow` is empty; add `.lean()` + field projection to both queries; update unit tests
- [x] 7.4 `sumProductionSince` → bounded window: add `$lte` upper bound (signature takes since+until); update DashboardService and tests
- [x] 7.5 `approximate` flag: per-machine utilization response + `last24h.approximate`; frontend renders `≈` prefix on approximate durations; update types + api.md §4.11/§4.12
- [x] 7.6 Alert status validation: membership check against `ALERT_STATUSES` in `AlertsService.listAlerts`, throwing new `400 INVALID_QUERY_PARAMETER`; document the code in api.md §6; unit tests (invalid, wrong-case, valid)
- [x] 7.7 format.ts: `formatDuration(0)` → `'0m'` (distinct from `<1m`), NaN → `'—'`; `formatRelativeTime` NaN guard → `'—'`
- [x] 7.8 Docs: add `machine_status_transitions` to `ai/context/mongodb-collections.md`; add `dashboard/` to architecture.md §14.1 and module-boundaries.md as the §7.7 API-layer composition module; add the status-write contract note to `docs/design/machine-schema.md`
- [x] 7.9 Full regression: backend tests, frontend build, Docker demo re-verify (reject a bad-timestamp event → 400; utilization/stats still correct; `?status=foo` → 400) — verified 2026-07-11: 55/55 tests, offset-form timestamp → 400 INVALID_EVENT_ENVELOPE, canonical → 202, status foo/lowercase → 400 INVALID_QUERY_PARAMETER, buckets sum to windowMs, per-machine approximate:false with history while factory approximate:true (bootstrap machines), '≈' renders on the dashboard tile
