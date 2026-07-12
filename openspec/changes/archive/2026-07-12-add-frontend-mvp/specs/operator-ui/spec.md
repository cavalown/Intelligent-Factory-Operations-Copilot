# operator-ui Specification (delta)

## ADDED Requirements

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
