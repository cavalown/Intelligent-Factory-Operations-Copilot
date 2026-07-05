# Context

Background knowledge an AI agent needs before working on IFOC (Intelligent Factory Operations Copilot). Migrated from `CLAUDE.md`. Each file below is a condensed summary — follow its "Full detail" pointer into `docs/` for the authoritative version.

| File | Covers |
| --- | --- |
| [project-status.md](project-status.md) | Current phase (design vs. implementation), expected top-level structure. |
| [technology-stack.md](technology-stack.md) | Frontend/backend/messaging/database/AI/runtime choices. |
| [architecture-overview.md](architecture-overview.md) | Event-driven flow diagram, module structure. |
| [key-design-rules.md](key-design-rules.md) | 5 non-negotiable design principles (immutability, severity-as-interpretation, etc.). |
| [event-schema-summary.md](event-schema-summary.md) | Envelope shape, MVP event types, topic naming. |
| [machine-state-rules.md](machine-state-rules.md) | Event → status/health-score projection table. |
| [alert-rules.md](alert-rules.md) | Event → alert/severity table. |
| [api-contract-summary.md](api-contract-summary.md) | REST endpoint list. |
| [mongodb-collections.md](mongodb-collections.md) | The 4 MVP collections and their purpose. |
| [key-design-documents.md](key-design-documents.md) | Where to find the full detail behind every summary here. |
| [mvp-scope-boundaries.md](mvp-scope-boundaries.md) | What's explicitly excluded from MVP. |
| [roadmap-summary.md](roadmap-summary.md) | 5-phase roadmap, what phase we're in now, and what's a future placeholder vs. committed. |
