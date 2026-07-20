# Event Schema

## 1. Purpose

This document defines the machine event format for **IFOC (Intelligent Factory Operations Copilot)**.

Machine events represent facts that happened in the factory. They are the foundation for event history, machine state projections, alerts, AI insights, and future Digital Twin replay.

This document creates a shared contract for the backend, Kafka consumers, dashboard, and AI insight module, so every part of the system works from the same event format.

The event schema should support:

* Machine event ingestion.
* Kafka-based asynchronous processing.
* Event history persistence.
* Machine current state projection.
* Alert detection.
* AI insight generation.
* Future predictive maintenance and Digital Twin workflows.

In IFOC, raw machine events should describe what happened. They should not contain every downstream interpretation. For example, a raw `TEMPERATURE_REPORTED` event records a temperature reading. A consumer or rule decides whether that reading should become a warning alert.

---

## 2. Event Design Principles

1. **Events describe facts that already happened.**  
   An event should describe a real machine condition or operation, not a UI action or temporary command.

2. **Events are immutable.**  
   Once accepted, an event should not be changed to represent a different fact.

3. **Events should be versioned.**  
   Every event includes `schemaVersion` so consumers can evolve safely.

4. **Events should include traceable metadata.**  
   Events should include identifiers and timestamps that allow the system to trace where the event came from and when it occurred.

5. **Events should be safe for async processing.**  
   Consumers should be able to process events independently and idempotently.

6. **Events should separate facts from interpretations.**  
   Raw events should not include derived fields such as alert severity unless that severity is part of the upstream machine fact. In the MVP, alert severity is derived by consumers.

---

## 3. Event Envelope

All machine events use a shared envelope.

The envelope contains common fields used for routing, tracing, validation, and versioning. Event-specific data is stored in `payload`.

All events should have the same outer structure. The only parts that change between event types are:

* `eventType`
* `payload`

This keeps producers, Kafka messages, consumers, validators, and storage logic consistent.

```json
{
  "eventId": "evt_01J2Z7X9K8V6P4M3N2Q1R0T9Y8",
  "eventType": "TEMPERATURE_REPORTED",
  "schemaVersion": 1,
  "source": "MACHINE_SIMULATOR",
  "machineId": "M-001",
  "occurredAt": "2026-07-02T10:30:00.000Z",
  "producedAt": "2026-07-02T10:30:01.000Z",
  "correlationId": "corr_01J2Z7X9K8V6P4M3N2Q1R0T9Y8",
  "payload": {
    "temperature": 95,
    "unit": "C"
  }
}
```

### 3.1 Envelope Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `eventId` | string | Yes | Unique event identifier. Used for idempotency. |
| `eventType` | string | Yes | Type of event, such as `TEMPERATURE_REPORTED`. |
| `schemaVersion` | number | Yes | Version of this event schema. MVP value is `1`. |
| `source` | string | Yes | Producer of the event. |
| `machineId` | string | Yes | Machine that produced or is associated with the event. |
| `occurredAt` | string | Yes | Time when the event happened, in ISO 8601 UTC format. |
| `producedAt` | string | Yes | Time when the event was published by the producer. |
| `correlationId` | string | No | Trace ID for grouping related events or requests. |
| `payload` | object | Yes | Event-specific data. |

### 3.2 Why `severity` Is Not in the Raw Event

The raw machine event does not include `severity` in the MVP.

Reason:

```text
eventType / payload = fact
severity / alert / machine status = interpretation
```

Example:

```json
{
  "eventType": "TEMPERATURE_REPORTED",
  "payload": {
    "temperature": 95,
    "unit": "C"
  }
}
```

The event only says that a temperature was reported. The Alert Service or Machine Service decides whether `95 C` is normal, warning, or critical according to system rules.

This keeps producer responsibility simple and prevents duplicated business logic across producers.

### 3.3 Rule Engine Enrichment Fields

