## Context

The `backend-walking-skeleton` change built the full pipeline for one event type (`TEMPERATURE_REPORTED`) and deliberately deferred the other 4 MVP event types via an explicit `UNSUPPORTED_EVENT_TYPE` rejection in `SimulatorService` and a narrowed `IMPLEMENTED_EVENT_TYPES` constant. All 5 event types' rules are already fully specified in `docs/design/event-schema.md` §5/§9.2, `docs/design/machine-schema.md` §4.3/§5.2/§7, and `docs/design/architecture.md` §9.3 — this change is pure implementation against existing, unambiguous specs, with one gap resolved below.

## Goals / Non-Goals

**Goals:**
- Implement simulator validation, Kafka publish, and all 3 consumers (Event/Machine/Alert Service) for `STATUS_CHANGED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`.
- Reuse the exact same architecture proven in the walking skeleton (raw `kafkajs`, `KafkaConsumerBase` subclasses, `ApiError`, module-boundary rules) — no new patterns.
- Implement the severity-precedence exception for `STATUS_CHANGED` (the only event type allowed to downgrade `machine.status`).

**Non-Goals:**
- No new REST endpoints, no schema/collection changes, no frontend work (tracked separately).
- No Rule Engine / externalized configuration for the new deltas — per `machine-schema.md` §5.3, these stay hardcoded in Machine/Alert Service code for the MVP, exactly like the `TEMPERATURE_REPORTED` threshold delta already is.
- No change to `event-history` consumer logic beyond widening the accepted `eventType` set (persistence is already envelope-shape-agnostic).

## Decisions

### 1. Sensor-failure detection for `STATUS_CHANGED` (resolves an undocumented gap)

`machine-schema.md` §7's pseudocode calls `isSensorFailure(event.payload.reason)` but never defines it, and `payload.reason` is a freeform human-readable string with no enum — so no reliable text-matching rule exists.

**Decision: treat every `STATUS_CHANGED` event with `payload.currentStatus == "WARNING"` as the sensor-failure case.** No text inspection of `payload.reason` is performed. `isSensorFailure()` is therefore not implemented as a separate function — the condition collapses to a direct check on `currentStatus`.

Rationale (user-confirmed): in MVP scope, `STATUS_CHANGED` has no other defined reason to explicitly set a machine to `WARNING` — `TEMPERATURE_REPORTED` is the only other path to `WARNING`, and it doesn't go through this code path. Keyword-matching on freeform text was considered and rejected as fragile (misses phrasings like "vibration threshold exceeded" that don't contain the word "sensor").

This means:
- `STATUS_CHANGED` → `currentStatus: WARNING`: `healthScore -15`, WARNING alert created.
- `STATUS_CHANGED` → any other `currentStatus`: `healthScore` unchanged, no alert.

### 2. `STATUS_CHANGED` bypasses severity precedence entirely

Per `machine-schema.md` §4.2, `STATUS_CHANGED` always overwrites `machine.status` with `payload.currentStatus`, regardless of current rank — this is the only downgrade path in the MVP (e.g. an operator/simulator explicitly moving a machine from `ERROR` back to `RUNNING`). All other event types continue to go through `raiseSeverity()` (only overwrite if the implied status's rank >= current rank).

### 3. `productionCount` increments by `payload.quantity`, not a flat `+1`

`machine-schema.md` §7 pseudocode: `machine.productionCount += event.payload.quantity`. `quantity` is a required field on `PRODUCTION_COMPLETED` (`event-schema.md` §9.2).

### 4. Alert rules per event type (from `architecture.md` §9.3)

| Event Type | Alert Created? | Severity |
| --- | --- | --- |
| `STATUS_CHANGED` | Only if `currentStatus == WARNING` (decision 1) | `WARNING` |
| `ERROR_OCCURRED` | Always | `CRITICAL` (regardless of `payload.recoverable`) |
| `MAINTENANCE_REQUIRED` | Always | `WARNING` |
| `PRODUCTION_COMPLETED` | Never | — |

### 5. Reuse existing idempotency and module-boundary patterns unchanged

- All 3 consumers keep their existing idempotency mechanism (`machine_events`/`alerts` unique index on `eventId` with duplicate-key-as-no-op; `machines` compares `lastEventId`) — no new idempotency logic needed since it's already type-agnostic.
- `MachineProjectionConsumerService` and `AlertConsumerService` continue to depend on `MachinesService` (not the Mongoose model directly), per `ai/rules/module-boundaries.md`.

## Risks / Trade-offs

- **[Risk] The "any WARNING is sensor failure" rule (decision 1) may not generalize** if a future, non-MVP `STATUS_CHANGED` producer sets `currentStatus: WARNING` for an unrelated reason (e.g. a manual operator note). → **Mitigation**: documented explicitly in `machine-schema.md` update (see Impact) as an MVP-only heuristic; flagged as the first thing to revisit if `payload.reason` ever becomes structured (e.g. a `reasonCode` enum) in a later phase.
- **[Risk] `ERROR_OCCURRED`'s `payload.recoverable` field is currently unused** by any rule (health score, status, and alert severity are all constant regardless of its value). → **Mitigation**: this matches the existing documented rule exactly (`architecture.md` line 427 confirms `recoverable` is intentionally not distinguished on); no action needed, just noting it's not dead code left by oversight.

## Migration Plan

No data migration. Purely additive: existing `TEMPERATURE_REPORTED` behavior is unchanged; the 4 new event types simply stop being rejected at the simulator boundary. Deploy as a normal backend rebuild (`docker compose up -d --build backend`).

## Open Questions

None remaining — the one identified gap (sensor-failure detection) was resolved in Decision 1 above.
