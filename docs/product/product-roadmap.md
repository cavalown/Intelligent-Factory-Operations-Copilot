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
* Kafka Event Flow
* AI Summary *(Preview of Phase 4)*

---

# Phase 2 — Event Streaming

## Objective

Transform the system into an event-driven platform.

### Features

* Kafka Event Streaming
* Rule Engine
* Incident Management
* Notification Center
* Event Replay
* WebSocket Real-time Update
* Event History
* Alert Acknowledgment & Resolution Workflow
* Alert Escalation Rules (for unresolved critical alerts)

---

# Phase 3 — Operational Intelligence

## Objective

Convert factory data into operational knowledge.

### Features

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

This is a placeholder, not a committed phase. Turning IFOC from a single-factory operations copilot into a product sold to multiple companies is a strategic positioning decision, not an incremental feature — it would require revisiting `CLAUDE.md`'s MVP scope boundaries (authentication and multi-tenant support are both explicitly excluded there) and needs its own dedicated discussion before it's placed in the sequential roadmap above.

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
