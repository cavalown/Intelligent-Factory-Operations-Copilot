## Context

Machine List already parses and applies `route.query.status`; only an always-visible input is missing.

## Goals / Non-Goals

**Goals:** make filtering discoverable and preserve URL-driven Dashboard drill-down.

**Non-Goals:** server-side filtering or new status semantics.

## Decisions

Use radio-button segments at widths ≥640px and a select below 640px. Compute counts from the already-polled machine collection. `ALL` is a UI-only value that removes `status` from the URL; domain values remain unchanged.

## Risks / Trade-offs

- [Six buttons need width] → Use the compact phone select below 640px and allow the desktop group to wrap if necessary.
