# Minimum Viable Product (MVP)

## Goal

Build the first demonstrable version of **IFOC (Intelligent Factory Operations Copilot)**.

The MVP should demonstrate a complete end-to-end workflow of a modern intelligent factory platform:

* Simulate factory events
* Process events through Kafka
* Persist operational data
* Visualize machine status
* Generate AI-powered operational summaries

The focus of the MVP is **demonstrability**, **simplicity**, and **future extensibility**.

---

# User Story

As a factory operator, I want to monitor machine status and recent factory events so that I can quickly understand the current operational condition and receive AI-assisted insights.

---

# Functional Scope

## Dashboard

Display the current factory overview.

### Requirements

* Factory Overview
* Running Machines
* Warning Machines
* Critical Machines
* Production Count
* Average Health Score
* Recent Events
* AI Summary Card

---

## Machine List

Display all factory machines.

### Requirements

* Machine Name
* Machine Status
* Current Temperature
* Health Score
* Last Updated Time

---

## Machine Detail

Display detailed information for a single machine.

### Requirements

* Machine Information
* Current Status
* Health Score
* Recent Events
* AI Summary

---

## Event Center

Display operational events generated within the factory, across all machines.

### Requirements

* Event Timeline (cross-machine, most-recent-first)
* Machine
* Event Type
* Timestamp

Filtering is optional for the MVP.

### Why There Is No Severity Column

An earlier draft of this section included a `Severity` column. That was a mistake: severity is not a property of a raw event, it's Alert Service's *interpretation* of one (`docs/design/event-schema.md` §3.2 — `eventType`/`payload` are fact, `severity`/`alert`/`machine status` are interpretation). Not every event produces an interpretation either — a within-threshold `TEMPERATURE_REPORTED` or any `PRODUCTION_COMPLETED` never creates an alert (see the `Alert Rules` table below), so a "Severity" cell on those rows would have nothing to show.

Attaching a derived severity to the raw event stream would also let alerting rules retroactively color historical events if those rules ever change (e.g. once Phase 2's Rule Engine exists), which breaks the fact/interpretation separation `event-schema.md` deliberately maintains.

This mirrors how both industrial alarm management and mainstream observability tooling split the same concern into two distinct views:

| Domain | Historical record (no severity) | Actionable / severity-bearing view |
| --- | --- | --- |
| Industrial (ISA-18.2 alarm management) | Event Log | Alarm List (has priority, ACK lifecycle) |
| Datadog | Logs | Monitors |
| Prometheus | Raw metrics | Alertmanager (rules attach `severity` label) |
| PagerDuty | Events API | Incidents (has severity, ACK lifecycle) |
| IFOC | **Event Center** (this section) | **Alerts** (`GET /machines/:id/alerts`, `docs/design/api.md` §4.4) |

Event Center stays a plain, severity-free audit trail of everything that happened; `Event Type` alone is enough to color-code a row in the UI (e.g. `ERROR_OCCURRED` in red) without deriving anything. Anyone who needs "what currently needs attention, and how badly" should look at Alerts, not Event Center.

---

## Simulator

Allow users to simulate factory events.

Supported events:

* STATUS_CHANGED
* TEMPERATURE_REPORTED
* ERROR_OCCURRED
* MAINTENANCE_REQUIRED
* PRODUCTION_COMPLETED

---

# Alert Rules

Alert Service derives severity from event type and payload — raw events have no `severity` field (see `docs/design/event-schema.md` §3.2).

| Event                | Condition            | Alert | Severity |
| --------------------- | --------------------- | ----- | -------- |
| TEMPERATURE_REPORTED  | over threshold         | Yes   | WARNING  |
| ERROR_OCCURRED        | always                 | Yes   | CRITICAL |
| MAINTENANCE_REQUIRED  | always                 | Yes   | WARNING  |
| STATUS_CHANGED        | sensor failure only    | Yes   | WARNING  |
| PRODUCTION_COMPLETED  | never                  | No    | —        |

---

# Machine State Rules

| Event                              | Machine Status | Health Score |
| ----------------------------------- | --------------- | ------------ |
| TEMPERATURE_REPORTED (over threshold) | WARNING       | -10          |
| ERROR_OCCURRED                       | ERROR           | -30          |
| STATUS_CHANGED (sensor failure)      | WARNING         | -15          |
| MAINTENANCE_REQUIRED                 | MAINTENANCE     | -20          |
| PRODUCTION_COMPLETED                 | RUNNING         | +2           |

---

# Event Processing

Every simulated event must follow the same processing pipeline.

```text
Simulator
    ↓
REST API
    ↓
Kafka
    ↓
Event Consumer
    ↓
MongoDB
    ↓
Dashboard
    ↓
AI Summary
```

---

# AI Summary

Generate a concise operational summary based on recent machine events.

Example capabilities:

* Explain the current machine condition.
* Summarize recent alarms.
* Suggest possible next actions.

The MVP uses an LLM only.

Knowledge Base (RAG) is intentionally excluded.

---

# Technology Stack

## Frontend

* Vue 3
* TypeScript

## Backend

* NestJS

## Database

* MongoDB

## Messaging

* Kafka

## AI

* LLM API

## Infrastructure

* Docker Compose

---

# Out of Scope

The following features are intentionally excluded from the MVP.

* Authentication
* User Management
* Rule Engine
* Incident Management
* Notification Center
* RAG
* SOP Knowledge Base
* OPC UA
* PLC Integration
* Digital Twin
* Kubernetes
* Multi-tenant Support
* Predictive Maintenance

---

# Definition of Done

The MVP is considered complete when:

* Dashboard displays factory status.
* Machine list is available.
* Machine detail page is available.
* Event Center displays factory events.
* Simulator generates all supported events.
* Events are published to Kafka.
* Consumer processes all events.
* Events are persisted in MongoDB.
* Machine status is updated correctly.
* AI Summary is generated from recent events. (Phase 1 verified with the mock provider; real LLM at Phase 3 — see `docs/product/product-roadmap.md` Phase 3.)
* The entire demo can be completed without manual data modification.

---

# Demo Scenario

1. Open the Dashboard.
2. Navigate to the Simulator.
3. Generate a **TEMPERATURE_REPORTED** event (above the machine's threshold).
4. Verify the event appears in the Event Center.
5. Verify the machine status changes.
6. Open the Machine Detail page.
7. Review the AI-generated operational summary.
8. Repeat with other supported event types.
