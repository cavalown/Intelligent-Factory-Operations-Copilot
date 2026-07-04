# Architecture Decision Records (ADR)

This folder holds ADRs — short records of significant technical decisions, why they were made, and what alternatives were rejected.

An ADR is not a design spec. It does not describe *how* something works (that belongs in `docs/design/`). It records *why* a choice was made, so that six months from now nobody has to guess whether a constraint was intentional or accidental.

---

## When to Write One

Write an ADR when a decision:

* Is hard or expensive to reverse later.
* Affects multiple modules or the whole system, not just one file.
* Has real alternatives that were seriously considered and rejected.
* Will likely be questioned later ("why don't we just use X instead?").

Don't write one for decisions that are easily changed, purely local to one module, or that have no real alternative worth recording.

## Format

Each ADR is a single file named `ADR-NNNN-short-title.md`, numbered sequentially and never renumbered or reused even if an ADR is later superseded.

```markdown
# ADR-NNNN: Title

## Status
Proposed | Accepted | Superseded by ADR-XXXX

## Context
What problem or constraint led to this decision? What forces were in tension?

## Decision
What was decided, stated as a plain sentence.

## Consequences
What this makes easier, what it makes harder, and what it costs.

## Alternatives Considered
What else was evaluated, and why it was not chosen.
```

## Index

| ADR | Decision |
| --- | --- |
| [ADR-0001](ADR-0001-use-kafka.md) | Use Kafka as the event backbone |
| [ADR-0002](ADR-0002-use-mongodb.md) | Use MongoDB for events and projections |
| [ADR-0003](ADR-0003-rest-api.md) | Use REST over GraphQL/gRPC for the MVP API |
| [ADR-0004](ADR-0004-ai-summary-before-rag.md) | Ship direct LLM summaries before RAG |

This index should stay in sync with `docs/design/architecture.md` §18 (Architecture Decisions / ADR Summary), which is the condensed one-line-per-decision version of the same content.
