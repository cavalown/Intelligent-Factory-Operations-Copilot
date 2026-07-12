# API Contract

## 1. Purpose

This document defines the REST API contract between the IFOC backend and its clients (the Vue 3 dashboard and the Machine Simulator) for the MVP.

The API Layer does not own domain logic. It exposes read models built by the Event, Machine, Alert, and Insight modules, and accepts simulator input that is published to Kafka for asynchronous processing.

This document should be read together with:

* `docs/design/architecture.md` — section 11 (API Layer) and section 12 (Data Storage)
* `docs/design/event-schema.md` — event envelope and payload schemas

---

## 2. Conventions

### 2.1 Base URL

```text
http://localhost:3000/api
```

The MVP runs the backend as a single NestJS process behind Docker Compose. No API gateway or versioned path prefix is required yet.

### 2.2 Content Type

All requests and responses use `application/json`.

### 2.3 Timestamps

All timestamps are ISO 8601 UTC strings, matching the event envelope convention in `event-schema.md`.

```text
2026-07-02T10:30:00.000Z
```

### 2.4 Response Envelope

Successful responses return the resource directly. List endpoints wrap results in a `data` array plus a `pagination` object when pagination applies.

```json
{
  "data": [ ... ],
  "pagination": {
    "limit": 20,
    "nextCursor": "evt_01J2Z8...",
    "hasMore": true
  }
}
```

Single-resource endpoints return the resource object without a wrapper.

### 2.5 Error Envelope

All errors use a consistent shape:

```json
{
  "error": {
    "code": "MACHINE_NOT_FOUND",
    "message": "Machine M-999 was not found."
  }
}
```

See section 6 for the full error code table.

### 2.6 No Authentication

Authentication and authorization are out of scope for the MVP (see `docs/product/mvp.md`). All endpoints are open on the local Docker Compose network.

---

## 3. Resource Overview

| Resource | Backed By | Description |
| --- | --- | --- |
| Machine | `machines` | Current machine state projection. |
| Event | `machine_events` | Immutable event history for a machine. Queryable per-machine (§4.3) or across all machines (§4.4). |
| Alert | `alerts` | Problems derived from WARNING/CRITICAL events. |
| AI Summary | `ai_summaries` | LLM-generated operational summary. |

---

## 4. Endpoints

### 4.1 `GET /machines`

Returns the current state projection for every machine.

**Response `200`**

```json
{
  "data": [
    {
      "machineId": "M-001",
      "name": "CNC Mill 01",
      "status": "WARNING",
      "healthScore": 78,
      "currentTemperature": 95,
      "productionCount": 142,
      "lastEventId": "evt_temp_001",
      "lastUpdatedAt": "2026-07-02T10:30:01.000Z"
    }
  ]
}
```

---

### 4.2 `GET /machines/:id`

Returns the current state projection for a single machine.

**Response `200`** — same shape as one item from `GET /machines`.

**Response `404`** — `MACHINE_NOT_FOUND` if `:id` does not exist.

---

### 4.3 `GET /machines/:id/events`

Returns event history for a machine, most recent first, using cursor-based pagination.

**Query Parameters**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `limit` | number | No | Max items to return. Default `20`, max `100`. |
| `before` | string | No | Return events strictly older than this event's `eventId`. Used to page backward into history. |
| `eventType` | string | No | Filter to a single event type, e.g. `TEMPERATURE_REPORTED`. |

**Response `200`**

```json
{
  "data": [
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
  ],
  "pagination": {
    "limit": 20,
    "nextCursor": "evt_temp_000",
    "hasMore": true
  }
}
```

`nextCursor` is the `eventId` to pass as `before` on the next request. `nextCursor` is `null` and `hasMore` is `false` when no older events remain.

**Response `404`** — `MACHINE_NOT_FOUND` if `:id` does not exist.

---

### 4.4 `GET /events`

