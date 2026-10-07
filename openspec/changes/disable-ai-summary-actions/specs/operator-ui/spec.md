## MODIFIED Requirements

### Requirement: AI summary is an unavailable advisory preview
Summary cards SHALL continue to render an existing stored summary and its `recommendedActions`, but Generate and Regenerate actions SHALL be disabled while no real LLM provider is integrated. Hovering the disabled-action wrapper SHALL explain that the feature is not yet available. AI summary unavailability MUST NOT affect machine, event, alert, or stats content.

#### Scenario: Existing summary remains readable
- **WHEN** a stored or mock summary exists
- **THEN** its summary and recommended actions remain visible while Regenerate is disabled

#### Scenario: Unavailable action is explained
- **WHEN** an operator hovers the Generate or Regenerate action wrapper
- **THEN** a tooltip displays `此功能尚未開放`

#### Scenario: No summary exists
- **WHEN** no summary exists
- **THEN** the card shows its empty state and a disabled Generate action without issuing a generation request
