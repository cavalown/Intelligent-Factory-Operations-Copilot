## Context

`backend/src/events/events.service.ts`'s `listEventsForMachine(machineId, query)` already implements cursor-based pagination correctly for the whole collection: the cursor lookup (`findOne({ eventId: query.before })`) and sort (`{ _id: -1 }`) both operate on the full `machine_events` collection, not a per-machine subset — `machineId` is applied only as an additional `find()` filter. This means the existing pagination logic already generalizes to a cross-machine feed; the only required change is making the `machineId` filter optional instead of mandatory, and adding a second route that doesn't supply it.

This design was worked out during an explore session before any code was written — see the discussion that led to `docs/product/mvp.md`'s Event Center rewrite (removing the `Severity` column) for why this endpoint is scoped to raw events only, with no derived alert data.

## Goals / Non-Goals

**Goals:**
- Add `GET /events` (cross-machine), sharing pagination/cursor logic with the existing `GET /machines/:id/events`.
- Keep `GET /machines/:id/events`'s behavior and response shape byte-for-byte identical — this is a pure addition, not a breaking change.
- Support an optional `machineId` query filter on the new endpoint so Event Center's own machine filter doesn't need to call a different endpoint.

**Non-Goals:**
- No cross-machine `GET /alerts` endpoint (see proposal's YAGNI rationale).
- No new persistence, indexes, or schema changes — `machine_events` already has what's needed (default `_id` ordering, existing `machineId` field).
- No frontend work in this change.

## Decisions

### 1. One shared service method, two controllers

NestJS binds a controller to a single path prefix, so `/machines/:id/events` and `/events` need separate controller classes. Rather than duplicate query logic, `EventsService` gets one method:

```typescript
async listEvents(query: {
  machineId?: string;
  limit?: string;
  before?: string;
  eventType?: string;
}): Promise<{ data: EventResponse[]; pagination: PaginationMeta }>
```

- `EventsController` (`@Controller('machines/:id/events')`) calls `listEvents({ machineId: id, ...query })` and validates `machineId` exists first (404 `MACHINE_NOT_FOUND`), exactly as today.
- A new `EventsListController` (`@Controller('events')`) calls `listEvents(query)` directly, with `machineId` coming from an optional query param. If a `machineId` is supplied and doesn't exist, it still 404s with `MACHINE_NOT_FOUND` for consistency; if omitted, no existence check runs (there's nothing to validate against).

Alternative considered: keep two separate service methods (`listEventsForMachine` and `listAllEvents`) to avoid touching working code. Rejected — the query-building logic (cursor lookup, sort, limit+1/hasMore trick) would be duplicated verbatim, and any future change to pagination behavior would need to be made twice.

### 2. `machineId` filter is applied the same way for both routes

The generalized method builds `filter.machineId = query.machineId` only `if (query.machineId)`, otherwise the `find()` runs unfiltered across all machines. This is the only functional change from the current implementation — everything else (`eventType` filter, cursor `_id` lookup, `limit + 1`/`hasMore` pagination) is copied over unchanged.

### 3. Response shape is identical between both endpoints

Both return `{ data: [...], pagination: { limit, nextCursor, hasMore } }` with the same per-event fields (`eventId`, `eventType`, `schemaVersion`, `source`, `machineId`, `occurredAt`, `producedAt`, `correlationId`, `payload`). The cross-machine response includes `machineId` per event (already does, since it's part of the envelope) so the frontend's Event Center can show the "Machine" column without a second lookup.

## Risks / Trade-offs

- **[Risk] `GET /events` with no filters and a large `machine_events` collection could return a lot of data over time.** → **Mitigation**: same `limit`/`before` cursor pagination as the scoped endpoint already bounds this; default `limit` (20) and max (100) apply identically. No different risk profile than the existing endpoint, just a wider result set per page.
- **[Risk] Two controllers calling one service method could drift if someone edits one call site's query construction without checking the other.** → **Mitigation**: both call sites pass through to the same `listEvents()` signature; a code reviewer following `ai/rules/module-boundaries.md` should catch any asymmetry, and this design doc records the intended parity for future reference.

## Migration Plan

No data migration. Purely additive: `GET /machines/:id/events` keeps working unchanged; `GET /events` is a new route. Deploy as a normal backend rebuild.
