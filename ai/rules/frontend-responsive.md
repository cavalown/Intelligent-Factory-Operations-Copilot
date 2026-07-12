# Frontend Responsive Design

Every frontend feature or modification MUST consider responsive behavior at the same time it is designed and implemented — never as an afterthought. Established 2026-07-12 by explicit user decision: factory monitoring's real users are on tablets (operators walking the floor) and phones (supervisors/on-call glancing), not only the control-room desktop this UI was first built against.

## Target widths

Follow Naive UI's breakpoint system — do not invent custom breakpoints:

| Band | Width | Primary persona |
| --- | --- | --- |
| Phone | < 640px | Supervisor / on-call: key numbers at a glance, alerts → machine detail |
| Tablet | 640–1024px | Operator on the floor (possibly gloved): large touch targets, high density OK |
| Desktop | ≥ 1024px | Control room: the original layout — must never regress |

## Established patterns (decided with Phase 1.2; reuse, don't re-decide)

- **Navigation**: horizontal top menu on desktop; bottom tab bar on phones.
- **Data tables**: Machine List renders as cards on phones (primary touch page); lookup-style tables (Event Center, detail event lists) trim columns and use horizontal scroll.
- **Side-by-side columns** (e.g. Dashboard's events + summary row): stack vertically below the tablet breakpoint.
- **Mechanics**: the `useViewport` composable (`frontend/src/composables/useViewport.ts`, matchMedia-based — Naive UI's own hook is internal API) for structural decisions, NGrid responsive spans, and minimal media queries (use range syntax, e.g. `(width < 1024px)`, matching the composable's complementary bands) — no new dependencies for layout. The canonical breakpoint values live in this file's table; the composable and every media query reference them.

## What "consider RWD" means per change

1. New page/component: state its phone and tablet behavior in the change's design or spec (a sentence each is enough; "desktop-only, hidden on narrow" is a valid documented answer — silence is not).
2. Verification: exercise changed screens at the three bands (the Playwright flow supports multiple viewports); screenshots for anything layout-affecting.
3. Touch: anything clickable on phone/tablet paths needs touch-sized targets — no hover-only affordances on those paths.