Two additional envelope fields exist only on `machine.events.enriched`, the topic the Rule Engine republishes to — never on the raw `machine.events` topic a producer writes to (`openspec/changes/add-rule-engine/design.md` D1–D3):

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `temperatureExceedsThreshold` | boolean | No | Present only on a republished `TEMPERATURE_REPORTED` event; omitted if the machine is unknown. |
| `isSensorFailure` | boolean | No | Present only on a republished `STATUS_CHANGED` event. |

Every other envelope field, including `eventId`, is carried through unchanged from the source event (§3.1) — the enriched event is a richer copy, not a new event. Machine Service and Alert Service consume `machine.events.enriched` and read these fields instead of re-deriving them from `payload`; Event Service is unaffected, since it still consumes raw `machine.events`.

---

## 4. Event Types

The MVP uses event types that describe machine facts.

| Event Type | Meaning | Typical Consumer Interpretation |
| --- | --- | --- |
| `STATUS_CHANGED` | Machine status changed. | Update machine current status. |
| `TEMPERATURE_REPORTED` | Machine reported a temperature reading. | Update temperature; possibly create warning alert. |
| `ERROR_OCCURRED` | Machine reported an error condition. | Mark machine as error; create critical alert. |
| `MAINTENANCE_REQUIRED` | Machine reported that maintenance is required. | Mark machine as maintenance; create warning alert. |
| `PRODUCTION_COMPLETED` | Machine completed a production cycle or batch. | Increase production count; update health score. |

Event types should use uppercase snake case.

---

## 5. Event Payload Schemas

Each event type has its own `payload` schema.

### 5.1 `STATUS_CHANGED`

Used when a machine changes operational status.

```json
{
  "previousStatus": "IDLE",
  "currentStatus": "RUNNING",
  "reason": "Production cycle started."
}
```

Fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `previousStatus` | string | No | Previous machine status. |
| `currentStatus` | string | Yes | New machine status. |
| `reason` | string | No | Human-readable reason for the change. |

Allowed machine statuses:

```text
RUNNING
IDLE
WARNING
ERROR
MAINTENANCE
```

### 5.2 `TEMPERATURE_REPORTED`

Used when a machine reports a temperature reading.

```json
{
  "temperature": 95,
  "unit": "C"
}
```

Fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `temperature` | number | Yes | Reported machine temperature. |
| `unit` | string | Yes | Temperature unit. MVP value is `C`. |

Thresholds are not part of the raw event in the MVP. Thresholds belong to consumer rules or machine configuration.

### 5.3 `ERROR_OCCURRED`

Used when a machine reports an error.

```json
{
  "errorCode": "E_STOP_MANUAL",
  "errorMessage": "Operator pressed emergency stop.",
  "recoverable": true
}
```

Fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `errorCode` | string | Yes | Machine or simulator error code. |
| `errorMessage` | string | Yes | Human-readable error message. |
| `recoverable` | boolean | No | Whether the machine can recover without maintenance. |

### 5.4 `MAINTENANCE_REQUIRED`

Used when a machine requires maintenance or inspection.

```json
{
  "maintenanceType": "INSPECTION",
  "reason": "Scheduled maintenance threshold reached."
}
```

Fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `maintenanceType` | string | Yes | Type of maintenance required. |
| `reason` | string | Yes | Reason maintenance is required. |

### 5.5 `PRODUCTION_COMPLETED`

Used when a machine completes production.

```json
{
  "quantity": 1,
  "batchId": "BATCH-20260702-001"
}
```

Fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `quantity` | number | Yes | Number of produced units or completed cycles. |
| `batchId` | string | No | Production batch identifier. |

---

## 6. Event Producers

Event producers create machine events and publish them to Kafka.

### 6.1 MVP Producer

| Producer | Description |
| --- | --- |
| Machine Simulator | Generates fake machine events for local development and demos. |

### 6.2 Future Producers

