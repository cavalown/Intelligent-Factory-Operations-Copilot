## Why

Machine status filtering is currently discoverable only after drilling down from Dashboard. Operators who open Machines directly need visible controls for switching among operational states.

## What Changes

- Add status filter controls with live counts to Machines.
- Use segmented controls on tablet/desktop and a select on phone.
- Keep filter state in the existing `?status=` URL contract.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `operator-ui`: Machine List gains directly accessible status filter controls.

## Impact

- Machine List frontend only; no backend or API changes.
