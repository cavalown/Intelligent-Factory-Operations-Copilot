## 1. Demo Machine Roster

- [x] 1.1 Add five varied profiles to the idempotent backend demo-machine roster.
- [x] 1.2 Add tests proving the roster contains at least eight unique machines and preserves existing projection state.

## 2. Curated Event Seed

- [x] 2.1 Implement a dependency-free host script with curated events covering every MVP event type and multiple final machine states.
- [x] 2.2 Add API readiness/roster validation, paginated existing-event discovery, per-event skipping, and actionable failures.
- [x] 2.3 Expose the script as `npm run seed:demo` and add automated tests for dataset validity, partial reruns, and failure behavior.

## 3. Documentation and Verification

- [x] 3.1 Document the demo seed workflow in English and Traditional Chinese local-development and Compose guides.
- [x] 3.2 Run backend tests/build, seed-script tests, and strict OpenSpec validation.
- [x] 3.3 Run the seed against the local Compose stack and verify machine count, all five event types, varied statuses, alerts, and safe rerun behavior.
