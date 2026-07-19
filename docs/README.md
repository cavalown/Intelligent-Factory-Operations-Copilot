# Documentation Index

This is the navigation page for all IFOC (Intelligent Factory Operations Copilot) design and product documentation.

The project is currently in the **design phase**. No application code exists yet — everything under `docs/` defines what will be built. Start with `product/mvp.md` and `design/architecture.md` if you are new to the project.

---

## Status Legend

| Symbol | Meaning |
| --- | --- |
| ✅ | Written and current |
| 📝 | Planned, file exists but empty |
| 🔜 | Planned, file not created yet |
| 🔮 | Future phase, not started |

---

## Product Documentation

Defines what IFOC is and what the MVP scope covers.

| Doc | Status | Description |
| --- | --- | --- |
| [`product/product-roadmap.md`](product/product-roadmap.md) | ✅ | Long-term 5-phase roadmap (Foundation → Digital Twin). |
| [`product/mvp.md`](product/mvp.md) | ✅ | MVP functional scope, machine state rules, definition of done. |

## System Design

Defines how IFOC is built.

| Doc | Status | Description |
| --- | --- | --- |
| [`design/architecture.md`](design/architecture.md) | ✅ | Overall system architecture, components, data flow, deployment. |
| [`design/event-schema.md`](design/event-schema.md) | ✅ | Event envelope, payload schemas, producer/consumer contract, versioning. |
| [`design/api.md`](design/api.md) | ✅ | REST API contract between backend, dashboard, and simulator. |
| [`design/machine-schema.md`](design/machine-schema.md) | ✅ | Machine domain model — projection fields, status transitions, health score rules. |
| [`design/event-flow.md`](design/event-flow.md) | ✅ | Worked example — one event's full lifecycle, from simulator trigger through all consumers to AI summary. Complements, doesn't repeat, architecture.md §9–10. |
| [`design/observability.md`](design/observability.md) | ✅ | OpenTelemetry traces/metrics, structured logging, and the `ifoc.events.processed` metric (Phase 1.1) — what's instrumented, the correlation model, fail-soft behavior, and how to read it in Grafana. |
| [`design/database.md`](design/database.md) | 🔮 | Future: detailed MongoDB schema, indexes, and query patterns. |
| [`design/ai-design.md`](design/ai-design.md) | 🔮 | Future: Insight Service prompt design, RAG architecture (Phase 3). |
| [`design/security.md`](design/security.md) | 🔮 | Future: authentication, authorization, secrets management. |

## Architecture Decisions

Short records of why a significant technical choice was made.

| Doc | Status | Description |
| --- | --- | --- |
| [`decisions/README.md`](decisions/README.md) | ✅ | ADR guideline and index. |
| [`decisions/ADR-0001-use-kafka.md`](decisions/ADR-0001-use-kafka.md) | ✅ | Why Kafka was chosen as the event backbone. |
| [`decisions/ADR-0002-use-mongodb.md`](decisions/ADR-0002-use-mongodb.md) | ✅ | Why MongoDB was chosen for events and projections. |
| [`decisions/ADR-0003-rest-api.md`](decisions/ADR-0003-rest-api.md) | ✅ | Why REST was chosen over GraphQL for the MVP. |
| [`decisions/ADR-0004-ai-summary-before-rag.md`](decisions/ADR-0004-ai-summary-before-rag.md) | ✅ | Why direct LLM summaries ship before RAG. |

`design/architecture.md` §18 keeps a condensed one-line-per-decision summary table; these ADR files are the full context, alternatives, and consequences behind each row.

## Retrospectives

Postmortems on real implementation mistakes and their root causes — not ADRs (which record why a choice was made), but why a mistake was made, so it isn't repeated.

| Doc | Status | Description |
| --- | --- | --- |
| [`retrospectives/README.md`](retrospectives/README.md) | ✅ | Index and criteria for adding a retrospective. |
| [`retrospectives/2026-07-backend-implementation-lessons.md`](retrospectives/2026-07-backend-implementation-lessons.md) | ✅ | 5 root-cause patterns from 3 `/code-review` rounds and one architectural reversal during the initial backend build. |
| [`retrospectives/2026-07-dashboard-metrics-review-lessons.md`](retrospectives/2026-07-dashboard-metrics-review-lessons.md) | ✅ | 4 root-cause patterns from the dashboard-operational-metrics review: secondary-write-on-critical-path × poison-pill classification, compounding assumptions on weakly-validated fields, stale doc registries, silent degraded modes. |
| [`retrospectives/2026-07-observability-review-lessons.md`](retrospectives/2026-07-observability-review-lessons.md) | ✅ | 5 root-cause patterns from the add-observability review — two are direct recurrences of previously-documented patterns, which is itself the headline lesson. |

