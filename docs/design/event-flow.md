# Event Flow — Worked Example

## 1. Purpose

`docs/design/architecture.md` §9–10 already explain the event-driven architecture and its four flow types (simulated event flow, dashboard query flow, AI summary flow, event replay flow). This document does not repeat that structural explanation.

Instead, this document follows **one concrete event** through its entire lifecycle — the same `M-001` / `evt_temp_001` example already used in `docs/design/event-schema.md`, `docs/design/api.md`, and `docs/design/machine-schema.md` — showing the actual documents each module produces at each step. Use this document when you want to see the whole system react to a single event end to end; use `architecture.md` §9–10 when you want to understand the general shape of the flow.

---

## 2. Scenario Setup

Machine `M-001` exists with this state *before* the event in question arrives:

```json
{
  "machineId": "M-001",
  "name": "CNC Mill 01",
  "temperatureThreshold": 80,
  "status": "RUNNING",
  "healthScore": 88,
  "currentTemperature": 65,
  "productionCount": 142,
  "lastEventId": "evt_prod_098",
  "lastUpdatedAt": "2026-07-02T09:15:00.000Z"
}
```

The operator is looking at the dashboard's Simulator page and triggers a `TEMPERATURE_REPORTED` event reading `95°C` for `M-001` — the same event used as the running example in `event-schema.md` §11.1, `api.md` §4.7, and `machine-schema.md` §9.

---

## 3. Step-by-Step Walkthrough

### 3.1 Simulator Trigger

The dashboard's simulator control constructs the full event envelope (per the "Simulator sends full envelope" decision — `api.md` §4.7) and calls:

```text
POST /simulator/events
```

```json
{
  "eventId": "evt_temp_001",
  "eventType": "TEMPERATURE_REPORTED",
  "schemaVersion": 1,
  "source": "MACHINE_SIMULATOR",
  "machineId": "M-001",
  "occurredAt": "2026-07-02T10:30:00.000Z",
  "producedAt": "2026-07-02T10:30:01.000Z",
  "correlationId": "corr_demo_001",
  "payload": {
    "temperature": 95,
    "unit": "C"
  }
}
```

### 3.2 API Validation and Kafka Publish

The backend validates the envelope and payload against `event-schema.md` §9, then publishes to the `machine.events` topic keyed by `machineId: "M-001"`. It responds immediately, before any projection has been updated:

```text
202 Accepted
{ "eventId": "evt_temp_001", "status": "PUBLISHED" }
```

### 3.3 Parallel Consumer Processing

Three consumers independently receive the same Kafka message and update three different collections. None of them wait for each other.

**Event Service** → `machine_events` (stores the envelope from §3.1 unchanged, as immutable history).

**Machine Service** → applies the projection algorithm from `machine-schema.md` §7:

```text
95 > temperatureThreshold (80)  →  status raised RUNNING(1) → WARNING(2)
                                →  healthScore: 88 - 10 = 78
                                →  currentTemperature: 95
                                →  lastEventId: evt_temp_001
                                →  lastUpdatedAt: 2026-07-02T10:30:01.000Z
```

Resulting `machines` document (identical to the example already shown in `api.md` §5.1 and `machine-schema.md` §9):

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

**Alert Service** → the temperature exceeds the threshold, so it creates an alert (matching the example in `api.md` §4.4):

```json
{
  "alertId": "alert_001",
  "machineId": "M-001",
  "eventId": "evt_temp_001",
  "severity": "WARNING",
  "status": "ACTIVE",
  "message": "Temperature 95C exceeds warning threshold.",
  "createdAt": "2026-07-02T10:30:01.000Z",
  "resolvedAt": null
}
```

### 3.4 Dashboard Reads Updated State

The dashboard was already polling `GET /machines/M-001` before this event was triggered. Because processing is asynchronous (§3.2 returned before §3.3 ran), there is a real window — milliseconds in practice, but not guaranteed — where a dashboard request could still return the *pre-event* state from §2. This is the eventual consistency behavior documented in `architecture.md` §15; this walkthrough is what that section looks like with real documents.

Once consumers finish, `GET /machines/M-001` returns the §3.3 `machines` document, and `GET /machines/M-001/alerts` includes `alert_001`.

### 3.5 AI Summary Generation

The operator opens `M-001`'s detail page and requests a summary:

```text
POST /machines/M-001/summary
```

Insight Service gathers recent context — including the prior event `evt_prod_098` and the new `evt_temp_001` — calls the LLM, and stores the result (matching `api.md` §4.5's example, corrected to reference events that actually belong to `M-001`):

```json
{
  "summaryId": "summary_001",
  "machineId": "M-001",
  "scope": "MACHINE",
  "inputEventIds": ["evt_prod_098", "evt_temp_001"],
  "summary": "M-001 was running normally, then reported a temperature above its warning threshold. No critical errors reported.",
  "recommendedActions": [
    "Check cooling system airflow.",
    "Monitor temperature for the next cycle."
  ],
  "model": "gpt-4.1",
  "createdAt": "2026-07-02T10:31:00.000Z"
}
```

---

## 4. Contrast Case: Event Within Threshold

If the same event instead reported `70°C` (below `temperatureThreshold: 80`):

```text
70 > 80  →  false  →  no status change, no healthScore delta
                   →  currentTemperature: 70
                   →  lastEventId / lastUpdatedAt still update
```

Per `machine-schema.md` §4.3 and §5.2, `status` stays `RUNNING` and `healthScore` stays `88` — only `currentTemperature`, `lastEventId`, and `lastUpdatedAt` change. Alert Service creates no alert. This is the common case; most `TEMPERATURE_REPORTED` events should look like this, not like §3.3.

---

## 5. Contrast Case: Severity Precedence in Action

Suppose `M-001` were instead already in `ERROR` (rank 4) when a `TEMPERATURE_REPORTED` event arrives implying `WARNING` (rank 2) — regardless of whether the temperature crosses the threshold:

```text
rank(WARNING) = 2  <  rank(ERROR) = 4  →  status stays ERROR
                                        →  healthScore delta still applies if temperature > threshold (-10)
```

This is `machine-schema.md` §4.2's rule made concrete: a lower-severity event's implied status is discarded, but its health score delta still applies (§5.2's independence rule). The machine stays visibly `ERROR` on the dashboard until an explicit `STATUS_CHANGED` event clears it.

---

## 6. Where the Rules Live

This document only illustrates. The authoritative rules are:

| Concern | Source |
| --- | --- |
| Event envelope and payload shapes | `event-schema.md` §3, §5 |
| Status severity ranking and transitions | `machine-schema.md` §4 |
| Health score deltas and bounds | `machine-schema.md` §5 |
| API request/response contracts | `api.md` §4 |
| Consistency and idempotency guarantees | `architecture.md` §15, `machine-schema.md` §8 |
