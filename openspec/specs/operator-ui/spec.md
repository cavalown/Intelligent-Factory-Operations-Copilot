# operator-ui Specification

## Purpose
The five-page Vue 3 operator dashboard (Dashboard, Machine List, Machine Detail, Event Center, Simulator) per `docs/product/mvp.md`: page contents, 5-second polling as the MVP's real-time mechanism, AI-summary advisory isolation (502 never blanks a page), event-type-only coloring (no derived severity), and client-side simulator envelope construction. Introduced by change `add-frontend-mvp` (2026-07-11).

## Requirements

### Requirement: Dashboard shows the factory overview
The Dashboard page SHALL display the factory statistics from `GET /dashboard/stats` (running/warning/critical counts, production count, average health score), a recent-events widget from `GET /events`, and the factory-scope AI Summary Card from `GET /summary`, per `docs/product/mvp.md`.

#### Scenario: Dashboard renders factory state
- **WHEN** the operator opens the Dashboard with machines and events present
- **THEN** stat tiles show counts derived from `statusCounts` (Critical = `ERROR`), production count, and average health score, and the recent-events widget lists the newest cross-machine events

#### Scenario: Stats reflect changes within one poll cycle
- **WHEN** a simulated event changes a machine's status while the Dashboard is open
- **THEN** the stat tiles and recent events update within one 5-second polling interval without a manual reload

### Requirement: Machine List shows all machines
The Machine List page SHALL display every machine from `GET /machines` with name, status, current temperature, health score, and last-updated time, and SHALL navigate to that machine's detail page on selection.

#### Scenario: List renders machine rows
- **WHEN** the operator opens the Machine List
- **THEN** each machine appears with name, status, current temperature, health score, and last-updated time, and clicking a row opens Machine Detail for that `machineId`

### Requirement: Machine Detail shows one machine's operational picture
The Machine Detail page SHALL display the machine's information and current state from `GET /machines/:id`, its recent events from `GET /machines/:id/events`, and its AI summary from `GET /machines/:id/summary`.

#### Scenario: Detail renders machine state and history
- **WHEN** the operator opens Machine Detail for an existing machine
- **THEN** the page shows the machine's profile, status, health score, and its recent events most-recent-first

#### Scenario: Unknown machine id
- **WHEN** the operator navigates to a detail URL for a nonexistent machine
- **THEN** the page shows a not-found state (no blank page, no unhandled error)

### Requirement: AI summary is an advisory, explicitly-triggered feature
Summary cards (Dashboard: factory scope; Machine Detail: machine scope) SHALL render the stored summary with its `recommendedActions` and a regenerate action; SHALL show a generate call-to-action when no summary exists yet (`404 SUMMARY_NOT_FOUND`); and SHALL show an inline error with retry on `502 LLM_CALL_FAILED` while the rest of the page continues to render, per `architecture.md` §16.

#### Scenario: First-time generate
- **WHEN** no summary exists and the operator clicks the generate action
- **THEN** the card shows a loading state during the synchronous `POST`, then renders the new summary and recommended actions

#### Scenario: LLM failure stays contained
- **WHEN** a summary `POST` returns `502 LLM_CALL_FAILED`
- **THEN** only the summary card shows an error state with a retry action; machine, event, and stats content elsewhere on the page remains visible and polling

### Requirement: Event Center shows the cross-machine timeline without severity
The Event Center page SHALL list events from `GET /events` most-recent-first with machine, event type, and timestamp; SHALL color-code rows by `eventType` only (never a derived severity); and SHALL page backwards through history using the API's `before` cursor.

#### Scenario: Timeline renders and colors by event type
- **WHEN** the operator opens the Event Center
- **THEN** events appear most-recent-first showing machine, event type, and timestamp, with row accents derived solely from `eventType`

