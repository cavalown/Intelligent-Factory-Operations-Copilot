# Roadmap Summary

IFOC evolves through 5 phases. **The MVP being built right now is Phase 1.** Full detail: `docs/product/product-roadmap.md`.

| Phase | Name | Goal |
| --- | --- | --- |
| 1 | Factory Foundation | Core factory monitoring platform (current MVP) |
| 2 | Event Streaming | Rule engine, incident management, event replay, WebSocket, **alert acknowledgment/resolution workflow, alert escalation rules** |
| 3 | Operational Intelligence | **Real LLM provider hookup (Phases 1–2 deliberately ship the `mock` provider — no paid API before Phase 3)**, SOP knowledge base, RAG, event search, root cause analysis, **concrete production analytics (downtime frequency, MTTA/MTTR, repeated-issue patterns, bottleneck identification)** |
| 4 | AI Copilot | AI chat, recommendations, predictive maintenance |
| 5 | Digital Twin | OPC UA/PLC integration, 3D visualization, **Event Translation Layer** (maps vendor/company-specific event codes and severity onto the IFOC standard schema — real PLC/SCADA/MES sources won't natively emit IFOC's format) |

**Future Consideration, not yet scoped:** Multi-Tenant SaaS Platform — turning IFOC into a product sold to multiple companies. This is a deliberate placeholder, not a committed phase: it's a strategic positioning decision (not an incremental feature) that would require revisiting the MVP scope boundaries (`mvp-scope-boundaries.md` — auth and multi-tenant support are explicitly excluded there) via a dedicated discussion first. Rough future shape: tenant→factory→line→machine hierarchy, RBAC, per-tenant event/alert mappings, per-tenant knowledge bases.

**Architecture consequence:** every diagram/doc describing "the architecture" (e.g. `docs/design/architecture.md` §5, `ai/context/architecture-overview.md`) describes Phase 1 only. It is expected to need revision when a later phase is actually implemented — see the versioning note in `docs/assets/mermaid/architecture.mmd`.
