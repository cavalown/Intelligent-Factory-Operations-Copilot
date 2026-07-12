# Proposal: add-responsive-ui

## Why

The MVP frontend was consciously desktop-only (add-frontend-mvp listed responsive layouts as a Non-Goal), but factory monitoring's real users hold tablets (operators walking the floor) and phones (supervisors/on-call glancing at status) — on those widths today, the side-by-side layouts collapse into unusable columns, data tables overflow, and the top menu breaks. Decided 2026-07-12 (exploration): this is **Phase 1.2** of the roadmap, paired with the new standing rule `ai/rules/frontend-responsive.md` that makes responsive consideration mandatory for all future frontend work.

## What Changes

- **Navigation**: phones get a bottom tab bar (four destinations, one-handed reach); desktop keeps the top horizontal menu unchanged.
- **Machine List**: renders as touch-friendly cards on phones (machine name + status tag prominent, metrics below) — it is the primary walk-around page; the desktop table is unchanged.
- **Lookup tables** (Event Center, Dashboard recent-events widget, Machine Detail event list): trimmed columns + horizontal scroll on narrow widths — lookup pages tolerate scrolling; cards would be low return.
- **Side-by-side rows** (Dashboard events+alerts/summary, Machine Detail events+summary): stack vertically below the tablet breakpoint.
- **Machine Detail descriptions**: 3-column grid drops to 1–2 columns on narrow widths.
- **Touch targets**: interactive elements on phone/tablet paths sized for touch; no hover-only affordances.
- **Mechanics**: Naive UI's breakpoint system (`useBreakpoint`, NGrid responsive spans, 640/1024) plus minimal media queries — zero new dependencies.
- **Non-regression**: desktop (≥1024) keeps the current layout pixel-for-pixel in intent; the control room stays first-class.

Out of scope: PWA/offline, native gestures, per-device feature differences (all five pages exist on all widths), frontend telemetry, dark mode.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `operator-ui`: gains responsive-behavior requirements (delta adds requirements; existing page-content requirements unchanged).

## Impact

- **Code**: `frontend/src/**` only — App shell (nav), MachineListPage (card mode), EventsTable (column trim + scroll), Dashboard/MachineDetail layout CSS, a small `useIsMobile`-style composable.
- **No backend, API, or compose changes.**
- **Docs**: roadmap Phase 1.2 (already applied with this proposal); `ai/rules/frontend-responsive.md` (already created) is the standing rule this change instantiates.
- **Verification**: existing Playwright flow at three viewports (390 / 768 / 1280) with screenshots per page.
