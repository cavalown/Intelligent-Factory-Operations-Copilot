# Tasks: dashboard-operational-metrics

## 1. Transitions projection

- [ ] 1.1 Create `machine-status-transition.schema.ts` (`machine_status_transitions`): machineId, fromStatus, toStatus, at, eventId; unique index on eventId, index `{ machineId: 1, at: -1 }` (explicit `type: String` on the status enums per the Mongoose union-type gotcha)
- [ ] 1.2 Append a transition record in the machines projection consumer wherever it changes projected status (all four driving event types); skip when status is unchanged; swallow duplicate-key on eventId (idempotency, reuse `isDuplicateKeyError`)
- [ ] 1.3 Unit-test transition recording: change recorded with event's occurredAt, no record on unchanged status, duplicate eventId ignored

## 2. Utilization computation + endpoints

- [ ] 2.1 Implement rolling-24h interval arithmetic in the machines module: fetch window transitions + latest pre-window transition, bucket into operatingMs (RUNNING+WARNING) / stoppedMs (ERROR+MAINTENANCE) / idleMs (IDLE), with the D2 bootstrap approximation (current status spans window when no transitions exist)
- [ ] 2.2 Expose `GET /machines/:id/utilization` (404 MACHINE_NOT_FOUND on unknown id)
- [ ] 2.3 Add an exported `EventsService` aggregation for 24h production sum (`PRODUCTION_COMPLETED`, occurredAt window, sum payload.quantity) — machines module consumes it per module-boundaries rule
- [ ] 2.4 Extend `getDashboardStats()` with `last24h` (productionCount + summed utilization buckets; zeros on empty factory)
- [ ] 2.5 Unit-test: timeline split sums to window length, no-transition fallback, empty factory zeros, production window sum excludes events older than 24h

## 3. Cross-machine alerts endpoint

- [ ] 3.1 Add `AlertsListController` (`@Controller('alerts')`, GET with `status`/`limit`, default 20 with server cap) delegating to the existing `AlertsService.listAlerts`
- [ ] 3.2 Unit-test: status filter passthrough, default/capped limit

## 4. Frontend

- [ ] 4.1 API layer: add `getUtilization(machineId)`, `listAlerts({status, limit})`, extend `DashboardStats` type with `last24h`; add human-readable duration formatter
- [ ] 4.2 Dashboard: Active Alerts widget (severity tag, machine link, message, relative time; polls); 24h production + operating/stopped/idle tiles/strip
- [ ] 4.3 Dashboard: make Running/Warning/Critical tiles navigate to `/machines?status=...`
- [ ] 4.4 Machine List: read `?status=` from the URL, filter client-side, show a clearable filter indicator
- [ ] 4.5 Machine Detail: 24h utilization strip from `GET /machines/:id/utilization`

## 5. Documentation

- [ ] 5.1 api.md: document `GET /machines/:id/utilization`, `GET /alerts`, and the extended `/dashboard/stats` response (including the D2 bootstrap approximation note)
- [ ] 5.2 Update `ai/context/api-contract-summary.md` with the two new routes

## 6. Verification

- [ ] 6.1 Docker Compose demo: send a status-changing event sequence (RUNNING → ERROR → RUNNING), confirm transitions recorded, utilization durations shift accordingly on Machine Detail and Dashboard, 24h production increments after PRODUCTION_COMPLETED, new CRITICAL alert appears in the Dashboard widget within one poll, Warning tile drills into the filtered Machine List
