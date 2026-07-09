# Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3, TypeScript |
| Backend | NestJS (modular monolith) |
| Messaging | Kafka (topic: `machine.events`, key: `machineId`) |
| Database | MongoDB |
| AI | LLM API (direct summaries; no RAG in MVP) |
| Local Runtime | Docker Compose |

## Known Gotchas

- **Mongoose `@Prop()` on a string-literal-union field needs an explicit `type: String`.** `@nestjs/mongoose`'s decorator resolves a property's Mongoose type via TypeScript's `emitDecoratorMetadata`, which only reliably infers a union type (e.g. a `MachineStatus` type alias) to `String` when the whole program is compiled together. Under `ts-jest`'s per-file transpilation (the first real unit test in this codebase surfaced this), the same field throws "Cannot determine a type" at class-load time unless `@Prop({ type: String, enum: [...] })` is explicit. `nest build`/`nest start` never hit this — it only shows up the moment something loads the schema file in isolation (a unit test). If you add a new enum-typed `@Prop()` field, add `type: String` (or the appropriate type) up front rather than waiting to discover it via a future test. See `docs/retrospectives/2026-07-backend-implementation-lessons.md` Pattern 5.
