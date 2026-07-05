# Module Boundaries

Follow the module structure in `docs/design/architecture.md` §14.1: `events/`, `machines/`, `alerts/`, `insights/`, `simulator/`, `shared/`.

Each module owns its own persistence access (its own Mongoose models/collections). Don't import another module's model directly — go through its exported service.

`shared/` holds only types, DTOs, and cross-cutting infrastructure (Kafka module, Mongoose connection) used by 2+ modules. No business logic lives there.

Default to keeping new code inside this single NestJS app. Don't split a module into a separate service unless a real, *current* pressure justifies it — not a hypothetical future one. See `architecture.md` §14.2's extraction path, which is documented as a reference option, not a commitment.
