## ADDED Requirements

### Requirement: Machine List provides direct status filtering
The Machine List SHALL expose controls for All, Running, Idle, Warning, Error, and Maintenance, with each option showing its current machine count. Selecting a status SHALL update the existing `?status=` URL state and filter the list; URL state arriving from Dashboard SHALL select the matching control.

#### Scenario: Operator filters directly on Machines
- **WHEN** the operator selects Warning on the Machine List
- **THEN** only `WARNING` machines appear, the Warning control is selected, and the URL contains `?status=WARNING`

#### Scenario: Dashboard drill-down selects the control
- **WHEN** the operator arrives at `/machines?status=ERROR` from Dashboard Critical
- **THEN** the Error control is selected and only `ERROR` machines appear

#### Scenario: Responsive controls
- **WHEN** Machines is viewed on tablet or desktop
- **THEN** all status options appear as segmented buttons; on phone they appear in a touch-sized select without horizontal page scrolling
