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
| [`design/event-flow.md`](design/event-flow.md) | 🔜 | Detailed event processing flow (may be superseded by architecture.md §9–10). |
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

## Deployment

| Doc | Status | Description |
| --- | --- | --- |
| `deployment/local-development.md` | 🔜 | Local dev setup outside Docker Compose. |
| `deployment/docker-compose.md` | 🔜 | Docker Compose services, ports, environment variables. |
| `deployment/kubernetes.md` | 🔮 | Future: production Kubernetes deployment (explicitly out of MVP scope). |

## Assets

| Path | Status | Description |
| --- | --- | --- |
| `assets/architecture.drawio` | 🔜 | Editable source for the architecture diagram. |
| `assets/event-flow.drawio` | 🔜 | Editable source for the event flow diagram. |
| `assets/system-overview.png` | 🔜 | Exported system overview image for README/slides. |
| `assets/screenshots/` | 🔜 | Dashboard screenshots for demos and documentation. |

---

## Suggested Reading Order

1. `product/mvp.md` — what the MVP does and why.
2. `design/architecture.md` — how the system is structured.
3. `design/event-schema.md` — the event contract every module depends on.
4. `design/api.md` — how the frontend and simulator talk to the backend.
5. `product/product-roadmap.md` — where the project goes after the MVP.

## Related Top-Level Guidance

* [`/CLAUDE.md`](../CLAUDE.md) — condensed project guidance for AI coding assistants; kept in sync with the documents above.
