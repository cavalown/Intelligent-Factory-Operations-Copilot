# Architecture

## 1. Purpose

**IFOC (Intelligent Factory Operations Copilot)** is a smart factory operations platform designed to help engineers and operators understand factory conditions, investigate machine events, and receive AI-assisted operational insights.

The project starts from a focused MVP: simulate machine events, process them through an event-driven pipeline, persist operational history, visualize machine status, and generate concise AI summaries.

The purpose of this architecture is to make the system:

* Simple enough to build as an MVP.
* Structured enough to evolve into a production-grade platform.
* Event-driven from the beginning.
* Ready for future AI Copilot, Predictive Maintenance, and Digital Twin capabilities.

This document describes the target architecture direction, the MVP architecture, and the path from a modular monolith to future distributed services.

---

## 2. Architecture Vision

IFOC should evolve from a lightweight factory dashboard into an intelligent operations platform.

The long-term vision is:

```text
Factory Machines
    -> Industrial Events
    -> Event Streaming Platform
    -> Operational Projections
    -> AI-Assisted Insights
    -> Predictive Maintenance
    -> Digital Twin
```

The system should not be designed around AI alone. AI is an important capability, but it is built on top of reliable event history, machine state, alerts, and operational context.

The architecture therefore centers on events:

* Events describe what happened.
* Projections describe what the system currently knows.
* APIs expose useful views to operators.
* AI summarizes and explains operational context.

---

## 3. Architecture Principles

1. **Start simple, but design for extension.**  
   The MVP should be small and buildable, but core boundaries should support future growth.

2. **Use event-driven architecture as the backbone.**  
   Kafka is not just a queue. It is the event hub that allows multiple parts of the system to react to the same machine event independently.

3. **Record each event once.**  
   A machine event should be stored as immutable operational history. Other modules build their own views from that event.

4. **Separate history from current state.**  
   Event Service owns history. Machine Service owns current machine state as a projection.

5. **AI is a capability, not the center of the system.**  
   AI should explain and assist based on trusted operational data. It should not replace event history or machine state as the source of truth.

6. **Prefer modular monolith before microservices.**  
   The MVP should use clear module boundaries inside one backend before splitting into independent services.

7. **Align architecture with the product roadmap.**  
   Each roadmap phase should map naturally to an architecture evolution.

8. **Avoid over-engineering the MVP.**  
   The system should prove the core flow first, then add complexity only when there is a real need.

---

## 4. System Context

IFOC sits between factory data sources and factory operators.

In the MVP, machine data comes from a simulator. In future phases, the simulator can be replaced or extended by real industrial integrations such as PLC, OPC UA, SCADA, MES, IoT sensors, or edge gateways.

```text
┌─────────────────────┐
│ Factory Data Source │
│ Simulator / PLC /   │
│ OPC UA / Sensors    │
└──────────┬──────────┘
           │ Machine Events
           ▼
┌─────────────────────┐
│ IFOC Platform       │
│ Event Processing    │
│ Machine State       │
│ Alerts              │
│ AI Insights         │
└──────────┬──────────┘
           │ Operational Views
           ▼
┌─────────────────────┐
│ Operators /         │
│ Engineers           │
└─────────────────────┘
```

The MVP focuses on proving the platform behavior without requiring real factory connectivity.

---

## 5. High-Level Architecture

The target architecture is event-driven. One machine event can create multiple projections without changing the original event.

```text
                +----------------------+
                |  Machine Simulator   |
                +----------+-----------+
                           |
                           | machine.events
                           ▼
                  +------------------+
                  |      Kafka       |
                  +--------+---------+
                           |
        +------------------+------------------+
        |                  |                  |
        ▼                  ▼                  ▼
+----------------+  +----------------+  +----------------+
| Event Service  |  | Machine Service|  | Alert Service  |
+----------------+  +----------------+  +----------------+
        |                  |                  |
        +---------+--------+---------+--------+
                  |                  |
                  ▼                  ▼
          +-------------------------------+
          |        Insight Service        |
          +---------------+---------------+
                          |
                          ▼
                  +---------------+
                  |   API Layer   |
                  +-------+-------+
                          |
                          ▼
                  +---------------+
                  |   Dashboard   |
                  +---------------+
```

