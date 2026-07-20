# Tasks: add-alert-lifecycle

## 1. Schema

- [x] 1.1 Add `'ACKNOWLEDGED'` to `ALERT_STATUSES` in `backend/src/alerts/schemas/alert.schema.ts`, positioned between `'ACTIVE'` and `'RESOLVED'`
- [x] 1.2 Add `acknowledgedAt: string | null` (default `null`) to the `Alert` schema, mirroring the existing `resolvedAt` prop

## 2. Service: transition logic

- [x] 2.1 `AlertsService.acknowledgeAlert(machineId, alertId)`: `assertExists(machineId)` (404 `MACHINE_NOT_FOUND`) → find alert by `{ alertId, machineId }` (404 `ALERT_NOT_FOUND` if no match) → if `status === 'RESOLVED'`, throw `ApiError(409, 'INVALID_ALERT_TRANSITION', ...)` → if `status === 'ACTIVE'`, set `status: 'ACKNOWLEDGED'` and `acknowledgedAt` to now, save → return the updated (or unchanged, for the already-`ACKNOWLEDGED` no-op case) alert via the existing `toResponse` shape
- [x] 2.2 `AlertsService.resolveAlert(machineId, alertId)`: same lookup pattern → if `status` is `ACTIVE` or `ACKNOWLEDGED`, set `status: 'RESOLVED'` and `resolvedAt` to now (leave `acknowledgedAt` as-is), save → if already `RESOLVED`, no-op → return the alert
- [x] 2.3 Extend `AlertsService.listAlerts`'s `status` validation to accept a comma-separated list: split on `,`, validate every segment against `ALERT_STATUSES` (400 `INVALID_QUERY_PARAMETER` if any segment is invalid), build the Mongo filter with `$in` when more than one valid value is present

## 3. Controller: new routes

- [x] 3.1 Add `POST /machines/:id/alerts/:alertId/acknowledge` to `AlertsController` (`@HttpCode(HttpStatus.OK)`, matching the `insights` controllers' POST-returns-200 convention — this is a state mutation with a meaningful response body, not a `202`-style fire-and-forget like the simulator)
- [x] 3.2 Add `POST /machines/:id/alerts/:alertId/resolve` to `AlertsController`, same pattern

## 4. Docs

- [x] 4.1 `docs/design/api.md`: added §4.14/§4.15 for both new endpoints (request/response shape, error cases) following the existing §4 contract style; updated §5.3's `Alert` field table with `acknowledgedAt`; updated §6's error table with `404 ALERT_NOT_FOUND` and `409 INVALID_ALERT_TRANSITION`; removed the `resolve` line from §8's "Future Endpoints" (now implemented) (+ zh-TW twin, full parity including the two new §4.14/§4.15 sections)
- [x] 4.2 `docs/design/architecture.md` §12.3: added `acknowledgedAt` to the `alerts` collection's core fields list (+ zh-TW twin)
- [x] 4.3 Confirmed no other enumerated doc needs the new error codes or endpoints (no new Kafka topic, no new module, no new env var — this change is entirely within the existing `alerts/` module)

## 5. Frontend

- [x] 5.1 `frontend/src/api/types.ts`: added `'ACKNOWLEDGED'` to `Alert['status']`'s union, added `acknowledgedAt: string | null`
- [x] 5.2 `frontend/src/api/alerts.ts`: added `acknowledgeAlert(machineId, alertId)` and `resolveAlert(machineId, alertId)`; `listAlerts`'s `status` param now accepts a single status or an array (joined with `,`)
- [x] 5.3 `frontend/src/components/ActiveAlertsCard.vue`: query changed to `['ACTIVE', 'ACKNOWLEDGED']`; Acknowledge (only on `ACTIVE` rows) and Resolve (both) buttons added via `useMutation`, invalidating the `['alerts']` query key on success; `ACKNOWLEDGED` rows get a muted tag distinguishing them from `ACTIVE`

## 6. Verification

- [x] 6.1 Unit tests added in `backend/src/alerts/alert-lifecycle.spec.ts`: `ACTIVE`→acknowledge→`ACKNOWLEDGED`; `ACKNOWLEDGED`→acknowledge→no-op; `RESOLVED`→acknowledge→409; `ACTIVE`→resolve→`RESOLVED` (skip-ack path, `acknowledgedAt` stays `null`); `ACKNOWLEDGED`→resolve→`RESOLVED` (`acknowledgedAt` preserved); `RESOLVED`→resolve→no-op; unknown `machineId` → 404 (alert never queried); `alertId` belonging to a different machine → 404. All pass.
- [x] 6.2 Tests added in `backend/src/alerts/status-validation.spec.ts`: `status=ACTIVE,foo` rejected; `status=ACTIVE,ACKNOWLEDGED` queries Mongo with `{ status: { $in: [...] } }`; single-value `status=ACTIVE` still queries with the bare value (unchanged shape). All pass.
- [x] 6.3 Live demo flow against the running Docker stack (not just unit tests). API layer: triggered a `TEMPERATURE_REPORTED` event via `POST /simulator/events`, confirmed the resulting alert; acknowledged it (200, `status: ACKNOWLEDGED`, `acknowledgedAt` set); re-acknowledged (200, no-op, same `acknowledgedAt`); resolved it (200, `status: RESOLVED`, `acknowledgedAt` preserved, `resolvedAt` set); tried acknowledging the resolved alert (409 `INVALID_ALERT_TRANSITION`); re-resolved (200, no-op). Also confirmed: unknown `machineId` → 404 `MACHINE_NOT_FOUND`; a real `alertId` from a *different* machine's path → 404 `ALERT_NOT_FOUND`; `GET /alerts?status=ACTIVE,ACKNOWLEDGED` returns matching alerts; `status=ACTIVE,foo` → 400.
  Browser layer: installed Playwright + Chromium (not a project dependency, run from a scratch dir) and drove the actual running Dashboard at `localhost:5173` end to end — triggered a fresh alert, loaded the page, clicked the real "Acknowledge" button on its row: the row re-rendered with an `ACKNOWLEDGED` tag, the "Acknowledge" button disappeared, "Resolve" remained. Clicked "Resolve": the row disappeared from the widget entirely (query excludes `RESOLVED`). Zero browser console errors across the whole flow. This confirms the actual click → mutation → cache-invalidation → re-render loop works, not just that the code compiles.
- [x] 6.4 Full regression: backend `npm run build` / `npm run lint` (0 errors, 1 pre-existing unrelated warning) / `npm test` (66/66 passing across 14 suites, up from 55/13) all clean. Frontend `vue-tsc -b && vite build` clean (the first attempt failed under the environment's default Node 18.16 — `vite`/`rolldown` require Node ≥20 — and succeeded under Node 22.16; not a regression from this change, a pre-existing environment constraint). `openspec validate add-alert-lifecycle --strict` and `openspec validate --all` (12/12) both pass.
