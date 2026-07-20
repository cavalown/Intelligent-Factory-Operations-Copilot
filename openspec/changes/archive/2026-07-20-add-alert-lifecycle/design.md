## Context

`Alert.status` (`backend/src/alerts/schemas/alert.schema.ts`) is currently `ACTIVE` | `RESOLVED`, but nothing in the codebase ever writes `RESOLVED` or sets `resolvedAt` — both exist in the schema as unused scaffolding for a feature that was deferred. `docs/design/api.md` §8 already anticipated one endpoint (`POST /machines/:id/alerts/:alertId/resolve`, "Phase 2 — incident management") but not an acknowledge step; `docs/product/product-roadmap.md`'s Phase 2 entry names the feature "Alert Acknowledgment & Resolution Workflow," which implies both actions. The only place alerts are surfaced in the frontend today is `ActiveAlertsCard.vue` on the Dashboard — there is no dedicated alerts page, and `MachineDetailPage.vue` doesn't show alerts at all.

This project has no auth or user-identity system anywhere (confirmed by grep across `docs/`, `ai/`, and the backend) — every prior design decision in this repo treats the operator as a single undifferentiated actor. This change follows that posture: it tracks *when* an alert was acknowledged/resolved, not *who* did it.

## Goals / Non-Goals

**Goals:**

- An operator can mark an `ACTIVE` alert as seen (`ACKNOWLEDGED`) and later mark it as fixed (`RESOLVED`), from the Dashboard's Active Alerts widget.
- The Active Alerts widget keeps showing alerts that still need attention (`ACTIVE` and `ACKNOWLEDGED`) and stops showing ones that are `RESOLVED` — matching its own existing purpose comment, "the actionable 'what needs attention now' view."
- Every state transition is validated server-side against an explicit allowed-transition table; invalid transitions are rejected, not silently accepted or silently no-op'd where that would hide an operator mistake.

**Non-Goals:**

