# operator-ui Specification (delta)

## ADDED Requirements

### Requirement: The UI is usable at phone and tablet widths without desktop regression
All five pages SHALL be usable at phone (<640px) and tablet (640–1024px) widths — no horizontal page scroll, no overlapping or clipped content, touch-adequate interactive targets — while the desktop (≥1024px) layout remains as it is today. Breakpoints follow Naive UI's system (640/1024); per `ai/rules/frontend-responsive.md`, every future frontend change states its narrow-width behavior.

#### Scenario: Pages render within the viewport on a phone
- **WHEN** any of the five pages is opened at a 390px-wide viewport
- **THEN** the page renders without horizontal body scrolling and all content sections are reachable by vertical scrolling

#### Scenario: Desktop unchanged
- **WHEN** the pages are opened at ≥1024px
- **THEN** the existing top-menu layout, side-by-side rows, and full tables render as before this change

### Requirement: Phones navigate via a bottom tab bar
At phone widths the app SHALL present a fixed bottom tab bar with the four destinations (Dashboard, Machines, Event Center, Simulator) replacing the top menu; content SHALL NOT be obscured behind it.

#### Scenario: Tab bar replaces the top menu
- **WHEN** the app is viewed at a phone width
- **THEN** the bottom tab bar is visible with the active destination highlighted, the top horizontal menu is absent, and tapping a tab navigates to that page

### Requirement: Machine List becomes a card list on phones
At phone widths the Machine List SHALL render each machine as a tappable card (status tag and name prominent; temperature, health score, and last-updated visible) instead of a table, preserving the `?status=` drill-down filter and navigation to Machine Detail.

#### Scenario: Cards on phone, table elsewhere
- **WHEN** the Machine List is opened at a phone width with a `?status=WARNING` filter
- **THEN** only WARNING machines appear as cards with the clearable filter indicator, and tapping a card opens that machine's detail page; at tablet/desktop widths the table rendering is used

### Requirement: Event tables adapt on narrow widths
Event tables (Event Center, Dashboard recent events, Machine Detail events) SHALL drop the payload column at phone widths and scroll horizontally within their own container if still too wide — never forcing whole-page horizontal scroll.

#### Scenario: Trimmed event table on phone
- **WHEN** the Event Center is opened at a phone width
- **THEN** time, machine, and event type remain visible (payload column absent), color-coding by eventType is preserved, and any overflow scrolls inside the table container only

### Requirement: Side-by-side layouts stack on narrow widths
The Dashboard's events/alerts/summary row and Machine Detail's events/summary row SHALL stack vertically below the tablet breakpoint, each section taking full width; Machine Detail's description grid SHALL reduce its column count on narrow widths.

#### Scenario: Dashboard stacks on tablet portrait
- **WHEN** the Dashboard is opened at a 768px-wide viewport
- **THEN** Recent Events, Active Alerts, and the AI Summary card appear stacked full-width in that reading order, none clipped
