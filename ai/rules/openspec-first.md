# OpenSpec-First for Non-Trivial Changes

A non-trivial code change should have a corresponding `openspec/changes/<name>/` proposal (`proposal.md`, `design.md`, `specs/`, `tasks.md`) created before implementation starts — the same process used for `backend-walking-skeleton`.

"Non-trivial" means: touches more than one module, introduces a new capability, or changes behavior already described in a `specs/` file. Trivial fixes (typos, small bug fixes within an already-specified capability, doc corrections) don't need a new OpenSpec change.

Use the project's OpenSpec skills/commands to scaffold a new change (`openspec new change`, then `proposal` → `design`/`specs` → `tasks`) rather than hand-writing ad hoc planning docs elsewhere.

When the work is complete, archive the change so `openspec/specs/` reflects the current state of the system and doesn't accumulate stale in-progress changes.