## Deployment

| Doc | Status | Description |
| --- | --- | --- |
| [`deployment/local-development.md`](deployment/local-development.md) | ✅ | Local dev setup outside Docker Compose. |
| [`deployment/docker-compose.md`](deployment/docker-compose.md) | ✅ | Docker Compose services, ports, environment variables. |
| `deployment/kubernetes.md` | 🔮 | Future: production Kubernetes deployment (explicitly out of MVP scope). |

## Assets

All 5 planned diagrams exist as Mermaid (`.mmd`) source files under `docs/assets/mermaid/`. No `.drawio`/`.png`/`.svg` exports exist yet — those are only needed once slides/README images are actually being produced. Each prose doc still keeps its original ASCII version alongside a link to the `.mmd` file (see Diagram Workflow below for why they aren't merged).

### Diagram Workflow

Each diagram's source of truth is a standalone Mermaid file under `docs/assets/mermaid/<name>.mmd` — one file per diagram, so each can later be fed into `mmdc` (mermaid-cli) or draw.io's Mermaid import to produce `.svg`/`.png`/`.drawio` output without hand-redrawing.

The corresponding prose doc (e.g. `architecture.md`) links to the `.mmd` file rather than embedding its content. This is a deliberate limitation, not an oversight: plain Markdown has no file-transclusion syntax, and GitHub only renders Mermaid when it's a fenced ` ```mermaid ` block physically inside the `.md` file being viewed — a link to a separate `.mmd` file renders as plain text, not a diagram, when opened on GitHub. Viewing the rendered diagram requires a Mermaid-aware tool (VS Code's Mermaid preview, mermaid.live, etc.). This was chosen over duplicating the Mermaid source into the doc's own fenced block, to avoid two copies drifting out of sync.

| Priority | Diagram | Status | Drawn From | Planned Source |
| --- | --- | --- | --- | --- |
| High | System Architecture | ✅ | `design/architecture.md` §5 (High-Level Architecture) | [`assets/mermaid/architecture.mmd`](assets/mermaid/architecture.mmd) — Phase 1/MVP snapshot only, see scope note in the file |
| High | Event Flow Sequence Diagram | ✅ | `design/event-flow.md` (full worked example) | [`assets/mermaid/event-flow.mmd`](assets/mermaid/event-flow.mmd) |
| Medium | Deployment Topology | ✅ | `design/architecture.md` §13, `deployment/docker-compose.md` | [`assets/mermaid/deployment-topology.mmd`](assets/mermaid/deployment-topology.mmd) |
| Medium | Machine Status State Diagram | ✅ | `design/machine-schema.md` §4 | [`assets/mermaid/machine-status-state.mmd`](assets/mermaid/machine-status-state.mmd) |
| Low | Roadmap Evolution Diagram | ✅ | `product/product-roadmap.md` ("Future Vision") | [`assets/mermaid/roadmap-evolution.mmd`](assets/mermaid/roadmap-evolution.mmd) |

| Path | Status | Description |
| --- | --- | --- |
| `assets/screenshots/` | 🔜 | Dashboard screenshots for demos and documentation — not applicable until the frontend exists. |

---

## Suggested Reading Order

1. `product/mvp.md` — what the MVP does and why.
2. `design/architecture.md` — how the system is structured.
3. `design/event-schema.md` — the event contract every module depends on.
4. `design/machine-schema.md` — how events turn into machine state.
5. `design/api.md` — how the frontend and simulator talk to the backend.
6. `design/event-flow.md` — a single event walked through the whole system, tying 3–5 together.
7. `product/product-roadmap.md` — where the project goes after the MVP.

`decisions/` and `deployment/` aren't part of this sequential read — treat them as reference material: open an ADR when you want to know why a choice was made, open `deployment/` when you're actually trying to run the system.

## Related Top-Level Guidance

* [`/CLAUDE.md`](../CLAUDE.md) — condensed project guidance for AI coding assistants; kept in sync with the documents above.
