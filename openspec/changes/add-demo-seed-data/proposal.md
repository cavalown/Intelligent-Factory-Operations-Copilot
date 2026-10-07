## Why

The dashboard currently starts with only three idle machines and no event history, so most cards, status distributions, alerts, and event views look empty in a fresh demo. A reproducible demo-data seed gives the dashboard enough varied, internally consistent data to communicate the product without manual form entry.

## What Changes

- Expand the fixed demo roster with additional machine profiles covering multiple factory equipment types and thresholds.
- Add an explicit command that publishes a curated set of valid events through the existing Simulator API, allowing Kafka consumers to build event history, machine projections, alerts, transitions, and dashboard metrics normally.
- Make the demo-event seed safe to run again by detecting its deterministic event identifiers before publishing.
- Document how to load the demo dataset after the Compose stack is running.

## Capabilities

### New Capabilities

- `demo-data-seeding`: Defines the reproducible machine roster and opt-in event dataset used to populate a fresh local dashboard.

### Modified Capabilities

None.

## Impact

- Backend machine seed roster and package scripts.
- A new dependency-free Node.js demo seed script that calls the existing HTTP API.
- Local-development and Docker Compose documentation.
- No API, event-schema, persistence-schema, or production-runtime behavior changes.
