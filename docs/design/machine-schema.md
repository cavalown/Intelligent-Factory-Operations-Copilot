# Machine Schema

## 1. Purpose

This document defines the `machines` collection — the current-state projection that Machine Service builds from `machine_events` (see `docs/design/event-schema.md`).

Where `machine_events` answers "what happened?", `machines` answers "what is the state of this machine right now?" This document specifies the fields, the status model, the health score rules, and how incoming events are applied to update a machine document.

---

## 2. Profile Fields vs. Projection Fields

A machine document has two kinds of fields:

* **Profile fields** — identity and configuration. Set when the machine is registered, not derived from events.
* **Projection fields** — current state, derived entirely from applying `machine_events` in order.

```text
Profile fields:      machineId, name, temperatureThreshold
Projection fields:   status, healthScore, currentTemperature, productionCount, lastEventId, lastUpdatedAt
```

This split matters for one reason: projection fields can always be rebuilt by replaying `machine_events` from scratch (see `architecture.md` §10.4, Event Replay Flow). Profile fields cannot — they are not represented in the event stream at all, since no MVP event payload carries a machine's display name or its temperature threshold.

---

## 3. Field Definitions

| Field | Type | Kind | Description |
| --- | --- | --- | --- |
| `machineId` | string | Profile | Unique machine identifier, e.g. `M-001`. |
| `name` | string | Profile | Human-readable display name. |
| `temperatureThreshold` | number | Profile | Per-machine warning threshold in °C. See §6. |
| `status` | string | Projection | One of `RUNNING`, `IDLE`, `WARNING`, `ERROR`, `MAINTENANCE`. See §4. |
| `healthScore` | number | Projection | `0`–`100`. See §5. |
| `currentTemperature` | number \| null | Projection | Latest reported temperature. `null` until the first `TEMPERATURE_REPORTED` event. |
| `productionCount` | number | Projection | Cumulative count from `PRODUCTION_COMPLETED` events. |
| `lastEventId` | string \| null | Projection | `eventId` of the most recent event applied to this document. |
| `lastUpdatedAt` | string \| null | Projection | `producedAt` of the most recent event applied to this document. |

---

## 4. Status Model

State diagram source (covers §4.2–§4.3 in full, including blocked-transition self-loops): [`docs/assets/mermaid/machine-status-state.mmd`](../assets/mermaid/machine-status-state.mmd).

### 4.1 Allowed Statuses

| Status | Meaning |
| --- | --- |
| `RUNNING` | Machine is actively producing. Normal. |
| `IDLE` | Machine is powered on but not producing (standby, changeover, between shifts). Normal. |
| `WARNING` | Minor problem detected (e.g. temperature above threshold). Needs attention. |
| `ERROR` | Machine reported an error condition (e.g. emergency stop). Needs attention. |
| `MAINTENANCE` | Machine requires maintenance or inspection. Needs attention. |

`RUNNING` and `IDLE` are both normal operating states — the only difference is whether the machine is currently producing. `WARNING`, `ERROR`, and `MAINTENANCE` are problem states that should draw an operator's attention, which is why §4.2 ranks them above `RUNNING`/`IDLE`.

These are the same five statuses used in `payload.currentStatus` for `STATUS_CHANGED` (`event-schema.md` §5.1).

### 4.2 Severity Precedence

Machine events arrive independently and can imply conflicting statuses (e.g. a machine already in `ERROR` later reports a normal-range temperature). To avoid a low-severity event silently clearing a high-severity problem, each status has a severity rank:

| Status | Rank |
| --- | --- |
| `ERROR` | 4 (highest) |
| `MAINTENANCE` | 3 |
| `WARNING` | 2 |
| `RUNNING` | 1 |
| `IDLE` | 1 |

**Rule: an event may only raise or hold status, never silently lower it.** An event's implied status only overwrites `machine.status` if its rank is greater than or equal to the current status's rank.

The one exception is `STATUS_CHANGED`. Its `payload.currentStatus` is an explicit, authoritative fact about the machine's state — not an inference — so it always overwrites `machine.status` regardless of rank. This is the only mechanism that can move a machine out of `ERROR` or `MAINTENANCE` back to `RUNNING`/`IDLE` in the MVP; there is no automatic recovery.

### 4.3 Event → Status Mapping

| Event Type | Implied Status | Applies When |
| --- | --- | --- |
| `STATUS_CHANGED` | `payload.currentStatus` | Always (explicit override, bypasses §4.2 ranking). |
| `TEMPERATURE_REPORTED` | `WARNING` | Only when `payload.temperature > machine.temperatureThreshold`. Otherwise no status implication — only `currentTemperature` is updated. |
| `ERROR_OCCURRED` | `ERROR` | Always. |
| `MAINTENANCE_REQUIRED` | `MAINTENANCE` | Always. |
| `PRODUCTION_COMPLETED` | `RUNNING` | Always (subject to §4.2 — will not downgrade an existing `ERROR`/`MAINTENANCE`/`WARNING`). |

