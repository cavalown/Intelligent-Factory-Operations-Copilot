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

Display operational events generated within the factory.

### Requirements

* Event Timeline
* Machine
* Event Type
* Severity
* Timestamp

Filtering is optional for the MVP.

---

## Simulator

Allow users to simulate factory events.

Supported events:

* TEMPERATURE_HIGH
* EMERGENCY_STOP
* SENSOR_FAILURE
* MAINTENANCE_REQUIRED
* PRODUCTION_COMPLETED

---

# Supported Event Types

| Event                | Severity |
| -------------------- | -------- |
| TEMPERATURE_HIGH     | WARNING  |
| EMERGENCY_STOP       | CRITICAL |
| SENSOR_FAILURE       | WARNING  |
| MAINTENANCE_REQUIRED | WARNING  |
| PRODUCTION_COMPLETED | INFO     |

---

# Machine State Rules

| Event                | Machine Status | Health Score |
| -------------------- | -------------- | ------------ |
| TEMPERATURE_HIGH     | WARNING        | -10          |
| EMERGENCY_STOP       | ERROR          | -30          |
| SENSOR_FAILURE       | WARNING        | -15          |
| MAINTENANCE_REQUIRED | MAINTENANCE    | -20          |
| PRODUCTION_COMPLETED | RUNNING        | +2           |

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
* AI Summary is generated from recent events.
* The entire demo can be completed without manual data modification.

---

# Demo Scenario

1. Open the Dashboard.
2. Navigate to the Simulator.
3. Generate a **TEMPERATURE_HIGH** event.
4. Verify the event appears in the Event Center.
5. Verify the machine status changes.
6. Open the Machine Detail page.
7. Review the AI-generated operational summary.
8. Repeat with other supported event types.