#### Scenario: Load more pages backwards
- **WHEN** the operator activates "Load more" and `pagination.hasMore` was true
- **THEN** the next older page (fetched with `before` = last event's id) is appended to the timeline

### Requirement: Simulator page publishes well-formed events
The Simulator page SHALL let the operator pick a machine and one of the five MVP event types, fill the payload fields for that type, and POST a complete envelope (client-generated `eventId`, `occurredAt`, `producedAt`, `correlationId`, `schemaVersion`, `source: "MACHINE_SIMULATOR"`) to `/simulator/events`, surfacing the accepted/rejected outcome.

#### Scenario: Send a temperature event
- **WHEN** the operator selects a machine, chooses `TEMPERATURE_REPORTED`, enters a temperature, and submits
- **THEN** the page POSTs a complete envelope and shows the `202 PUBLISHED` confirmation with the `eventId`

#### Scenario: Validation errors are surfaced
- **WHEN** the backend rejects the event (`400`/`404`/`422`)
- **THEN** the page shows the error envelope's code and message without losing the form state

### Requirement: Live data polls every 5 seconds
Machine, event, and stats queries SHALL poll at a 5-second interval while their page is visible; AI summary queries SHALL NOT poll and SHALL refetch only on demand or after a successful regenerate.

#### Scenario: Demo loop needs no manual refresh
- **WHEN** the operator sends a simulator event and switches to the Dashboard or Machine List
- **THEN** the affected machine's status change appears within one polling interval without any manual refresh action

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

### Requirement: The UI is usable at phone and tablet widths without desktop regression
All five pages SHALL be usable at phone (<640px) and tablet (640–1024px) widths — no horizontal page scroll, no overlapping or clipped content, touch-adequate interactive targets — while the desktop (≥1024px) layout remains as it is today. Breakpoints follow Naive UI's system (640/1024); per `ai/rules/frontend-responsive.md`, every future frontend change states its narrow-width behavior.

#### Scenario: Pages render within the viewport on a phone
- **WHEN** any of the five pages is opened at a 390px-wide viewport
- **THEN** the page renders without horizontal body scrolling and all content sections are reachable by vertical scrolling

#### Scenario: Desktop unchanged
- **WHEN** the pages are opened at ≥1024px
- **THEN** the existing top-menu layout, side-by-side rows, and full tables render as before this change

### Requirement: Phones navigate via a bottom tab bar
At phone widths the app SHALL present a fixed bottom tab bar with the four destinations (Dashboard, Machines, Event Center, Simulator) replacing the top menu; content SHALL NOT be obscured behind it.

#### Scenario: Tab bar replaces the top menu
- **WHEN** the app is viewed at a phone width
- **THEN** the bottom tab bar is visible with the active destination highlighted, the top horizontal menu is absent, and tapping a tab navigates to that page

### Requirement: Machine List becomes a card list on phones
At phone widths the Machine List SHALL render each machine as a tappable card (status tag and name prominent; temperature, health score, and last-updated visible) instead of a table, preserving the `?status=` drill-down filter and navigation to Machine Detail.

#### Scenario: Cards on phone, table elsewhere
- **WHEN** the Machine List is opened at a phone width with a `?status=WARNING` filter
- **THEN** only WARNING machines appear as cards with the clearable filter indicator, and tapping a card opens that machine's detail page; at tablet/desktop widths the table rendering is used

### Requirement: Event tables adapt on narrow widths
Event tables (Event Center, Dashboard recent events, Machine Detail events) SHALL drop the payload column at phone widths and scroll horizontally within their own container if still too wide — never forcing whole-page horizontal scroll.

#### Scenario: Trimmed event table on phone
- **WHEN** the Event Center is opened at a phone width
- **THEN** time, machine, and event type remain visible (payload column absent), color-coding by eventType is preserved, and any overflow scrolls inside the table container only

### Requirement: Side-by-side layouts stack on narrow widths
The Dashboard's events/alerts/summary row and Machine Detail's events/summary row SHALL stack vertically below the tablet breakpoint, each section taking full width; Machine Detail's description grid SHALL reduce its column count on narrow widths.

#### Scenario: Dashboard stacks on tablet portrait
- **WHEN** the Dashboard is opened at a 768px-wide viewport
- **THEN** Recent Events, Active Alerts, and the AI Summary card appear stacked full-width in that reading order, none clipped