---

## 5. Health Score Rules

### 5.1 Bounds

`healthScore` is bounded `0`–`100`. A newly registered machine starts at `100`. There is no automatic recovery over time in the MVP — the score only changes in response to events, and never moves outside `[0, 100]`:

```text
healthScore = clamp(healthScore + delta, 0, 100)
```

### 5.2 Deltas by Event

| Event | Condition | Health Score Delta |
| --- | --- | --- |
| `TEMPERATURE_REPORTED` | `payload.temperature > temperatureThreshold` | `-10` |
| `TEMPERATURE_REPORTED` | Within threshold | `0` (no delta) |
| `ERROR_OCCURRED` | — | `-30` |
| `MAINTENANCE_REQUIRED` | — | `-20` |
| `STATUS_CHANGED` | `currentStatus == WARNING` | `-15` |
| `STATUS_CHANGED` | Any other `currentStatus` | `0` (no delta) |
| `PRODUCTION_COMPLETED` | — | `+2` |

This matches the Machine State Rules table in `CLAUDE.md`. The `STATUS_CHANGED` / `WARNING` row and the "otherwise no delta" row are this document's extension, needed because `STATUS_CHANGED` is a general-purpose event and CLAUDE.md only defines a delta for its sensor-failure case. **MVP rule**: any `STATUS_CHANGED` event that sets `currentStatus` to `WARNING` is treated as the sensor-failure case — there is no separate inspection of `payload.reason` text, since `reason` is freeform and no other `STATUS_CHANGED` transition to `WARNING` is defined in MVP scope.

**Health score deltas are independent of the §4.2 status-ranking rule.** A `PRODUCTION_COMPLETED` event always applies `+2`, even on a machine currently in `ERROR` whose status the event is not allowed to downgrade. Status and health score are separate fields updated by separate rules.

### 5.3 MVP: Hardcoded, Not Configurable

The delta values in §5.2 and the severity ranks in §4.2 are hardcoded in Machine Service logic for the MVP — they are not database fields, config values, or admin-editable settings. This is intentional: `docs/product/mvp.md` explicitly excludes a Rule Engine from MVP scope.

`docs/product/product-roadmap.md` Phase 2 (Event Streaming) lists "Rule Engine" as a feature. When that phase is implemented, these specific values — the five health score deltas and the five status severity ranks — are the concrete rules that should move out of code and into externally configurable rule data. Anyone starting Phase 2 should treat this paragraph as the checklist of what to externalize first.

### 5.4 Resolved: Interpretation Logic Duplicated Across Consumers

**Status: resolved by `openspec/changes/add-rule-engine`.** This section originally documented an accepted MVP risk (Machine Service and Alert Service each independently re-deriving the same classification from the same raw event) and an interim mitigation (a contract test). Both are now historical — the Rule Engine described below as the eventual fix has shipped, and the contract test it made redundant has been deleted. This section is kept as the record of *why* the Rule Engine exists; see `openspec/changes/add-rule-engine/design.md` for the current architecture.

Because §4.3/§5.2's rules were hardcoded per-service (§5.3) rather than computed once, Machine Service and Alert Service each independently re-derived the same classification from the same raw event for the two event types whose effect is conditional: "does `TEMPERATURE_REPORTED`'s `temperature` exceed `temperatureThreshold`?" and "does `STATUS_CHANGED`'s `currentStatus` indicate sensor failure (i.e. equal `WARNING`)?" Both services reached the same conclusion, but nothing structurally guaranteed they stayed in sync — a code review caught one instance of this drifting into inverted boolean logic between the two services (`machine-projection-consumer.service.ts` checked `currentStatus === 'WARNING'`, `alert-consumer.service.ts` checked `currentStatus !== 'WARNING'`).

This was the same class of problem ML infrastructure teams call **training-serving skew** — two systems independently re-deriving the same feature from the same raw input drift apart because there's no single source of truth for the derived value. The standard fix at scale (what a Feature Store, or a Kafka Streams/ksqlDB enrichment topology, exists to do) is: compute the derived fact once, publish it, and have every consumer read the same computed value instead of re-deriving it. **This is now what happens**: a Rule Engine (`backend/src/rules/`) consumes the raw `machine.events` topic, computes both classifications once, and republishes to `machine.events.enriched` with the derived fields attached; Machine Service and Alert Service now consume the enriched topic and only read the classification, never re-derive it.

Before this shipped, `ai/rules/module-boundaries.md`'s ban on business logic in `shared/` meant the duplication couldn't be fixed by extracting a shared function without quietly opening the hole that rule exists to prevent — so the interim mitigation was a **contract test** (a shared set of event fixtures asserted against both services' independent classification logic). That contract test has been deleted: with exactly one implementation left (the Rule Engine's), there are no longer two independent things for it to compare.

---

## 6. Per-Machine Temperature Threshold

