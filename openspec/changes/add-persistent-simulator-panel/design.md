## Context

`SimulatorPage.vue` currently owns a reusable form but is mounted only by `/simulator`. `App.vue` already owns viewport-aware navigation and is the correct lifetime for controls that must survive route changes.

## Goals / Non-Goals

**Goals:** keep the observed page visible, preserve form state across navigation, and respect the established 640/1024 responsive bands.

**Non-Goals:** change event payloads, add automatic simulation, or alter polling.

## Decisions

1. Extract the form into `SimulatorPanel.vue` and mount one instance in `App.vue`; route changes therefore do not destroy its state.
2. At desktop widths, use a 340px sticky right rail beside a fluid main content column. At tablet/phone widths, use a right-side Naive UI drawer opened by a prominent header button.
3. Remove Simulator from navigation and redirect the legacy `/simulator` URL to Dashboard. This avoids two competing presentations of the same controls while preserving old bookmarks.
4. Keep the drawer mounted so closing it does not reset input.

## Risks / Trade-offs

- [Desktop content becomes narrower] → Raise the shell max width and keep the rail fixed at 340px.
- [Drawer can obscure the page] → This is temporary and dismissible; persistent side-by-side at narrow widths would make both surfaces unusable.
- [Existing Simulator bookmarks] → Redirect to Dashboard where the controls are immediately available.
