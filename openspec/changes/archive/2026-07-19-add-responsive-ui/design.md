# Design: add-responsive-ui

## Context

Current frontend: five pages, Naive UI, desktop-assumed. Known breakage below ~1024px: `.dashboard-row`/`.detail-row` are non-wrapping `flex 3:2`; tables (6 columns + JSON payload column) overflow; the top `NMenu` wraps badly under ~500px; `NDescriptions :column="3"` cramps. The stat tiles already use NGrid responsive spans and survive all widths — proof the mechanism works, it just was never applied elsewhere. Decisions locked in the 2026-07-12 exploration: bottom tabs on phones, hybrid table strategy, Phase 1.2, Naive UI breakpoints, standing rule `ai/rules/frontend-responsive.md`.

## Goals / Non-Goals

**Goals:**

- All five pages usable at 390px (phone) and 768px (tablet portrait); desktop unchanged.
- Bottom tab bar on phones; Machine List cards on phones; stacked rows below tablet breakpoint; trimmed+scrollable lookup tables.
- Touch-adequate targets on phone/tablet paths.
- Three-viewport Playwright verification with screenshots.

**Non-Goals:**

- PWA/offline/installability; swipe gestures; dark mode; frontend telemetry; any backend change; redesigning desktop.

## Decisions

### D1: One breakpoint source of truth — a `useViewport` composable on `matchMedia`

A single composable (`isPhone` < 640, `isTablet` 640–1024, `isDesktop` ≥ 1024) built on `window.matchMedia`; components consume the named booleans, never raw widths. **Amended at apply time:** the original plan said "wrap Naive UI's breakpoint hook", but that hook lives in naive-ui's transitive dependency `vooks`, which is not a public API surface — matchMedia keeps the zero-new-dependency promise without coupling to internals. The bands use min-width-only queries so they are complementary by construction (no fractional-width gap at band edges), the state is lazy-initialized on first use (import never touches `window` — safe for future test environments), and HMR disposal removes the listeners in dev. Rationale: the standing rule makes responsive checks a permanent fixture — scattered `window.innerWidth` or duplicated breakpoint literals would rot immediately. CSS-only concerns (stacking, spacing) use plain media queries at the same 640/1024 values; structural concerns (which component renders) use the composable.

### D2: Navigation — conditional render, not CSS hiding

Phone: fixed bottom tab bar (4 items, icon + label, 56px height, content gets bottom padding); tablet/desktop: existing top `NMenu`. Rendered conditionally via `useViewport`, not `display:none` duplication — both navs in the DOM would double route-active logic and confuse focus order. The tab bar is a small bespoke component (Naive UI has no bottom-nav primitive; ~40 lines, still zero new dependencies).

### D3: Machine List — two renderings of one data source

Phone: card list (status tag + name prominent, temperature/health/updated as a compact row, whole card tappable). Tablet/desktop: existing `NDataTable`. Same query, same filter logic (the `?status=` drill-down works identically — cards filter too). Rejected: CSS-transformed table (fragile) and responsive column hiding (Machine List on a phone is a *touch* page; rows are poor tap targets).

### D4: Lookup tables — trim, then scroll

`EventsTable` gains a `compact` mode (driven by `useViewport`): drops the payload column on phones (payload stays one tap away via the detail page; truncated JSON on a phone informs nobody), keeps time/machine/type, and wraps in `overflow-x: auto` for anything still too wide. Event Center and the two embedded event lists all inherit this via the shared component — one implementation, three pages served (the add-frontend-mvp reuse decision paying off).

### D5: Stacking and descriptions

`.dashboard-row`/`.detail-row` become `flex-wrap` with full-width children below 1024px (media query only — no JS). `NDescriptions` uses its own responsive column count (1 on phone, 2 on tablet, 3 on desktop) via the composable. Tile grids already behave; their spans get re-checked at 390px as part of verification, not redesigned.

### D6: Verification is three-viewport, screenshot-evidenced

The Playwright flow runs the five pages at 390/768/1280, asserting per-page sentinel elements and capturing screenshots; the phone run additionally exercises the tab bar navigation and a card tap. Desktop screenshots are compared against current behavior by eye (no pixel-diff tooling — demo project).

## Risks / Trade-offs

- [Two Machine List renderings can drift (column added to table, forgotten on cards)] → both consume one shared row-shaping helper/type; the standing rule's "state phone behavior per change" is the process guard.
- [Bottom tab bar overlaps content] → reserved bottom padding via a layout class applied with the tab bar; verified in screenshots.
- [Naive UI components have desktop-tuned paddings] → accept defaults where usable; only adjust where verification shows real problems (avoid a death-by-a-thousand-overrides theme fork).
- [Polling + narrow devices = battery] → out of scope; 5s polling already pauses on hidden tabs (vue-query default).

## Open Questions

1. Tab bar icons: Naive UI ships `@vicons` sets — pick one set during implementation (pure aesthetics, no architecture impact).
2. Does the Simulator page need anything beyond its existing narrow card? (Likely no — confirm in verification.)
