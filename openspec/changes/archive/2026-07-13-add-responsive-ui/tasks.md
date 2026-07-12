# Tasks: add-responsive-ui

## 1. Foundation

- [x] 1.1 `useViewport` composable wrapping Naive UI's breakpoint hook (`isPhone`/`isTablet`/`isDesktop`, 640/1024) — the single breakpoint source of truth (design D1)
- [x] 1.2 Global layout CSS: stacking media queries for `.dashboard-row`/`.detail-row` (<1024px full-width children), content bottom-padding class for the tab bar era

## 2. Navigation

- [x] 2.1 `BottomTabBar` component (4 destinations, icon + label, active highlight, fixed 56px) rendered at phone widths; top `NMenu` conditionally absent (design D2)
- [x] 2.2 Verify content clearance above the bar on all five pages (no obscured buttons/footers)

## 3. Page adaptations

- [x] 3.1 Machine List phone card mode: shared row-shaping helper consumed by both table and cards; card = status tag + name + metrics row, whole-card tap → detail; `?status=` filter + clearable indicator work in both renderings (design D3)
- [x] 3.2 `EventsTable` compact mode: drop payload column on phones, wrap in `overflow-x: auto` container; Event Center / Dashboard widget / Machine Detail inherit automatically (design D4)
- [x] 3.3 Machine Detail: `NDescriptions` responsive column count (1/2/3); utilization strip wraps cleanly
- [x] 3.4 Dashboard: re-check tile grid spans at 390px; adjust only if verification shows breakage
- [x] 3.5 Touch pass: tap-target sizing on phone/tablet paths (card taps, load-more, generate/regenerate, simulator form controls); no hover-only affordances

## 4. Verification

- [x] 4.1 Playwright three-viewport run (390 / 768 / 1280): all five pages render sentinel elements, no horizontal body scroll, screenshots captured per page per viewport
- [x] 4.2 Phone-flow specifics: navigate via tab bar across all four tabs, tap a machine card into detail, drill down from a Warning tile into the filtered card list
- [x] 4.3 Desktop non-regression: 1280px screenshots eyeballed against current layout; top menu + side-by-side rows + full tables intact — all verification done 2026-07-13 via headless Chrome at 390/768/1280: 15 page renders with zero horizontal body overflow, tab-bar 4-way navigation, card tap → detail, Warning tile → filtered card list, payload column absent on phone/present on desktop, no page errors

## 5. Code-review fixes (2026-07-13 review, 10 findings all addressed)

- [x] 5.1 Safe-area clearance: `.app-content--phone` → `calc(76px + env(safe-area-inset-bottom))` (content was hidden behind the tab bar on notched phones)
- [x] 5.2 Phone card branch gains NSkeleton loading state and NEmpty zero-match state (parity with NDataTable's built-ins); verified with `?status=IDLE`
- [x] 5.3 Doc/code drift resolved: design D1 and frontend-responsive.md Mechanics now record the matchMedia implementation + vooks rationale
- [x] 5.4 `navigation.ts` single nav config (key/label/tabLabel/icon) consumed by both navs; label divergence now explicit in one place
- [x] 5.5 Route→nav-key mapping moved to router `meta.navKey` + shared `activeNavKey()` (was duplicated in App.vue and BottomTabBar)
- [x] 5.6 formatTimestamp migration completed (MachineDetailPage Last Updated, AiSummaryCard createdAt)
- [x] 5.7 useViewport rewritten: min-width-only complementary bands (no fractional gap), lazy init (import never touches window), HMR dispose
- [x] 5.8 Media queries switched to range syntax matching the composable's bands, each annotated with the canonical-values pointer
- [x] 5.9 Tablet tile density (3/row) confirmed as deliberate (user decision 2026-07-13) and documented in the grid comment
- [x] 5.10 Regression: build clean, three-viewport run all green, empty-state and shared-nav flows verified in headless Chrome
