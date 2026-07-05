# Architecture Overview

IFOC is an event-driven factory monitoring platform. **Events are the source of truth; projections are derived views.**

```
Machine Simulator
    → POST /simulator/events
    → Kafka: machine.events
    → Event Consumer (NestJS)
        ├── Event Service    → machine_events collection (immutable history)
        ├── Machine Service  → machines collection (current state projection)
        └── Alert Service    → alerts collection (WARNING/CRITICAL events only)
    → Insight Service        → ai_summaries collection (on-demand LLM calls)
    → API Layer              → REST responses to Vue 3 dashboard
```

The MVP uses a **NestJS modular monolith** with these modules, each owning its own persistence access:

```
backend/
├── events/      # Immutable event history — answers "what happened?"
├── machines/    # Current state projection — answers "what is the state now?"
├── alerts/      # Problem tracking — answers "what needs attention?"
├── insights/    # LLM summaries — answers "what does this mean?"
├── simulator/   # Generates fake machine events for demos
└── shared/      # Shared types, DTOs, utilities
```

Full detail: `docs/design/architecture.md`.
