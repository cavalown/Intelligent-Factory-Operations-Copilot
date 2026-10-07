## Why

The UI currently presents AI generation as available even though the project only has a mock provider. Disabling the action avoids overstating demo readiness while keeping the planned feature visible.

## What Changes

- Disable AI Summary Generate and Regenerate actions.
- Explain on hover that the feature is not yet available.
- Keep any existing stored/mock summary readable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `operator-ui`: AI summary generation becomes a visibly unavailable preview action.

## Impact

- `AiSummaryCard.vue` and MVP documentation only; no API or backend changes.