- No "acknowledged by" / "resolved by" actor field — no identity system exists to attribute it to.
- No reopening a `RESOLVED` alert back to `ACTIVE`/`ACKNOWLEDGED`. If a resolved problem recurs, the system already handles that correctly at the event layer: a new triggering event (per `alert-detection`'s existing rules) creates a new alert with a new `eventId`. Reopening the old one would mean two alerts could represent the same recurrence, which is worse, not better.
- No bulk acknowledge/resolve ("acknowledge all"). At this project's 3-machine demo scale, per-alert actions are not a burden; a bulk endpoint would be speculative scope.
- No notification, escalation, or incident-grouping behavior — those are separate, later Phase 2 roadmap items (Notification Center, Incident Management, Alert Escalation Rules) that may build on this change's state machine but aren't part of it.

## Decisions

### D1: Three-state lifecycle, `ACTIVE → ACKNOWLEDGED → RESOLVED`, with acknowledge-skipping allowed

Allowed transitions:

| From | acknowledge | resolve |
| --- | --- | --- |
| `ACTIVE` | → `ACKNOWLEDGED` | → `RESOLVED` |
| `ACKNOWLEDGED` | → `ACKNOWLEDGED` (idempotent no-op) | → `RESOLVED` |
| `RESOLVED` | **rejected** (409) | → `RESOLVED` (idempotent no-op) |

`ACTIVE` is allowed to resolve directly, skipping `ACKNOWLEDGED` — requiring two clicks for an alert an operator already knows the fix for would be friction with no safety benefit. Calling an action that would leave the alert in its *current* state (re-acknowledging an already-`ACKNOWLEDGED` alert, re-resolving an already-`RESOLVED` one) succeeds as a no-op rather than erroring — a double-click or a race between two operator tabs shouldn't surface an error for an action that already happened. Calling `acknowledge` on a `RESOLVED` alert is rejected: that's not "no-op same state," it's asking to move backward, which Non-Goals already rules out.

**Alternative considered**: require `ACTIVE → ACKNOWLEDGED → RESOLVED` strictly (no skipping). Rejected — this project has no evidence operators need a forced two-step process, and the roadmap names the feature "Acknowledgment *&* Resolution," not "Acknowledgment *then* Resolution."

### D2: Two new endpoints, nested under `/machines/:id/alerts/:alertId/`, matching api.md §8's already-documented shape

```
POST /machines/:id/alerts/:alertId/acknowledge
POST /machines/:id/alerts/:alertId/resolve
```

`resolve`'s route was already anticipated verbatim in `docs/design/api.md` §8; `acknowledge` is added following the identical shape. Both require no request body (the action is the entire input) and return the full updated alert object — same item shape `GET /alerts` already returns, now including `acknowledgedAt`, so the frontend can use the response to update its cache without an extra refetch.

Lookup order for both: `MachinesService.assertExists(machineId)` first (`404 MACHINE_NOT_FOUND`, reusing the existing guard `AlertsService.listAlertsForMachine` already uses) — then find the alert by `{ alertId, machineId }` together, not `alertId` alone, so a valid `alertId` under the *wrong* `machineId` in the URL 404s rather than silently mutating a different machine's alert (`404 ALERT_NOT_FOUND`, new code, same shape as the existing `SUMMARY_NOT_FOUND`/`MACHINE_NOT_FOUND` pattern) — then validate the transition against D1's table (`409 INVALID_ALERT_TRANSITION`, new code — `409 Conflict` because the request is well-formed but conflicts with the resource's current state, distinct from `400`'s "the request itself is malformed").

**Alternative considered**: flat `POST /alerts/:alertId/acknowledge` (no `machineId` in the path), since `alertId` is already globally unique (`unique: true` on the schema). Rejected for one reason: consistency with the route api.md §8 already committed to on the record before this change existed (`.../machines/:id/alerts/:alertId/resolve`) — introducing a differently-shaped sibling route for `acknowledge` would be a worse outcome than the minor redundancy of `machineId` in the path.

### D3: The Active Alerts widget queries `status=ACTIVE,ACKNOWLEDGED` — the status filter accepts a comma-separated list

`GET /alerts` and `GET /machines/:id/alerts`'s existing `status` query parameter accepts a single value, validated against `ALERT_STATUSES`. This change extends it to accept a comma-separated list (e.g. `status=ACTIVE,ACKNOWLEDGED`), validating every comma-separated value against the same domain — `status=ACTIVE` alone continues to work exactly as before (a one-element list), so this is additive, not breaking. The Active Alerts widget switches its query from `status: 'ACTIVE'` to `status: 'ACTIVE,ACKNOWLEDGED'`, preserving its stated purpose (alerts that still need attention) now that `ACTIVE` alone no longer means that.

**Alternative considered**: keep single-value `status` filtering and have the widget make two separate requests (one per status), merging client-side. Rejected — it doubles the widget's request count for a filter that's naturally a single "which statuses count as active" concept, and comma-separated multi-value filters are a common, unsurprising REST convention.

### D4: `acknowledgedAt` is a new field, `resolvedAt` is unchanged in shape

`acknowledgedAt: string | null`, same pattern as the existing `resolvedAt: string | null` — `null` until set, an ISO-8601 timestamp once the transition happens. Resolving an alert that was never acknowledged (D1's direct `ACTIVE → RESOLVED` path) leaves `acknowledgedAt: null` and only sets `resolvedAt` — the two fields record their own transition independently, they aren't a strict "resolvedAt implies acknowledgedAt" pair.

## Risks / Trade-offs

- [Extending `status` to accept a comma-separated list is a small API contract change] → purely additive (existing single-value callers are unaffected), and validated the same way single values already are — each comma-separated segment checked against `ALERT_STATUSES`, so an invalid segment still 400s with `INVALID_QUERY_PARAMETER`.
- [No actor identity means two operators could both act on the same alert with no record of who] → accepted; this matches every other piece of this system's no-auth posture (e.g. the Simulator page, AI summary regeneration) and isn't specific to this feature. Revisit only if/when the roadmap actually introduces user accounts.
- [The `409 INVALID_ALERT_TRANSITION` code is new, and per `ai/rules/error-handling.md` codes must be documented in `api.md` §6 before use] → `tasks.md` includes updating §6 as an explicit task, following the same precedent as `SUMMARY_NOT_FOUND` being added when `add-insights-module` shipped.

## Migration Plan

1. Add `ACKNOWLEDGED` to `ALERT_STATUSES` and `acknowledgedAt` to the `Alert` schema (additive; no migration needed for existing documents — `acknowledgedAt` defaults to `null`, existing `ACTIVE`/`RESOLVED` values remain valid).
2. Add the two transition methods to `AlertsService` and wire the two new routes.
3. Extend the `status` query parameter to accept a comma-separated list on both alert-list endpoints.
4. Update `docs/design/api.md` (§4, §6, §8), `docs/design/architecture.md` §12.3, and `openspec/specs/alert-detection/spec.md`'s status-domain requirement.
5. Update `ActiveAlertsCard.vue`: multi-status query, acknowledge/resolve buttons, visual distinction between `ACTIVE` and `ACKNOWLEDGED` rows.

Rollback: revert the schema/service/controller/frontend changes; no data migration to undo, since `ACKNOWLEDGED`/`acknowledgedAt` are purely additive and no other code path depends on their existence.

## Open Questions

None blocking.
