## MODIFIED Requirements

### Requirement: Create a WARNING alert when temperature exceeds threshold
The system SHALL, upon consuming a `TEMPERATURE_REPORTED` event whose `temperatureExceedsThreshold` field is `true`, create an alert with `severity: WARNING` and `status: ACTIVE`, per the Alert Rules in `CLAUDE.md` and `docs/design/architecture.md` §9.3. Alert Service reads this classification from the event (computed once by the Rule Engine, per `openspec/changes/add-rule-engine/design.md`) rather than comparing `payload.temperature` to the machine's `temperatureThreshold` itself.

#### Scenario: Alert created for over-threshold temperature
- **WHEN** Alert Service consumes a `TEMPERATURE_REPORTED` event for `M-001` with `temperatureExceedsThreshold: true`
- **THEN** an alert document is created with `machineId: M-001`, `eventId` matching the source event, `severity: WARNING`, `status: ACTIVE`, and a human-readable `message`

### Requirement: No alert when within threshold
The system SHALL NOT create an alert for a `TEMPERATURE_REPORTED` event whose `temperatureExceedsThreshold` field is `false` or absent.

#### Scenario: No alert for normal-range temperature
- **WHEN** Alert Service consumes a `TEMPERATURE_REPORTED` event with `temperatureExceedsThreshold: false`
- **THEN** no alert document is created

### Requirement: Conditionally create a WARNING alert on STATUS_CHANGED
The system SHALL create an alert with `severity: WARNING` and `status: ACTIVE` when consuming a `STATUS_CHANGED` event whose `isSensorFailure` field is `true`, and SHALL NOT create an alert when `isSensorFailure` is `false`. Alert Service reads this classification from the event (computed once by the Rule Engine, per `openspec/changes/add-rule-engine/design.md`) rather than inspecting `payload.currentStatus` itself.

#### Scenario: Alert created when STATUS_CHANGED is classified as sensor failure
- **WHEN** Alert Service consumes a `STATUS_CHANGED` event with `isSensorFailure: true`
- **THEN** an alert document is created with `severity: WARNING` and `status: ACTIVE`

#### Scenario: No alert for a STATUS_CHANGED not classified as sensor failure
- **WHEN** Alert Service consumes a `STATUS_CHANGED` event with `isSensorFailure: false`
- **THEN** no alert document is created
