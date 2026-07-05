## 1. Backend Service

- [x] 1.1 In `backend/src/events/events.service.ts`, generalize `listEventsForMachine(machineId, query)` into `listEvents(query: { machineId?: string; limit?: string; before?: string; eventType?: string })`, applying the `machineId` filter only when present
- [x] 1.2 Keep the machine-existence check (`assertMachineExists`, 404 `MACHINE_NOT_FOUND`) gated on `machineId` being present — skip it when `machineId` is omitted
- [x] 1.3 Confirm cursor pagination (`before` lookup via `findOne({ eventId })`, `sort({ _id: -1 })`, `limit + 1`/`hasMore` slicing) is unchanged and still collection-wide, per `design.md` Decision 1

## 2. Backend Controllers

- [x] 2.1 Update `backend/src/events/events.controller.ts` (`@Controller('machines/:id/events')`) to call the generalized `listEvents({ machineId: id, ...query })`
- [x] 2.2 Add a new `EventsListController` (`@Controller('events')`) with a `GET` route calling `listEvents(query)`, reading `machineId`, `eventType`, `limit`, `before` from query params
- [x] 2.3 Register the new controller in `backend/src/events/events.module.ts`

## 3. API Contract Documentation

- [x] 3.1 Add a new `GET /events` entry to `docs/design/api.md` §4 (as §4.4, renumbering the existing §4.4–§4.7 to §4.5–§4.8), documenting query params (`limit`, `before`, `eventType`, `machineId`), response shape (identical envelope to §4.3), and the `404 MACHINE_NOT_FOUND` case when an unknown `machineId` filter is supplied
- [x] 3.2 Update `docs/design/api.md` §3 Resource Overview's `Event` row to note both access paths (per-machine and cross-machine)

## 4. Manual Verification (real running system, not just build)

- [x] 4.1 Rebuild and restart the `backend` container (`docker compose up -d --build backend`)
- [x] 4.2 GET `/events` with no query params; verify it returns events across multiple machines (not just one), most-recent-first, with correct pagination metadata
- [x] 4.3 GET `/events?machineId=M-001`; verify the response matches `GET /machines/M-001/events` exactly (same events, same shape)
- [x] 4.4 GET `/events?eventType=ERROR_OCCURRED`; verify only that event type is returned, across machines
- [x] 4.5 GET `/events?machineId=M-999` (unknown machine); verify `404` with `MACHINE_NOT_FOUND`
- [x] 4.6 GET `/machines/M-001/events` (existing endpoint); verify it still works unchanged, confirming no regression
- [x] 4.7 Test cursor pagination on `/events` (`limit=2` then follow `nextCursor` via `before`); verify no duplicate or skipped events across pages

## 5. OpenSpec Closeout

- [x] 5.1 Run `openspec validate add-cross-machine-events-endpoint --strict` and confirm it passes
- [x] 5.2 Archive the change once all tasks above are complete and verified
