## Why

Alerts today are create-only: `Alert.status` has just `ACTIVE`/`RESOLVED`, nothing in the system ever transitions it, and no endpoint mutates an alert at all — only `GET` reads exist. An operator has no way to say "I've seen this" or "this is fixed," so every alert an operator has already dealt with looks identical to one nobody has looked at yet. This is explicitly anticipated, not new scope: `docs/design/api.md` §8 lists `POST /machines/:id/alerts/:alertId/resolve` under "Phase 2 — incident management," and the frontend's `ActiveAlertsCard.vue` carries the comment "ACK lifecycle is Phase 2 — read-only until then." `docs/product/product-roadmap.md`'s Phase 2 names this feature directly: "Alert Acknowledgment & Resolution Workflow."

## What Changes

- `Alert.status` gains a third value, `ACKNOWLEDGED`, sitting between `ACTIVE` and `RESOLVED`. **BREAKING**: any code or client validating status against the current two-value set (`ACTIVE`, `RESOLVED`) must account for the new value.
- New `acknowledgedAt: string | null` field on `Alert`, mirroring the existing `resolvedAt`.
- Two new endpoints: acknowledge an alert (`ACTIVE` → `ACKNOWLEDGED`) and resolve an alert (`ACTIVE`/`ACKNOWLEDGED` → `RESOLVED`). Exact routes and the allowed-transition table are a design.md decision.
- Frontend: `ActiveAlertsCard.vue` (and any other alert-list surface) gets acknowledge/resolve actions, replacing its current read-only presentation.
- No user/actor identity is introduced — this project has no auth system anywhere, so there is no "acknowledged by" / "resolved by" field. The workflow tracks *when*, not *who*.

## Capabilities

### New Capabilities
- `alert-lifecycle`: the state-transition actions (acknowledge, resolve) and their API surface — owns the "how does an alert's status change after creation" concern, separate from `alert-detection`'s "when is an alert created in the first place."

### Modified Capabilities
- `alert-detection`: its existing "status filter validated against the alert-status domain" requirement changes from a two-value set (`ACTIVE`, `RESOLVED`) to three (`ACTIVE`, `ACKNOWLEDGED`, `RESOLVED`).

## Impact

- **Code**: `backend/src/alerts/schemas/alert.schema.ts` (new status value, new field), `alerts.service.ts` (new transition methods), a controller change for the new routes, `frontend/src/api/alerts.ts` + `frontend/src/api/types.ts` (new client calls, updated `Alert` type), `frontend/src/components/ActiveAlertsCard.vue` (actionable UI).
- **API**: two new endpoints under `docs/design/api.md` §8's anticipated shape; `docs/design/api.md` needs updating before implementation per its own §7/§8 convention ("each future endpoint should be specified in this document before implementation").
- **Docs**: `docs/design/architecture.md` §12.3 (`alerts` collection fields), `openspec/specs/alert-detection/spec.md` (status-domain requirement).
- **No breaking change to existing GET endpoints' response shape** — `acknowledgedAt` is an additive field; `ACKNOWLEDGED` is an additive enum value existing `ACTIVE`/`RESOLVED` filters are unaffected by.
