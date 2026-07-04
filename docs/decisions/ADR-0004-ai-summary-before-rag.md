# ADR-0004: Ship Direct LLM Summaries Before RAG

## Status

Accepted

## Context

IFOC's product goal includes AI-assisted operational insight — explaining what recent machine events mean and suggesting next actions (`docs/design/architecture.md` §7.6). A full Retrieval-Augmented Generation (RAG) implementation would let the Insight Service ground its answers in an SOP knowledge base, historical incident patterns, and maintenance records. That knowledge base does not exist yet, and building it (ingestion pipeline, chunking, embeddings, vector store, retrieval tuning) is significant scope on its own.

The MVP's goal is to prove the full event-driven pipeline end to end — simulate, stream, persist, project, and explain — without any single capability becoming the long pole that blocks the rest (`docs/product/mvp.md`).

## Decision

The MVP's Insight Service calls the LLM API directly with recent event/machine/alert context assembled from `machine_events`, `machines`, and `alerts` (`docs/design/architecture.md` §9.4). No RAG, vector store, or SOP knowledge base is built for the MVP. RAG is deferred to `docs/product/product-roadmap.md` Phase 3 (Operational Intelligence).

## Consequences

**Easier:**

* AI value is demonstrable as soon as Event/Machine/Alert data exists — no separate knowledge-base ingestion project has to finish first.
* The Insight Service's dependency surface stays small: it reads from three existing MongoDB collections and calls one external LLM API, matching the "AI explains data, it does not replace it" principle in `CLAUDE.md`.
* AI summaries stay traceable to `inputEventIds` (`api.md` §5.4) without needing to also cite retrieved documents.

**Harder:**

* Without SOP or historical-incident grounding, summaries can only reason from recent raw events — they cannot answer "how did we fix this last time" or reference documented procedures. That capability doesn't exist until Phase 3.
* Prompt context is built from whatever recent events/state/alerts are gathered ad hoc; there's no retrieval-relevance mechanism, so as event volume grows the context-selection logic (which events to include) will need its own design attention before Phase 3 arrives.

## Alternatives Considered

* **Build RAG as part of the MVP** — would produce higher-quality, more grounded summaries immediately, but requires a knowledge base that doesn't exist (SOPs haven't been written or digitized yet) and a vector store the deployment story (`architecture.md` §13.1: Docker Compose, no Kubernetes) doesn't currently include. Rejected because it would make AI infrastructure the critical path for an MVP whose primary goal is proving the event pipeline.
* **No AI in the MVP at all** — simplest, and defers all AI complexity to a later phase. Rejected because AI-assisted insight is a named part of the product goal (`architecture.md` §1), and a direct-LLM summary is cheap enough to include now to prove the concept end to end.
