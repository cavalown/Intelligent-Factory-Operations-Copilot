# Tasks: add-frontend-mvp

## 1. Backend: dashboard stats + CORS

- [x] 1.1 Implement `MachinesService.getDashboardStats()` as one aggregation pipeline (zero-filled `statusCounts` for all five statuses, `machineCount`, `totalProductionCount`, `averageHealthScore` with `null` on empty collection)
- [x] 1.2 Add `DashboardController` (`@Controller('dashboard')`, `GET /dashboard/stats`) in the machines module and register it
- [x] 1.3 Unit-test the stats aggregation: mixed statuses, empty collection, post-event status change (spec scenarios)
- [x] 1.4 Enable CORS in `backend/src/main.ts` (open, per api.md §2.6 no-auth MVP)
- [x] 1.5 Document `GET /dashboard/stats` in `docs/design/api.md` (§4 endpoint + §5 data model) and add it to `ai/context/api-contract-summary.md`

## 2. Frontend scaffold

- [x] 2.1 Scaffold `frontend/` with Vite (vue-ts template), TypeScript strict; add vue-router, @tanstack/vue-query, naive-ui; wire QueryClient with `refetchInterval: 5000` default and router with the five routes
- [x] 2.2 Build the API layer: `api/client.ts` (fetch wrapper on `VITE_API_BASE_URL`, parses `{error:{code,message}}` into typed `ApiError`), `api/types.ts` (contract types annotated with api.md § references), resource modules (machines, events, summaries, simulator, stats)
- [x] 2.3 App shell: layout with nav (Dashboard, Machines, Event Center, Simulator), route views, Naive UI providers (message/dialog/theme)
- [x] 2.4 Add `frontend/Dockerfile` (Vite dev server, `--host`, :5173), uncomment/finalize the `frontend` service in `docker-compose.yml`, document in `docs/deployment/docker-compose.md`

## 3. Pages

- [x] 3.1 Dashboard: stat tiles from `/dashboard/stats` (Critical = ERROR), recent-events widget, factory AI Summary Card (D6 states: loaded / empty-generate / 502-retry)
- [x] 3.2 Machine List: table from `GET /machines` (name, status tag, temperature, health score, last updated), row click → detail route
- [x] 3.3 Machine Detail: profile + status + health from `GET /machines/:id`, recent events (`GET /machines/:id/events`), machine AI Summary card (same D6 component), not-found state for unknown id
- [x] 3.4 Event Center: timeline table from `GET /events`, eventType-only color tags (D7), "Load more" via `before` cursor
- [x] 3.5 Simulator: machine picker (from `GET /machines`), event-type select, per-type payload fields from one config map (D5), envelope construction, submit with 202/error feedback preserving form state

## 4. Cross-cutting behavior

- [x] 4.1 Shared AI Summary card component: GET on mount (no polling), POST with loading state, invalidate its query on success, 404 → generate CTA, 502 → inline error + retry
- [x] 4.2 Loading and error states for every page query (Naive UI skeletons/Result); confirm polling pauses on hidden tabs (vue-query default) and summary queries never poll

## 5. Verification

- [x] 5.1 Run the full mvp.md demo scenario in the browser against Docker Compose — verified 2026-07-11 via headless Chrome (Playwright): Dashboard tiles/events/AI card render with data, Machine List → Detail navigation, Event Center timeline with eventType-only colors, Simulator published a TEMPERATURE_REPORTED event through the UI form (202 confirmed), machine status/stat changes appear within one poll, unknown machine id shows the not-found state; no unexpected console errors. The runtime 502-isolation click-through remains impossible with the mock provider (it cannot fail) — covered by the AiSummaryCard error-branch design and deferred to insights task 2.2b's real adapter