Returns event history across all machines, most recent first, using the same cursor-based pagination as `GET /machines/:id/events` (§4.3). Added to support cross-machine views (Event Center, Dashboard's Recent Events) that don't scope to a single machine — see `docs/product/mvp.md` §Event Center.

**Query Parameters**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `limit` | number | No | Max items to return. Default `20`, max `100`. |
| `before` | string | No | Return events strictly older than this event's `eventId`. Used to page backward into history. |
| `eventType` | string | No | Filter to a single event type, e.g. `TEMPERATURE_REPORTED`. |
| `machineId` | string | No | Filter to a single machine. Equivalent to calling `GET /machines/:id/events` with that `machineId`. |

**Response `200`** — same envelope shape as §4.3, with `data` spanning multiple machines when `machineId` is omitted:

```json
{
  "data": [
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
  ],
  "pagination": {
    "limit": 20,
    "nextCursor": "evt_temp_000",
    "hasMore": true
  }
}
```

**Response `404`** — `MACHINE_NOT_FOUND` if a `machineId` filter is supplied and does not exist. Not applicable when `machineId` is omitted.

---

### 4.5 `GET /machines/:id/alerts`

Returns alerts derived from this machine's events, most recent first.

**Query Parameters**

| Param | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | string | No | Filter by `ACTIVE` or `RESOLVED`. Returns both when omitted. |

**Response `200`**

```json
{
  "data": [
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
  ]
}
```

**Response `404`** — `MACHINE_NOT_FOUND` if `:id` does not exist.

---

### 4.6 `GET /machines/:id/summary`

Returns the most recently generated AI summary for a machine.

**Response `200`**

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

**Response `404`** — `SUMMARY_NOT_FOUND` if no summary has ever been generated for this machine. `MACHINE_NOT_FOUND` if `:id` does not exist.

---

### 4.7 `POST /machines/:id/summary`

Triggers a new AI summary for a machine. The MVP calls the LLM synchronously and returns the generated summary in the response — there is no job queue or polling in the MVP.

**Request Body** — none required.

```json
{}
```

**Response `200`** — the newly created summary, same shape as `GET /machines/:id/summary`.

**Response `404`** — `MACHINE_NOT_FOUND` if `:id` does not exist.

**Response `502`** — `LLM_CALL_FAILED` if the upstream LLM API call fails. The dashboard should treat this as advisory-feature failure and continue to show existing machine/event/alert data (see `architecture.md` section 16: "Keep AI failure isolated from dashboard availability").

---

### 4.8 `POST /simulator/events`

Accepts a fully-formed machine event from the Machine Simulator and publishes it to the `machine.events` Kafka topic, keyed by `machineId`. The simulator is responsible for constructing the complete event envelope, including `eventId`, `occurredAt`, `producedAt`, `correlationId`, and `schemaVersion`, per `docs/design/event-schema.md`.

This endpoint performs envelope and payload validation (section 9 of `event-schema.md`) but does not update any projection directly — projections are updated asynchronously by Kafka consumers.

**Request Body**

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

**Response `202`** — the event was valid and published to Kafka. Consumers process it asynchronously, so `GET /machines/:id`, `.../events`, and `.../alerts` may briefly lag behind.

```json
{
  "eventId": "evt_temp_001",
  "status": "PUBLISHED"
}
```

If `eventId` duplicates a previously accepted event, the API still responds `202` — duplicate detection is a consumer-side idempotency concern (design rule 4 in `CLAUDE.md`), not an API-layer error.

**Response `400`** — `INVALID_EVENT_ENVELOPE` if a required envelope field is missing or malformed.

**Response `404`** — `UNKNOWN_MACHINE` if `machineId` does not match a pre-seeded machine. Machines are not auto-created from simulator events — see `docs/design/machine-schema.md` §11.

**Response `422`** — `UNSUPPORTED_EVENT_TYPE` if `eventType` is not one of the MVP event types, or `PAYLOAD_VALIDATION_FAILED` if `payload` does not match the schema for the given `eventType`.

---

### 4.9 `GET /summary`

Returns the most recently generated factory-scope AI summary — the data source for the Dashboard's AI Summary Card. Mirrors §4.6 with `scope: "FACTORY"` and no `machineId`. Added by the `add-insights-module` change (2026-07-10); the `scope` field anticipated this.

**Response `200`**

```json
{
  "summaryId": "summary_002",
  "scope": "FACTORY",
  "inputEventIds": ["evt_prod_098", "evt_temp_001"],
  "summary": "Two machines are running normally. M-001 reported a temperature above its warning threshold; no critical errors across the factory.",
  "recommendedActions": [
    "Check M-001's cooling system airflow.",
    "Monitor factory-wide temperature trend for the next cycle."
  ],
  "model": "gpt-4.1",
  "createdAt": "2026-07-02T10:32:00.000Z"
}
```

**Response `404`** — `SUMMARY_NOT_FOUND` if no factory-scope summary has ever been generated.

---

### 4.10 `POST /summary`

Triggers a new factory-scope AI summary. Mirrors §4.7: the MVP calls the LLM synchronously and returns the generated summary — no job queue or polling. The context gathered covers all machines' current state, recent cross-machine events, and active alerts.

**Request Body** — none required.

**Response `200`** — the newly created summary, same shape as `GET /summary`.

**Response `502`** — `LLM_CALL_FAILED`, with the same advisory-feature isolation as §4.7.

---

### 4.11 `GET /dashboard/stats`

Returns the factory-wide aggregate the Dashboard's stat tiles render, computed from the `machines` projection. Added by the `add-frontend-mvp` change (2026-07-10) so the aggregate lives behind the API from day one instead of being client-side arithmetic that would silently stop scaling.

**Response `200`**

```json
{
  "machineCount": 3,
  "statusCounts": {
    "RUNNING": 1,
    "IDLE": 0,
    "WARNING": 1,
    "ERROR": 0,
    "MAINTENANCE": 1
  },
  "totalProductionCount": 145,
  "averageHealthScore": 62.7,
  "last24h": {
    "productionCount": 42,
    "operatingMs": 61200000,
    "stoppedMs": 4300000,
    "idleMs": 20900000,
    "approximate": false
  }
}
```

`statusCounts` always contains all five statuses, zero-filled. On an empty machines collection, `machineCount` is `0`, `averageHealthScore` is `null`, and `last24h` is all zeros. The dashboard's "Critical Machines" tile maps to `statusCounts.ERROR`. `last24h.approximate` is `true` when any machine's window used the bootstrap approximation described in §4.12.

`last24h` (added by the `dashboard-operational-metrics` change) covers the rolling window `[now − 24h, now]`: `productionCount` sums `PRODUCTION_COMPLETED` quantities by `occurredAt`; the three durations sum every machine's time-in-status buckets (see §4.12).

---

### 4.12 `GET /machines/:id/utilization`

Returns rolling-24h time-in-status for one machine, computed from the `machine_status_transitions` projection: `operatingMs` (`RUNNING` + `WARNING`), `stoppedMs` (`ERROR` + `MAINTENANCE`), `idleMs` (`IDLE`). The three durations sum to `windowMs`.

**Response `200`**

```json
{
  "machineId": "M-001",
  "windowMs": 86400000,
  "operatingMs": 61200000,
  "stoppedMs": 4300000,
  "idleMs": 20900000,
  "approximate": false
}
```

**Response `404`** — `MACHINE_NOT_FOUND` if `:id` does not exist.

**Bootstrap approximation:** transitions only accrue from the change's deployment onward; a machine with no recorded transitions is treated as having held its current status for the whole window, and the response carries `approximate: true` so clients can annotate the value (the dashboard renders `≈`). The approximation disappears after 24h of history (or entirely after an event replay rebuild).

---

### 4.13 `GET /alerts`

Cross-machine alert read backing the Dashboard's Active Alerts widget. Same item shape as §4.4, most-recent-first.

**Query parameters:** `status` (optional, `ACTIVE` | `RESOLVED`), `limit` (optional, default 20, capped at 100).

**Response `200`** — `{ "data": [ ...alerts ] }`.

**Response `400`** — `INVALID_QUERY_PARAMETER` if `status` is not one of `ACTIVE` | `RESOLVED` (also applies to §4.4's `status` filter). Out-of-range `limit` values are clamped, not rejected.

---

## 5. Data Models

### 5.1 Machine

| Field | Type | Description |
| --- | --- | --- |
| `machineId` | string | Machine identifier. |
| `name` | string | Human-readable machine name. |
| `status` | string | One of `RUNNING`, `IDLE`, `WARNING`, `ERROR`, `MAINTENANCE`. |
| `healthScore` | number | Derived score updated per the Machine State Rules in `CLAUDE.md`. |
| `currentTemperature` | number | Latest reported temperature, if any. |
| `productionCount` | number | Cumulative completed production count. |
| `lastEventId` | string | `eventId` of the most recent event applied to this projection. |
| `lastUpdatedAt` | string | Timestamp this projection was last updated. |

### 5.2 Event

See `docs/design/event-schema.md` section 3 for the full envelope and section 5 for per-type payload schemas.

### 5.3 Alert

| Field | Type | Description |
| --- | --- | --- |
| `alertId` | string | Alert identifier. |
| `machineId` | string | Machine this alert belongs to. |
| `eventId` | string | `eventId` that triggered this alert. |
| `severity` | string | `WARNING` or `CRITICAL`. |
| `status` | string | `ACTIVE` or `RESOLVED`. |
| `message` | string | Human-readable alert description. |
| `createdAt` | string | When the alert was created. |
| `resolvedAt` | string \| null | When the alert was resolved, if applicable. |

### 5.4 AI Summary

| Field | Type | Description |
| --- | --- | --- |
| `summaryId` | string | Summary identifier. |
| `machineId` | string | Machine this summary describes. Present only when `scope` is `MACHINE`. |
| `scope` | string | `MACHINE` (per-machine summary, §4.6–4.7) or `FACTORY` (whole-factory summary, §4.9–4.10). |
| `inputEventIds` | string[] | Events used to generate this summary, for traceability. |
| `summary` | string | LLM-generated operational summary text. |
| `recommendedActions` | string[] | LLM-suggested next steps. |
| `model` | string | LLM model identifier used to generate this summary. |
| `createdAt` | string | When the summary was generated. |

---

## 6. Error Handling

| HTTP Status | Code | Meaning |
| --- | --- | --- |
| `400` | `INVALID_EVENT_ENVELOPE` | Request body is missing a required envelope field, a field has the wrong type, or a timestamp is not canonical ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`, per §2.3). |
| `400` | `INVALID_QUERY_PARAMETER` | A query parameter value is outside its documented domain (e.g. `status` not in `ACTIVE`/`RESOLVED`). |
| `404` | `MACHINE_NOT_FOUND` | The `:id` path parameter does not match an existing machine. |
| `404` | `UNKNOWN_MACHINE` | `POST /simulator/events` body references a `machineId` that isn't pre-seeded. |
| `404` | `SUMMARY_NOT_FOUND` | No AI summary has been generated yet for this machine (§4.6) or for the factory (§4.9). |
| `422` | `UNSUPPORTED_EVENT_TYPE` | `eventType` is not a recognized MVP event type. |
| `422` | `PAYLOAD_VALIDATION_FAILED` | `payload` does not match the schema required for `eventType`. |
| `502` | `LLM_CALL_FAILED` | The Insight Service could not reach the LLM API. |
| `500` | `INTERNAL_ERROR` | Unexpected server-side failure. |

---

## 7. Versioning

The MVP does not version the API path. Breaking changes to a response shape should be avoided while the dashboard is the only consumer; if a breaking change is unavoidable, introduce a versioned path prefix (e.g. `/api/v2`) rather than changing `/api` in place.

This is independent of `schemaVersion` on the event envelope, which versions event payloads, not API responses.

---

## 8. Future Endpoints

Not part of the MVP, but anticipated by the roadmap in `docs/product/product-roadmap.md`:

```text
POST /machines/:id/alerts/:alertId/resolve   # Phase 2 — incident management
GET  /events/search                          # Phase 3 — event search
GET  /machines/:id/history                   # Phase 3 — machine history
POST /insights/chat                          # Phase 4 — AI chat
GET  /digital-twin/:id/state                 # Phase 5 — digital twin
```

Each future endpoint should be specified in this document before implementation, following the same contract style as section 4.
