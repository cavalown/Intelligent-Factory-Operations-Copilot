## Purpose

Provide an opt-in, reproducible local dataset that makes dashboard machine, event, alert, production, health, and utilization views meaningful in a fresh demo environment.

## ADDED Requirements

### Requirement: Fresh environments contain a varied demo machine roster
The system SHALL seed at least eight uniquely identified demo machines with human-readable names and valid temperature thresholds. Re-running application startup MUST NOT reset projection fields on machines that already exist.

#### Scenario: Fresh database receives the complete roster
- **WHEN** the backend starts against an empty database
- **THEN** the machine list contains at least eight demo machines with unique `machineId` values

#### Scenario: Restart preserves existing machine state
- **WHEN** the backend restarts after events have changed a seeded machine's status, health, temperature, or production count
- **THEN** the seed process leaves those projection values unchanged

### Requirement: Demo events use the normal ingestion path
The project SHALL provide an explicit local command that submits a curated dataset through the existing Simulator API rather than writing derived collections directly. The dataset MUST include multiple machines and a mixture of all five MVP event types.

#### Scenario: Seed populates dashboard data consistently
- **WHEN** an operator runs the demo-data command against a ready backend with the expanded machine roster
- **THEN** events are accepted through the Simulator API and downstream consumers can populate event history, machine projections, alerts, status transitions, and dashboard aggregates

### Requirement: Re-running the demo-event seed is safe
The demo-data command SHALL detect event identifiers already present in event history and skip those events instead of publishing them again.

#### Scenario: Complete dataset already exists
- **WHEN** the operator runs the demo-data command after all curated events have already been persisted
- **THEN** the command publishes no duplicate events and reports that the existing events were skipped

#### Scenario: Partially loaded dataset exists
- **WHEN** some curated event identifiers exist and others are absent
- **THEN** the command publishes only the missing events

### Requirement: Seed failures are actionable
The demo-data command MUST fail with a non-zero exit status and a clear message when the backend is unreachable, required demo machines are missing, or the API rejects an event.

#### Scenario: Backend is not running
- **WHEN** the operator runs the command while the configured API base URL is unreachable
- **THEN** the command exits unsuccessfully and tells the operator which API URL could not be reached

