# Documentation Is the Source of Truth — Keep It in Sync

`docs/design/event-schema.md`, `docs/design/api.md`, `docs/design/machine-schema.md`, and `docs/design/architecture.md` define the system's contracts. Code must implement what they say, not the other way around.

If a change needs behavior that contradicts or extends a documented rule (a new field, a new status, a new error code), update the relevant doc in the same change. Docs and code drifting apart is a real failure mode on this project — earlier in its history, `architecture.md` fell out of sync with `event-schema.md` (stale event names, a stale `machine_events` field list) and had to be reconciled in a dedicated consistency pass. Don't recreate that.

Do not invent event types, status values, or error codes that aren't defined in `event-schema.md` / `machine-schema.md` / `api.md` without updating those docs first.
