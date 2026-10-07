## Context

The card currently wires its header button directly to the generation mutation. Disabled HTML controls do not reliably emit hover events.

## Goals / Non-Goals

**Goals:** accurately signal availability and preserve readable summary content.

**Non-Goals:** remove summary APIs or mock data.

## Decisions

Wrap the disabled button in a tooltip trigger that can receive hover events. Remove mutation wiring from the action so it cannot issue requests accidentally. Use the requested Traditional Chinese message verbatim.

## Risks / Trade-offs

- [Disabled action may look subtle] → Retain the existing primary secondary styling and provide tooltip explanation.
