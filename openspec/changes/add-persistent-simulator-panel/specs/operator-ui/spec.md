## MODIFIED Requirements

### Requirement: Simulator controls publish well-formed events from every primary view
The application shell SHALL let the operator pick a machine and one of the five MVP event types, fill the payload fields for that type, and POST a complete envelope to `/simulator/events`, surfacing the accepted/rejected outcome without navigating away from the active Dashboard, Machines, Machine Detail, or Event Center view. The controls SHALL appear as a persistent right rail on desktop and an on-demand drawer on tablet and phone.

#### Scenario: Send an event while watching Dashboard
- **WHEN** the operator opens Simulator controls beside Dashboard, selects a machine, enters a valid event, and submits
- **THEN** the application POSTs a complete envelope, keeps Dashboard visible, and shows the `202 PUBLISHED` confirmation

#### Scenario: Validation errors are surfaced
- **WHEN** the backend rejects the event (`400`/`404`/`422`)
- **THEN** the controls show the error code and message without losing form state or navigating away

#### Scenario: Narrow viewport uses a drawer
- **WHEN** the application is viewed below 1024px
- **THEN** Simulator controls are available through a touch-sized action and open in a dismissible drawer without causing horizontal page scroll

### Requirement: Phones navigate via a bottom tab bar
At phone widths the app SHALL present a fixed bottom tab bar with the three primary destinations (Dashboard, Machines, Event Center) replacing the top menu; Simulator SHALL be available from the global shell action instead of occupying a navigation destination, and content SHALL NOT be obscured behind the tab bar.

#### Scenario: Tab bar replaces the top menu
- **WHEN** the app is viewed at a phone width
- **THEN** the bottom tab bar shows three primary destinations, the global Simulator action is reachable, and opening its drawer does not navigate away