Mermaid source (for exporting to `.svg`/`.png`/`.drawio`): [`docs/assets/mermaid/architecture.mmd`](../assets/mermaid/architecture.mmd). This is the Phase 1/MVP snapshot only — see the scope note at the top of that file before reusing it for a later roadmap phase.

For the MVP, these services are implemented as modules inside a NestJS modular monolith. The architecture still names them as services because each module has a clear responsibility and can be extracted later.

MVP runtime flow:

```text
Simulator
    -> REST API
    -> Kafka
    -> Event Consumer
    -> MongoDB
    -> Dashboard
    -> AI Summary
```

---

## 6. Technology Stack

| Layer | Technology | Reason |
| --- | --- | --- |
| Frontend | Vue 3, TypeScript | Build a modern dashboard with typed UI logic and component-based development. |
| Backend | NestJS | Provides modular backend structure, dependency injection, REST APIs, and Kafka integration. |
| Messaging | Kafka | Acts as the event backbone for asynchronous processing and future service decoupling. |
| Database | MongoDB | Stores flexible machine events, machine projections, alerts, and AI summaries. |
| AI | LLM API | Generates operational summaries and recommendations from event context. |
| Local Runtime | Docker Compose | Runs frontend, backend, Kafka, and MongoDB locally for MVP development. |

The selected stack supports fast MVP delivery while keeping a realistic path toward production architecture.

---

## 7. Core Components

### 7.1 Machine Simulator

The Machine Simulator generates machine events for demos and local development.

Supported MVP events:

* `TEMPERATURE_HIGH`
* `EMERGENCY_STOP`
* `SENSOR_FAILURE`
* `MAINTENANCE_REQUIRED`
* `PRODUCTION_COMPLETED`

The simulator does not directly update machine state. It creates events and publishes them into the event pipeline.

### 7.2 Kafka

Kafka is the central event hub.

Initial MVP topic:

```text
machine.events
```

Kafka allows the system to add new consumers without changing existing event producers.

Future topics may include:

```text
machine.status.updated
machine.alerts.created
insight.summary.requested
insight.summary.generated
maintenance.prediction.generated
digital-twin.state.updated
```

The MVP should start with the minimum number of topics required to prove the architecture.

### 7.3 Event Service

Event Service is responsible for complete event history.

Responsibilities:

* Consume machine events from Kafka.
* Validate event payloads.
* Store immutable event records.
* Provide event query APIs.
* Preserve operational history for future analysis.

Event Service answers:

```text
What happened?
When did it happen?
Which machine did it happen to?
```

### 7.4 Machine Service

Machine Service is responsible for current machine state.

Responsibilities:

* Maintain machine profile data.
* Maintain current status.
* Maintain health score.
* Maintain latest temperature and production count.
* Build the machine projection from incoming events.

Machine Service answers:

```text
What is the current state of this machine?
```

### 7.5 Alert Service

Alert Service is responsible for operational problems.

Responsibilities:

* Evaluate warning and critical events.
* Create alert records.
* Track alert status.
* Provide alert history for dashboard and investigation.

Alert Service answers:

```text
What needs attention?
```

For the MVP, alert logic can be simple and code-based. A configurable rule engine belongs to a later phase.

### 7.6 Insight Service

Insight Service is responsible for AI-assisted analysis.

Responsibilities:

* Collect event context.
* Collect machine state and alert context.
* Build compact prompts for the LLM.
* Generate AI summaries and suggested actions.
* Store AI summary history.

Insight Service answers:

```text
What does the recent operational context mean?
What should the operator consider next?
```

The Insight Service does not own machine truth. It explains data produced by Event, Machine, and Alert services.

### 7.7 API Layer

The API Layer exposes backend data to the dashboard.

Responsibilities:

* Provide REST APIs for frontend views.
* Aggregate data from domain modules.
* Keep frontend-specific response shapes separate from domain storage models.
* Trigger AI summary requests.