| Producer | Description |
| --- | --- |
| PLC Integration | Publishes events from programmable logic controllers. |
| MES Integration | Publishes production and manufacturing execution events. |
| SCADA Integration | Publishes supervisory control and alarm events. |
| IoT Gateway | Publishes sensor readings from edge devices. |
| Digital Twin Simulator | Publishes simulated machine state changes. |

Producers should focus on facts. They should not duplicate downstream alert or insight logic.

### 6.3 Event Trigger Timing

Producers should not publish events on a blind fixed interval. When an event is published depends on what kind of fact it represents.

**Discrete facts** (`STATUS_CHANGED`, `ERROR_OCCURRED`, `MAINTENANCE_REQUIRED`, `PRODUCTION_COMPLETED`) are event-triggered. A producer publishes one event exactly when the fact occurs — a status actually changed, an error actually occurred. There is no periodic form of these events.

**Continuous measurements** (`TEMPERATURE_REPORTED` and similar future sensor readings) come from a sensor that can sample continuously, but the producer should not forward every sample as a Kafka event. Publishing should use **report-by-exception**: only publish when the reading crosses a deadband threshold since the last reported value, or when a maximum reporting interval has elapsed with no change. This keeps event volume proportional to real operational activity rather than sensor sampling rate.

```text
sample continuously
    -> did value change beyond deadband threshold since last reported value?
        yes -> publish TEMPERATURE_REPORTED
        no  -> did maxReportInterval elapse since last publish?
            yes -> publish TEMPERATURE_REPORTED (heartbeat)
            no  -> do not publish
```

In the MVP, the Machine Simulator publishes events on demand through the dashboard's simulator controls, so this rule does not yet apply. It becomes relevant when a real producer (PLC, IoT Gateway, OPC UA) replaces the simulator in a later phase — see `docs/design/architecture.md` section 17, Phase 5.

---

## 7. Event Consumers

Event consumers react to machine events.

| Consumer | Responsibility |
| --- | --- |
| Event Service | Stores complete immutable event history. |
| Machine Service | Builds current machine state projection. |
| Alert Service | Applies rules and creates alerts when needed. |
| Insight Service | Prepares event context for AI summaries. |
| Future Predictive Maintenance Service | Detects risk patterns from event history. |
| Future Digital Twin Service | Updates simulated factory state. |

For the MVP, these consumers can be implemented inside one NestJS backend process. The important design boundary is still the same: each consumer has its own responsibility.

---

## 8. Kafka Topics

The MVP uses one primary topic:

```text
machine.events
```

Recommended message key:

```text
machineId
```

Using `machineId` as the Kafka message key helps preserve ordering for events from the same machine within a partition.

### 8.1 Topic Naming Convention

Topic names should use lowercase dot notation:

```text
<domain>.<event-stream>
```

Examples:

```text
machine.events
machine.status.updated
machine.alerts.created
insight.summary.generated
maintenance.prediction.generated
digital-twin.state.updated
```

Derived topics should be added only when there is a real consumer boundary.

---

## 9. Validation Rules

All incoming events must pass validation before being stored or used for projections.

### 9.1 Envelope Validation

Required fields:

* `eventId`
* `eventType`
* `schemaVersion`
* `source`
* `machineId`
* `occurredAt`
* `producedAt`
* `payload`

Rules:

* `eventId` must be unique.
* `eventType` must be supported.
* `schemaVersion` must be supported by the consumer.
* `machineId` must be present and non-empty.
* `occurredAt` must be a valid ISO 8601 timestamp.
* `producedAt` must be a valid ISO 8601 timestamp.
* `payload` must match the schema for `eventType`.

### 9.2 Payload Validation

| Event Type | Required Payload Fields |
| --- | --- |
| `STATUS_CHANGED` | `currentStatus` |
| `TEMPERATURE_REPORTED` | `temperature`, `unit` |
| `ERROR_OCCURRED` | `errorCode`, `errorMessage` |
| `MAINTENANCE_REQUIRED` | `maintenanceType`, `reason` |
| `PRODUCTION_COMPLETED` | `quantity` |

