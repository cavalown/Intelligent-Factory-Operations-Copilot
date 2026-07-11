# Proposal: add-frontend-mvp

## Why

The backend MVP is functionally complete (machines, events, alerts, simulator ingestion, AI summaries at both scopes — all verified against `docs/design/api.md`), but nothing renders it: `frontend/` does not exist, and the MVP's Definition of Done requires a Dashboard, Machine List, Machine Detail, Event Center, and Simulator UI (`docs/product/mvp.md`). This change builds the Vue 3 dashboard so the full demo scenario can run end-to-end in a browser.

## What Changes

- Create `frontend/` — a Vue 3 + TypeScript (strict) app built with Vite, styled with Naive UI, using Vue Router and TanStack Query (vue-query) for data fetching with 5-second polling (WebSocket is out of MVP scope; polling delivers the demo's "send event → see status change" loop).
- Implement the five MVP views: Dashboard (factory stats, recent events, AI Summary Card), Machine List, Machine Detail (info, status, health, recent events, AI summary with manual regenerate), Event Center (cross-machine timeline, color-coded by `eventType` only — no severity column, per `docs/product/mvp.md`), Simulator (form that builds full event envelopes and POSTs them).
- Add one backend endpoint: `GET /dashboard/stats` (machine counts by status, total production count, average health score) so the Dashboard reads a single aggregate instead of client-side aggregation — decided 2026-07-10 to make the interface 300-machine-shaped now.
- Enable CORS on the backend (Vite dev server on :5173 calls the API on :3000).
- Treat AI summary as an advisory feature in the UI: a `502 LLM_CALL_FAILED` shows an inline error on the summary card only; machine/event data keeps rendering (`architecture.md` §16).
- Wire `frontend` into `docker-compose.yml` (currently a commented-out placeholder) with `VITE_API_BASE_URL`.
- Update `docs/design/api.md` and `ai/context/api-contract-summary.md` with the new stats endpoint.

## Capabilities

### New Capabilities

- `dashboard-stats`: Backend aggregation read — machine counts by status, total production count, and average health score served from the machines projection.
- `operator-ui`: The five-page operator dashboard — page contents, polling behavior, AI-failure isolation, event-type-only coloring, and simulator event construction.

### Modified Capabilities

None — existing backend capabilities are consumed as-is (`ai-summary`, `machine-state-projection`, `event-history`, `alert-detection` requirements do not change).

## Impact

- **Code**: new `frontend/**` (Vite app); backend `machines` module gains a stats query + `dashboard` controller route; `backend/src/main.ts` gains `enableCors`.
- **API**: one new route `GET /dashboard/stats`; no changes to existing routes.
- **Docs**: `docs/design/api.md` (new §4 endpoint section), `ai/context/api-contract-summary.md`, `docs/deployment/docker-compose.md` (frontend service now real).
- **Infra**: `docker-compose.yml` frontend service uncommented; new `frontend/Dockerfile`.
- **Dependencies**: frontend package tree (vue, vue-router, @tanstack/vue-query, naive-ui, vite, typescript); no new backend dependencies.
- **Sequencing**: depends on the completed `add-insights-module` implementation (still active pending its follow-up task 2.2b — the mock LLM provider is sufficient for all frontend work).