### 7.8 Dashboard

The Dashboard is the operator-facing UI.

MVP pages:

* Factory overview
* Machine list
* Machine detail
* Event center
* Simulator controls
* AI summary panel

The dashboard should make current factory status understandable at a glance.

---

## 8. Domain Responsibilities

The core domains are separated by responsibility.

| Domain | Responsibility | Primary Data |
| --- | --- | --- |
| Event | Complete operational history | `machine_events` |
| Machine | Current machine state | `machines` |
| Alert | Problems that require attention | `alerts` |
| Insight | AI-generated analysis | `ai_summaries` |

The same event can be used by multiple domains:

```text
Event:
Machine A temperature reached 95 C.

Produces:
Event History            -> complete record of the event
Machine Current State    -> current temperature is 95 C, status is WARNING
Alert                    -> high temperature warning
Insight                  -> suggest checking cooling system and workload
```

This keeps responsibilities clear:

* Event Service preserves history.
* Machine Service maintains current state.
* Alert Service identifies problems.
* Insight Service performs analysis.

---

## 9. Event-Driven Architecture

Machine events are the foundation of the system.

The key rule is:

```text
One event is recorded once.
Different services build their own projections from that event.
```

Projection flow:

```text
Machine Event
        |
        ▼
 Event Service
        |
        ├────────► Machine Projection
        |
        ├────────► Alert Projection
        |
        └────────► Insight Projection
```

### 9.1 Event History

Event history is append-oriented. Events should not be treated as temporary messages.

An event records a fact:

```text
Machine M-001 reported TEMPERATURE_HIGH at 2026-07-02T10:30:00Z.
```

Once stored, the event becomes part of the operational timeline.

### 9.2 Machine Projection

The machine projection converts event history into current state.

Example:

| Event | Machine Projection |
| --- | --- |
| `TEMPERATURE_HIGH` | Status becomes `WARNING`, health score decreases |
| `EMERGENCY_STOP` | Status becomes `ERROR`, health score decreases significantly |
| `PRODUCTION_COMPLETED` | Status becomes `RUNNING`, production count increases |

The dashboard reads this projection to display current machine status.

### 9.3 Alert Projection

The alert projection converts relevant events into operational alerts.

Example:

| Event Severity | Alert Behavior |
| --- | --- |
| `INFO` | No alert |
| `WARNING` | Create warning alert |
| `CRITICAL` | Create critical alert |

Future versions can replace simple code-based logic with a rule engine.

### 9.4 Insight Projection

The insight projection prepares recent operational context for AI analysis.

It can use:

* Recent event history
* Current machine state
* Active alerts
* Historical alert patterns
* Future SOP or maintenance knowledge

In the MVP, this projection is used for direct LLM summaries only. RAG is intentionally excluded.

### 9.5 Future Consumer Expansion

Because Kafka is the event backbone, future capabilities can be added as new consumers:

```text
machine.events
    ├── Machine State Consumer
    ├── Alert Consumer
    ├── AI Insight Consumer
    ├── Predictive Maintenance Consumer
    └── Digital Twin Consumer
```

This allows future features to be added without rewriting existing event processing logic.

---

## 10. Data Flow

### 10.1 Simulated Event Flow

```text
Operator clicks simulator action
    ↓
Frontend sends REST request
    ↓
Backend simulator creates machine event
    ↓
Backend publishes event to Kafka topic: machine.events
    ↓
Event consumer receives event
    ↓
Event Service stores event history
    ↓
Machine Service updates current state projection
    ↓
Alert Service creates alert when required
    ↓
Dashboard fetches updated views through API
```

### 10.2 Dashboard Query Flow

```text
Dashboard
    ↓
API Layer
    ↓
Read models / projections
    ↓
Machines + Events + Alerts + AI Summaries
    ↓
Dashboard renders operational view
```

### 10.3 AI Summary Flow

```text
Operator opens dashboard or machine detail
    ↓
Dashboard requests AI summary
    ↓
API Layer calls Insight Service
    ↓
Insight Service gathers recent events, machine state, and alerts
    ↓
Insight Service calls LLM API
    ↓
AI summary is stored
    ↓
Dashboard displays summary and suggested actions
```