Invalid events should not update projections.

---

## 10. Versioning Strategy

The MVP uses:

```text
schemaVersion = 1
```

Versioning rules:

* Add optional fields when possible.
* Do not change the meaning of existing fields.
* Do not remove fields used by active consumers.
* Introduce a new `schemaVersion` for incompatible changes.
* Consumers should reject unsupported schema versions clearly.

Compatible change example:

```text
Add optional payload.batchId to PRODUCTION_COMPLETED.
```

Incompatible change example:

```text
Rename machineId to assetId without supporting both fields.
```

---

## 11. Example Events

### 11.1 `TEMPERATURE_REPORTED`

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

Possible consumer interpretation:

```text
Machine Service:
  currentTemperature = 95
  status = WARNING if threshold is exceeded

Alert Service:
  create warning alert if temperature exceeds configured threshold

Insight Service:
  include event in recent machine context
```

### 11.2 `ERROR_OCCURRED`

```json
{
  "eventId": "evt_error_001",
  "eventType": "ERROR_OCCURRED",
  "schemaVersion": 1,
  "source": "MACHINE_SIMULATOR",
  "machineId": "M-002",
  "occurredAt": "2026-07-02T10:35:00.000Z",
  "producedAt": "2026-07-02T10:35:01.000Z",
  "correlationId": "corr_demo_002",
  "payload": {
    "errorCode": "E_STOP_MANUAL",
    "errorMessage": "Operator pressed emergency stop.",
    "recoverable": true
  }
}
```

Possible consumer interpretation:

```text
Machine Service:
  status = ERROR
  healthScore decreases

Alert Service:
  create critical alert
```

### 11.3 `PRODUCTION_COMPLETED`

```json
{
  "eventId": "evt_prod_001",
  "eventType": "PRODUCTION_COMPLETED",
  "schemaVersion": 1,
  "source": "MACHINE_SIMULATOR",
  "machineId": "M-003",
  "occurredAt": "2026-07-02T10:40:00.000Z",
  "producedAt": "2026-07-02T10:40:01.000Z",
  "correlationId": "corr_demo_003",
  "payload": {
    "quantity": 1,
    "batchId": "BATCH-20260702-001"
  }
}
```

Possible consumer interpretation:

```text
Machine Service:
  productionCount increases
  status = RUNNING
  healthScore may increase slightly

Alert Service:
  no alert
```

### 11.4 `STATUS_CHANGED`

```json
{
  "eventId": "evt_status_001",
  "eventType": "STATUS_CHANGED",
  "schemaVersion": 1,
  "source": "MACHINE_SIMULATOR",
  "machineId": "M-004",
  "occurredAt": "2026-07-02T10:45:00.000Z",
  "producedAt": "2026-07-02T10:45:01.000Z",
  "correlationId": "corr_demo_004",
  "payload": {
    "previousStatus": "IDLE",
    "currentStatus": "RUNNING",
    "reason": "Production cycle started."
  }
}
```

---

## 12. Future Extensions

Future event types may support more advanced factory operations:

```text
QUALITY_CHECK_FAILED
ENERGY_USAGE_REPORTED
VIBRATION_REPORTED
WORK_ORDER_CREATED
SOP_RECOMMENDED
PREDICTIVE_MAINTENANCE_RISK_DETECTED
DIGITAL_TWIN_STATE_UPDATED
AGENT_INVESTIGATION_STARTED
AGENT_INVESTIGATION_COMPLETED
```

Future extensions should support:

* Predictive maintenance from historical patterns.
* Digital Twin state replay and simulation.
* AI agent investigation workflows.
* SOP and RAG-based recommendations.
* Integration with real PLC, MES, SCADA, and IoT data sources.

Each new event type should define:

* Event purpose.
* Payload schema.
* Producer.
* Consumers.
* Projection behavior.
* Versioning impact.
