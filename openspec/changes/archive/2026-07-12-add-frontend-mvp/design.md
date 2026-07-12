# Design: add-frontend-mvp

## Context

Every API the five MVP pages need already exists and matches `docs/design/api.md` (base URL `http://localhost:3000/api` — the global prefix was fixed in the add-insights-module review round). The mock LLM provider means the AI Summary cards work end-to-end without any API key. Stack decisions locked on 2026-07-10: Naive UI, TanStack Query with 5s polling, backend-served dashboard stats, Simulator as a first-class page.

Scale philosophy: 3 machines today, 300-machine vision — interfaces cut where the industry version cuts them (aggregate stats endpoint on the backend, typed API client boundary), implementations MVP-thin (no state library until client state exists, no codegen, no charts).

## Goals / Non-Goals

**Goals:**

- All five MVP pages functional per `docs/product/mvp.md`, demo scenario runnable start-to-finish in the browser.
- 5-second polling for machines / events / alerts-derived data; AI summaries fetched on demand and regenerated via explicit user action.
- `GET /dashboard/stats` backend aggregate: counts per machine status, total production count, average health score.
- AI failure isolation in the UI: summary card errors never blank the rest of a page.
- Frontend runs in Docker Compose alongside the backend.

**Non-Goals:**

- WebSocket/real-time push, authentication, alerts management UI (the alerts API exists but no MVP page lists alerts), charts/graphs, i18n, responsive/mobile layouts, E2E test automation (manual demo verification per `ai/rules/testing.md` interim policy).
- OpenAPI codegen for types (revisit when the backend gains spec generation; hand-copied types are the MVP cut).

## Decisions

### D1: Stack — Vite + Vue 3 + TS strict + Vue Router + vue-query + Naive UI; no Pinia

Server state (machines, events, stats, summaries) lives entirely in TanStack Query's cache; the MVP has no client-global state left over, so Pinia would hold nothing. Add it only when real client state appears. Naive UI provides the dashboard vocabulary (Card, DataTable, Tag, Statistic, Result) with full TypeScript support and tree-shaking.

Alternative considered: Pinia-first with hand-rolled fetch composables — rejected: vue-query's `refetchInterval`, cache invalidation, and loading/error states replace exactly the code we would otherwise write by hand.

### D2: Polling, not push — `refetchInterval: 5000`

Machines list, machine detail, events, and dashboard stats queries poll every 5s (one `QueryClient` default, per-query opt-out). AI summary queries do NOT poll — they refetch on mount and are invalidated after a successful `POST .../summary`. The demo's worst-case wait after sending an event is one poll cycle. WebSocket remains a Phase 2 roadmap item; the query-key structure (`['machines']`, `['machine', id]`, `['events', filters]`) is the seam where push-invalidation would later plug in.

### D3: Typed API client — thin fetch wrapper + hand-copied contract types

`frontend/src/api/` holds: `client.ts` (fetch wrapper reading `VITE_API_BASE_URL`, parses the `{ error: { code, message } }` envelope into a typed `ApiError`), `types.ts` (request/response shapes hand-copied from `docs/design/api.md` §5, each annotated with its api.md section), and one module per resource (`machines.ts`, `events.ts`, `summaries.ts`, `simulator.ts`, `stats.ts`). No codegen at 7 endpoints; the annotation discipline keeps drift findable.

### D4: `GET /dashboard/stats` lives in the machines module

The aggregate reads only the `machines` projection (status counts, `productionCount` sum, `healthScore` average), and module-boundaries rules say the owner of the data serves it. Implemented as a single MongoDB aggregation pipeline in `MachinesService.getDashboardStats()` exposed by a new `DashboardController` (`@Controller('dashboard')`) inside `machines/`. Response shape:

```json
{
  "machineCount": 3,
  "statusCounts": { "RUNNING": 1, "IDLE": 0, "WARNING": 1, "ERROR": 0, "MAINTENANCE": 1 },
  "totalProductionCount": 145,
  "averageHealthScore": 62.7
}
```

All five statuses always present (zero-filled) so the frontend never branches on missing keys. The mvp.md "Critical Machines" tile maps to `statusCounts.ERROR`. Alternative considered: separate `dashboard/` module — rejected: it would own no data and exist only to import MachinesService.

### D5: Simulator page constructs the full envelope client-side

Per api.md §4.8 the simulator owns envelope construction: the page generates `eventId` (`evt_` + `crypto.randomUUID()`), `occurredAt`/`producedAt` (now, ISO), `correlationId`, `schemaVersion: 1`, `source: "MACHINE_SIMULATOR"`, and renders per-event-type payload fields (temperature/unit, errorCode/recoverable, currentStatus/reason, …) driven by one config map — adding an event type later means one config entry, not a new form.

### D6: AI summary UX — advisory, explicit, isolated

Summary cards (Dashboard factory-scope, Machine Detail machine-scope) render three states: loaded summary (+ `recommendedActions` list + regenerate button), `404 SUMMARY_NOT_FOUND` → empty state with a "Generate" call-to-action, `502 LLM_CALL_FAILED` → inline error with retry, page otherwise unaffected. The POST button shows a loading state for the synchronous LLM call's duration.

### D7: Event Center colors by eventType only

Row tags map `eventType → color` (e.g. `ERROR_OCCURRED` red, `MAINTENANCE_REQUIRED` orange, `PRODUCTION_COMPLETED` green) — no severity derivation, preserving the fact/interpretation split documented in `docs/product/mvp.md` ("Why There Is No Severity Column"). Pagination via the API's `before` cursor with a "Load more" button.

### D8: Compose runs the Vite dev server; CORS enabled on the backend

`frontend/Dockerfile` runs `npm run dev -- --host` on :5173 (matches the commented compose placeholder; hot-reload keeps the container useful during development — a production build stage is a later concern). The browser calls `:3000` directly, so `main.ts` adds `app.enableCors()` (open, consistent with api.md §2.6's no-auth MVP posture).

## Risks / Trade-offs

- [5s polling multiplies request volume (4-5 queries × pages open)] → Fine for one demo user; vue-query dedupes identical keys and pauses polling on hidden tabs by default. The 300-machine answer is Phase 2's WebSocket, not faster polling.
- [Hand-copied types drift from api.md] → Each type carries its api.md §-reference; the doc-sync rule makes contract edits touch api.md, and grep-by-section finds the frontend twin. Codegen when endpoint count justifies it.
- [Open CORS] → Matches the MVP's explicit no-auth scope; revisit with Phase 2 auth.
- [`averageHealthScore` on empty machines collection divides by zero] → Aggregation returns zero-filled shape with `machineCount: 0` and `averageHealthScore: null`; frontend renders "—".
- [Naive UI locks visual language] → Acceptable; theming via its ConfigProvider if branding lands later.

## Open Questions

1. Machine Detail shows recent events inline — reuse the Event Center's table component filtered by machine, or a lighter list? (Decide at implementation; lean reuse.)
2. Should the Dashboard's "Recent Events" widget deep-link into Event Center with a machine filter? (Nice-to-have; not blocking.)