### 10.4 Event Replay Flow

Event replay is not required for the MVP, but the architecture should prepare for it.

```text
Stored Event History
    ↓
Replay events in timestamp order
    ↓
Rebuild Machine Projection
    ↓
Rebuild Alert Projection
    ↓
Validate historical state transitions
```

This becomes important for debugging, analytics, Digital Twin simulation, and projection recovery.

---

## 11. API Layer

The API Layer is responsible for frontend-facing use cases.

Initial REST APIs:

```text
GET  /machines
GET  /machines/:id
GET  /machines/:id/events
GET  /machines/:id/alerts
GET  /machines/:id/summary
POST /machines/:id/summary
POST /simulator/events
```

API responsibilities:

* Return dashboard-ready data.
* Hide internal persistence details.
* Trigger simulator actions.
* Trigger AI summaries.
* Provide stable contracts for the frontend.

The API Layer should not contain domain rules directly. Domain rules belong to Event, Machine, Alert, and Insight modules.

Detailed API contracts belong in:

```text
docs/design/api.md
```

---

## 12. Data Storage

MongoDB stores operational records and projections for the MVP.

Initial collections:

```text
machines
machine_events
alerts
ai_summaries
```

### 12.1 `machine_events`

Stores immutable event history.

Core fields:

```text
eventId
machineId
eventType
severity
message
timestamp
metadata
createdAt
```

Recommended indexes:

```text
eventId unique
machineId + timestamp
eventType + timestamp
severity + timestamp
```

### 12.2 `machines`

Stores machine profiles and current state projections.

Core fields:

```text
machineId
name
status
healthScore
currentTemperature
productionCount
lastEventId
lastUpdatedAt
```

### 12.3 `alerts`

Stores alert records derived from warning and critical events.

Core fields:

```text
alertId
machineId
eventId
severity
status
message
createdAt
resolvedAt
```

### 12.4 `ai_summaries`

Stores generated AI analysis.

Core fields:

```text
summaryId
machineId
scope
inputEventIds
summary
recommendedActions
model
createdAt
```

AI summaries should be traceable to the events used to generate them.

---

## 13. Deployment Architecture

### 13.1 MVP Deployment

The MVP uses Docker Compose.

Expected services:

```text
frontend
backend
mongodb
kafka
zookeeper or kraft controller
```

MVP deployment goals:

* Easy local startup.
* Repeatable demo environment.
* No Kubernetes requirement.
* No real factory network dependency.

### 13.2 Production Direction

A future production deployment can move toward:

```text
Load Balancer
    ↓
Frontend Static Hosting / CDN
    ↓
Backend API
    ↓
Kafka Cluster
    ↓
Domain Services
    ↓
MongoDB / Operational Database
```

Production architecture should add:

* Managed Kafka or production Kafka cluster.
* Managed database or replicated MongoDB.
* Secret management.
* Observability.
* Authentication and authorization.
* Network isolation.
* Backup and recovery.

---

## 14. Scalability Strategy

The MVP starts as a modular monolith.

This is intentional. The first goal is to prove the product workflow, not to operate a distributed system too early.

### 14.1 MVP Structure

```text
backend/
├── machines/
├── events/
├── alerts/
├── insights/
├── simulator/
└── shared/
```

Each module should own its domain logic and persistence access.

### 14.2 Service Extraction Path

When the system grows, modules can be extracted into services:

```text
event-service
machine-service
alert-service
insight-service
simulation-service
dashboard-api
```

Recommended extraction order:

1. Extract Event Service when event volume grows.
2. Extract Insight Service when AI calls become slow, expensive, or asynchronous.
3. Extract Alert Service when alert rules become configurable and complex.
4. Extract Machine Service when machine state becomes shared across more systems.
5. Add specialized read models when dashboard queries become expensive.

The key is that service extraction should follow real pressure, not happen only for architectural appearance.

---

## 15. Consistency and Reliability

The MVP uses eventual consistency.