`temperatureThreshold` is a profile field, not derived from events — `event-schema.md` §5.2 explicitly excludes thresholds from the raw `TEMPERATURE_REPORTED` payload, so it must live on the machine document.

* Set when the machine is registered/seeded.
* Not modified by any MVP event or API endpoint (no threshold-update endpoint exists in `api.md`).
* MVP default suggestion: `80` (°C) for machines that don't specify one. This default is a placeholder — confirm a real value before implementation.

---

## 7. Projection Update Algorithm

Machine Service applies one event at a time, in the order Kafka delivers them for a given `machineId` partition:

```text
function applyEvent(machine, event):
    switch event.eventType:

        STATUS_CHANGED:
            machine.status = event.payload.currentStatus
            if event.payload.currentStatus == "WARNING":
                machine.healthScore = clamp(machine.healthScore - 15)

        TEMPERATURE_REPORTED:
            machine.currentTemperature = event.payload.temperature
            if event.payload.temperature > machine.temperatureThreshold:
                machine.status = raiseSeverity(machine.status, "WARNING")
                machine.healthScore = clamp(machine.healthScore - 10)

        ERROR_OCCURRED:
            machine.status = raiseSeverity(machine.status, "ERROR")
            machine.healthScore = clamp(machine.healthScore - 30)

        MAINTENANCE_REQUIRED:
            machine.status = raiseSeverity(machine.status, "MAINTENANCE")
            machine.healthScore = clamp(machine.healthScore - 20)

        PRODUCTION_COMPLETED:
            machine.productionCount += event.payload.quantity
            machine.status = raiseSeverity(machine.status, "RUNNING")
            machine.healthScore = clamp(machine.healthScore + 2)

    machine.lastEventId = event.eventId
    machine.lastUpdatedAt = event.producedAt
    return machine

function raiseSeverity(currentStatus, impliedStatus):
    return impliedStatus if rank(impliedStatus) >= rank(currentStatus) else currentStatus

function clamp(value, min = 0, max = 100):
    return max(min, min(max, value))
```

This is illustrative, not an implementation spec — it shows what the schema requires the update logic to do, not how Machine Service's NestJS code should be structured.

---

## 8. Idempotency

Per `CLAUDE.md` design rule 4, consumers must guard against duplicate event processing using `eventId`.

`lastEventId` on the machine document identifies the most recently applied event, but by itself it only protects against re-applying the *immediately preceding* event twice — it cannot detect an out-of-order redelivery of an older event. Full duplicate protection (e.g. checking `machine_events` for prior processing, or a consumer-level dedup store) is a backend implementation concern and is out of scope for this schema document.

### 8.1 Status-Write Contract

Any code path that mutates a machine's `status` and persists it MUST also record a `machine_status_transitions` row (from/to status, event `occurredAt`, `eventId`) — the 24h utilization computation is derived entirely from that projection, and a bypassing write silently corrupts it. Today the projection consumer's `recordTransitionIfChanged` is the only status writer; if a future path is added (e.g. Phase 2's alert-acknowledgment workflow or a manual override endpoint), either route it through the same recording helper or refactor status assignment into a single owned method first. See `openspec/changes/dashboard-operational-metrics/design.md` D10.

---

## 9. Example Machine Document

```json
{
  "machineId": "M-001",
  "name": "CNC Mill 01",
  "temperatureThreshold": 80,
  "status": "WARNING",
  "healthScore": 78,
  "currentTemperature": 95,
  "productionCount": 142,
  "lastEventId": "evt_temp_001",
  "lastUpdatedAt": "2026-07-02T10:30:01.000Z"
}
```

This matches the machine object shape returned by `GET /machines` and `GET /machines/:id` in `docs/design/api.md` §5.1 — the API model is a direct read of this document, with no additional transformation.

---

## 10. Relationship to Other Collections

```text
machines.machineId        <- machine_events.machineId   (one machine has many events)
machines.lastEventId      -> machine_events.eventId      (pointer to most recent applied event)
machines.machineId        <- alerts.machineId            (one machine has many alerts)
machines.machineId        <- ai_summaries.machineId       (one machine has many summaries)
```

`machines` never stores denormalized copies of event or alert history — those are queried from `machine_events` and `alerts` directly. The only cross-reference kept on the machine document is `lastEventId`, for traceability and debugging.

---

## 11. Machine Registration & Defaults

1. **Machine registration is pre-seeded, not auto-created.** A machine document must exist (via a seed script or fixed demo roster) before any event referencing its `machineId` arrives. An event for an unknown `machineId` is rejected — see `docs/design/api.md` §4.7 and §6, error code `UNKNOWN_MACHINE`. It is not treated as an implicit "create this machine" signal.
2. **Initial status is `IDLE`.** A newly seeded machine has not yet received any event proving it is producing, so it starts in the resting state, matching the `previousStatus: "IDLE"` convention used in `event-schema.md`'s `STATUS_CHANGED` example.
3. **`temperatureThreshold` default is `80`°C** for machines that don't specify one at seed time.
