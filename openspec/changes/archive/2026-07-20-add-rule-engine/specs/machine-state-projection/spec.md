## MODIFIED Requirements

### Requirement: Update projection when temperature exceeds threshold
The system SHALL, upon consuming a `TEMPERATURE_REPORTED` event whose `temperatureExceedsThreshold` field is `true`, raise the machine's `status` to `WARNING` (subject to severity precedence) and decrease `healthScore` by 10, clamped to `[0, 100]`, per `docs/design/machine-schema.md` §4-§5. Machine Service reads this classification from the event (computed once by the Rule Engine, per `openspec/changes/add-rule-engine/design.md`) rather than comparing `payload.temperature` to the machine's `temperatureThreshold` itself.

#### Scenario: Temperature over threshold raises status and lowers health score
- **WHEN** Machine Service consumes a `TEMPERATURE_REPORTED` event for `M-001` with `temperatureExceedsThreshold: true`, and `M-001`'s current status has severity rank at or below `WARNING`
- **THEN** `M-001`'s `status` becomes `WARNING`, `healthScore` decreases by 10 (clamped at 0), `currentTemperature` is set to the reported value, and `lastEventId`/`lastUpdatedAt` are updated

### Requirement: No status or health-score change when within threshold
The system SHALL update only `currentTemperature`, `lastEventId`, and `lastUpdatedAt` when a `TEMPERATURE_REPORTED` event's `temperatureExceedsThreshold` field is `false` or absent.

#### Scenario: Temperature within threshold only updates telemetry
- **WHEN** Machine Service consumes a `TEMPERATURE_REPORTED` event for a machine with `temperatureExceedsThreshold: false`
- **THEN** the machine's `status` and `healthScore` remain unchanged, but `currentTemperature`, `lastEventId`, and `lastUpdatedAt` are updated

### Requirement: Apply STATUS_CHANGED health-score rule
The system SHALL, upon consuming a `STATUS_CHANGED` event whose `isSensorFailure` field is `true`, decrease `healthScore` by 15, clamped to `[0, 100]`. Machine Service reads this classification from the event (computed once by the Rule Engine, per `openspec/changes/add-rule-engine/design.md`) rather than inspecting `payload.currentStatus` itself. Any `STATUS_CHANGED` event with `isSensorFailure: false` results in no health-score change from this event.

#### Scenario: STATUS_CHANGED classified as sensor failure decreases health score
- **WHEN** Machine Service consumes a `STATUS_CHANGED` event with `isSensorFailure: true`
- **THEN** the machine's `healthScore` decreases by 15 (clamped at 0)

#### Scenario: STATUS_CHANGED not classified as sensor failure leaves health score unchanged
- **WHEN** Machine Service consumes a `STATUS_CHANGED` event with `isSensorFailure: false`
- **THEN** the machine's `healthScore` is unchanged by this event