When a simulator event is submitted:

1. The backend accepts the request.
2. The event is published to Kafka.
3. Consumers process the event asynchronously.
4. MongoDB projections are updated.
5. The dashboard reads the latest available state.

The dashboard may briefly display previous state before processing completes.

Reliability considerations:

* Use `eventId` for idempotency.
* Avoid duplicate event records.
* Log invalid consumed events.
* Keep AI failure isolated from dashboard availability.
* Prefer retryable processing for transient infrastructure failures.

For the MVP, simple logging and idempotency are enough. Dead letter queues and advanced retry policies can be added later.

---

## 16. Security Considerations

The MVP assumes:

* Local development environment.
* Simulated factory data.
* No personal data.
* No authentication.

Future security work:

* Authentication and authorization.
* Role-based access control.
* API rate limiting.
* Audit logs.
* Secrets management.
* Encrypted environment variables.
* Kafka and MongoDB network restrictions.
* Separate development, staging, and production environments.

AI-specific considerations:

* Do not send unnecessary data to the LLM.
* Keep prompts traceable to source events.
* Treat AI output as advisory.
* Store AI summaries separately from source-of-truth event records.

---

## 17. Future Evolution

The architecture aligns with the product roadmap.

### Phase 1: Factory Foundation

Goal:

* Build the core factory monitoring platform.

Architecture focus:

* Dashboard.
* Machine list and detail.
* Event center.
* Simulator.
* Basic machine state projection.
* Basic AI summary.

### Phase 2: Event Streaming

Goal:

* Strengthen event-driven architecture.

Architecture focus:

* Richer Kafka topics.
* Event replay.
* WebSocket real-time updates.
* Rule engine.
* Incident and notification workflows.

### Phase 3: Operational Intelligence

Goal:

* Transform events into operational knowledge.

Architecture focus:

* Event search.
* Machine history.
* Maintenance history.
* SOP knowledge base.
* RAG.
* Root cause analysis.

### Phase 4: AI Copilot

Goal:

* Assist operators with AI-generated insights and recommendations.

Architecture focus:

* AI chat.
* AI recommendations.
* Recovery suggestions.
* Work order suggestions.
* Multi-step AI agent workflows.
* Tool-using investigation agents.

### Phase 5: Digital Twin

Goal:

* Connect the platform with real factory environments and simulation.

Architecture focus:

* OPC UA integration.
* PLC integration.
* Live sensor data.
* Digital Twin state models.
* Historical event replay.
* What-if simulation.
* 3D factory visualization.

Real producers introduced in this phase (PLC, OPC UA, IoT Gateway) must follow the event trigger timing rule in `docs/design/event-schema.md` section 6.3 — discrete facts stay event-triggered, continuous sensor readings use report-by-exception rather than fixed-interval publishing.

---

## 18. Architecture Decisions (ADR Summary)

| Decision | Choice | Reason |
| --- | --- | --- |
| Backend architecture | Modular monolith first | Faster MVP delivery while preserving clean module boundaries. |
| Event backbone | Kafka | Supports asynchronous processing, event replay direction, and future service decoupling. |
| Database | MongoDB | Flexible event and projection storage for early-stage factory data. |
| API style | REST first | Simple frontend integration and clear MVP contracts. |
| AI strategy | Summary before RAG | AI value can be demonstrated with event summaries before adding knowledge retrieval. |
| Deployment | Docker Compose first | Best fit for local MVP demo and development speed. |
| Service split | Later, pressure-driven | Avoids premature microservices while keeping extraction path clear. |

Detailed ADR files should live under:

```text
docs/decisions/
```

---

## 19. MVP Architecture Summary

The MVP architecture is intentionally small but not throwaway.

It proves that IFOC can:

1. Generate machine events.
2. Publish events through Kafka.
3. Store complete event history.
4. Build machine state and alert projections.
5. Display operational status in a dashboard.
6. Generate AI summaries from trusted event context.

The most important architectural idea is:

```text
Events are the source of operational history.
Projections create useful views.
AI explains the data, but does not replace it.
```

