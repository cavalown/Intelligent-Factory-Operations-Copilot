# operator-ui Specification (delta)

## ADDED Requirements

### Requirement: Dashboard shows Active Alerts
The Dashboard SHALL display an Active Alerts widget fed by `GET /alerts?status=ACTIVE` (polling on the standard interval), each entry showing severity, machine (linked to its detail page), message, and time.

#### Scenario: Alert appears after a critical event
- **WHEN** an `ERROR_OCCURRED` event is processed while the Dashboard is open
- **THEN** the new CRITICAL alert appears in the widget within one polling interval, linking to the affected machine

### Requirement: Status tiles drill down to a filtered Machine List
Dashboard status tiles (Running / Warning / Critical) SHALL navigate on click to the Machine List filtered to the corresponding status via URL state (`/machines?status=...`), and the Machine List SHALL apply and display that filter.

#### Scenario: Clicking the Warning tile
- **WHEN** the operator clicks the "Warning" tile
- **THEN** the Machine List opens showing only machines with status `WARNING`, with the active filter visible and clearable

### Requirement: Utilization is visible on Dashboard and Machine Detail
The Dashboard SHALL show the factory's rolling-24h production count and operating/stopped/idle durations from `dashboard-stats.last24h`; Machine Detail SHALL show its machine's 24h utilization from `GET /machines/:id/utilization`. Durations SHALL be rendered human-readably (e.g. "6h 24m", not milliseconds).

#### Scenario: Dashboard shows the 24h picture
- **WHEN** the operator opens the Dashboard
- **THEN** tiles/strips show the last-24h production count and the three duration buckets in human-readable form

#### Scenario: Machine Detail shows its own utilization
- **WHEN** the operator opens Machine Detail for a machine with recorded transitions
- **THEN** the page shows that machine's operating/stopped/idle durations for the last 24h
