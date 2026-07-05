## Why

The upcoming Vue frontend needs an Event Center screen showing a cross-machine, most-recent-first event timeline (`docs/product/mvp.md` §Event Center), plus a Dashboard "Recent Events" widget. The only event-read endpoint that exists today, `GET /machines/:id/events`, is scoped to a single machine — there is no way to fetch a factory-wide feed. This gap was identified while exploring the frontend's data requirements, before any frontend code exists, so it's being closed as its own small backend change ahead of the frontend work.

## What Changes

- Add `GET /events`, a top-level, cross-machine event history endpoint, reusing the same cursor-based pagination (`limit`, `before`) and response envelope (`data` + `pagination.nextCursor`/`hasMore`) as the existing `GET /machines/:id/events`.
- `GET /events` supports the same `eventType` filter as the scoped endpoint, plus a new optional `machineId` filter (so Event Center's own machine filter can call one endpoint instead of switching between two).
- `GET /machines/:id/events` is unchanged — both endpoints share the same underlying `EventsService` query logic, differing only in whether `machineId` is a fixed path parameter or an optional query filter.
- No new cross-machine `GET /alerts` endpoint. None of the 5 documented MVP screens (`docs/product/mvp.md`) need a factory-wide alerts feed — `Machine Detail` is the only alerts consumer and it's already served by `GET /machines/:id/alerts`. Added only if a real screen needs it later (YAGNI).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `event-history`: adds a new requirement for a cross-machine, paginated event query, alongside the existing per-machine one. No change to how events are persisted or to the existing per-machine requirement.

## Impact

- **Code**: `backend/src/events/events.service.ts` (refactor the query logic to accept an optional `machineId` instead of a required one), `backend/src/events/events.controller.ts` (new route), `backend/src/events/events.module.ts` (no change expected — same providers).
- **API contract**: `docs/design/api.md` gains a new §4.x entry for `GET /events`, and §3 Resource Overview's `Event` row can note both access paths.
- **Docs**: `docs/product/mvp.md`'s Event Center and Dashboard sections already anticipate this endpoint (no further doc changes needed there — see the Event Center rewrite from the prior explore session).
- **No frontend changes** — this change is backend-only, ahead of the separate Vue frontend change that will consume it.
