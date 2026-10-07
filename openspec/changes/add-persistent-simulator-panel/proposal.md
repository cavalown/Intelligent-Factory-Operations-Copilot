## Why

The current Simulator is a separate destination, forcing presenters to leave the view whose reaction they want to demonstrate. Keeping event controls beside the active view makes the cause-and-effect loop visible and substantially improves live demos.

## What Changes

- Move Simulator controls into the global application shell.
- Show a persistent right rail on desktop and an on-demand drawer on tablet and phone.
- Remove Simulator as a separate navigation destination while preserving the same form state, validation, and success/error feedback.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `operator-ui`: Simulator controls become globally available alongside every primary view, with responsive rail/drawer behavior.

## Impact

- Frontend application shell, navigation, routing, and Simulator component structure.
- No backend or API contract changes and no new dependencies.
