# Testing (Interim)

Automated testing strategy (unit vs. integration, tooling) is not finalized — see the Open Questions in `openspec/changes/backend-walking-skeleton/design.md`.

Until it's decided, at minimum manually verify each spec's scenarios (tracked in the relevant `tasks.md`) before marking a task complete.

When a fix changes how a function handles one reported edge case, don't stop at re-testing that one case. Explicitly enumerate the *other* edge cases the old code was implicitly handling (even by accident — e.g. `a || b` collapses falsy-zero, `NaN`, and `undefined` into the same branch) and confirm the new code still handles all of them, not just the one from the bug report. See `docs/retrospectives/2026-07-backend-implementation-lessons.md` Pattern 2 for a concrete case where fixing one edge case silently reintroduced a different one.
