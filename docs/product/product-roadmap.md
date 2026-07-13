# IFOC Roadmap

IFOC aims to evolve from a lightweight factory monitoring system into an AI-powered operational platform capable of event analysis, intelligent assistance, and Digital Twin integration.

## What is IFOC?

**IFOC (Intelligent Factory Operations Copilot)** is an AI-powered platform designed to monitor factory operations, process industrial events, and assist operators with intelligent insights.

The project evolves incrementally through five phases, starting from a lightweight factory dashboard and eventually becoming an AI-driven Digital Twin platform.

---

# Project Roadmap

| Phase   | Name                     | Goal                                        |
| ------- | ------------------------ | ------------------------------------------- |
| Phase 1 | Factory Foundation       | Build the core factory monitoring platform  |
| Phase 1.1 | Observability Foundation | Make the platform's own behavior visible (traces, structured logs, metrics) |
| Phase 1.2 | Responsive Operator UI | Make the dashboard usable on the devices operators actually carry (tablet, phone) |
| Phase 2 | Event Streaming          | Build an event-driven architecture          |
| Phase 3 | Operational Intelligence | Transform events into operational knowledge |
| Phase 4 | AI Copilot               | Provide AI-assisted operational support     |
| Phase 5 | Digital Twin             | Connect to real factory environments        |

---

# Phase 1 — Factory Foundation

## Objective

Build the minimum viable intelligent factory platform.

### Features

* Dashboard
* Machine List
* Machine Detail
* Event Center
* Event Simulator
* Machine Status Monitoring
* Factory Statistics
* Health Score

### Week 1 MVP

* Dashboard
* Machine List
* Machine Detail
* Event Center
* Simulator
「ㄤ* Kafka Event Flow
* AI Summary *(Preview of Phase 4)*

---

# Phase 1.1 — Observability Foundation

## Objective

Make the platform's own runtime behavior observable — the services currently log ad hoc to stdout, HTTP failures leave no trace, and nothing correlates a request to the Kafka consumers it triggers. Added 2026-07-12 as its own sub-phase because the work is substantial enough not to fold into Phase 1, and foundational enough not to wait for Phase 2.

### Features

* OpenTelemetry instrumentation on the backend (auto-instrumented HTTP / Mongoose / kafkajs traces and metrics, vendor-neutral OTLP output)
* Structured JSON logging with trace correlation (`trace_id` in every request-scoped log line; event `correlationId` on consumer spans and logs)
* Grafana observability stack as ONE demo container (`grafana/otel-lgtm`: Collector + Loki + Tempo + Prometheus + Grafana) — deliberately demo-weight; this project does not deploy to production, and the OTLP interface means a real LGTM stack can replace the container later without touching application code
* Graceful degradation: the platform runs identically when the observability container is absent

### Scope Notes

* Frontend (browser) telemetry is out of scope — backend first.
* No paid/hosted observability services (consistent with the no-spend-before-Phase-3 decision).

---

# Phase 1.2 — Responsive Operator UI

## Objective

Make the frontend usable on the devices factory monitoring actually happens on — tablets carried by operators on the floor and phones used by supervisors/on-call — without regressing the control-room desktop layout. Added 2026-07-12; the MVP frontend was consciously desktop-only (add-frontend-mvp Non-Goal), and this sub-phase pays that debt.

### Features

* Bottom tab-bar navigation on phones (desktop keeps the top horizontal menu)
* Machine List renders as touch-friendly cards on phones; lookup tables (Event Center, detail event lists) trim columns and scroll horizontally
* Side-by-side layouts (Dashboard, Machine Detail) stack below the tablet breakpoint
* Naive UI breakpoint system (640 / 1024) — no custom breakpoints, no new dependencies
* Verified at three viewports via the existing Playwright flow

### Scope Notes

* The standing rule `ai/rules/frontend-responsive.md` (every frontend change states its phone/tablet behavior at design time) was established alongside this sub-phase and applies to all future frontend work.
* Desktop layout must not regress — the control room remains a first-class target.

---

# Phase 2 — Event Streaming

## Objective

Transform the system into an event-driven platform.

### Features

* Kafka Event Streaming
* Rule Engine *(also unifies event interpretation logic currently duplicated across Machine Service and Alert Service — see `docs/design/machine-schema.md` §5.4)*
* Incident Management
* Notification Center
* Event Replay
* Real-time Update via SSE invalidate *(decided 2026-07-13: the dashboard's data flow is purely server→client, so Server-Sent Events pushing tiny "changed" notifications that invalidate frontend queries is the correct mechanism — not a budget WebSocket; WebSocket is reconsidered only if a genuinely bidirectional streaming need ever emerges, and none is on this roadmap)*
* Event History
* Alert Acknowledgment & Resolution Workflow
* Alert Escalation Rules (for unresolved critical alerts)

---

# Phase 3 — Operational Intelligence

## Objective

Convert factory data into operational knowledge.

### Features

* Real LLM provider hookup (decided 2026-07-12: Phase 1/2 ship with the built-in `mock` provider — no paid API spending before this phase; the `LlmClient` interface and env switching are already in place, so this is one adapter file at phase entry, and RAG below requires it anyway)
* SOP Knowledge Base
* RAG
* Event Search
* Root Cause Analysis
* Machine History
* Maintenance History
* Production Analytics, including:
  * Downtime Frequency Tracking
  * Mean Time to Acknowledge / Resolve (MTTA / MTTR)
  * Repeated Issue Pattern Analysis
  * Bottleneck & High-Risk Equipment Identification

---

# Phase 4 — AI Copilot

## Objective

Assist factory operators with AI-generated insights and recommendations.

### Features

* AI Chat
* AI Summary
* AI Recommendation
* Root Cause Explanation
* Recovery Suggestion
* Work Order Suggestion
* Predictive Maintenance
* Maintenance Planning

---

# Phase 5 — Digital Twin

## Objective

Connect the platform with real industrial environments.

### Features

* OPC UA Integration
* PLC Integration
* Live Sensor Data
* Real-time Factory Visualization
* 3D Factory View
* Digital Twin Simulation
* Multi-line Monitoring
* Event Translation Layer — map vendor/company-specific event codes and severity levels onto the IFOC standard event schema (`docs/design/event-schema.md`), since real PLC/SCADA/MES sources won't natively emit IFOC's format

---

# Future Consideration (Not Yet Scoped) — Multi-Tenant SaaS Platform

This is a placeholder, not a committed phase. Turning IFOC from a single-factory operations copilot into a product sold to multiple companies is a strategic positioning decision, not an incremental feature — it would require revisiting the MVP scope boundaries (`ai/context/mvp-scope-boundaries.md`), which explicitly exclude authentication and multi-tenant support, and needs its own dedicated discussion before it's placed in the sequential roadmap above.

Rough shape, for future reference:

* Tenant → factory → production line → machine hierarchy
* Role-based access control
* Per-tenant event code / severity mappings (builds on the Phase 5 Event Translation Layer)
* Per-tenant alert rules
* Separate document knowledge bases per tenant (builds on Phase 3's SOP Knowledge Base / RAG)

---

# Future Vision

```text
Factory
    │
    ▼
Industrial Events
    │
    ▼
Event Streaming
    │
    ▼
Operational Intelligence
    │
    ▼
AI Copilot
    │
    ▼
Digital Twin
```

Diagram source: [`docs/assets/mermaid/roadmap-evolution.mmd`](../assets/mermaid/roadmap-evolution.mmd).
