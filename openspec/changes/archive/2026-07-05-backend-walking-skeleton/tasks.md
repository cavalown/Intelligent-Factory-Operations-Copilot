## 1. Backend Project Scaffold

- [x] 1.1 Initialize a NestJS project in `backend/` (TypeScript)
- [x] 1.2 Create module folders per `docs/design/architecture.md` §14.1: `events/`, `machines/`, `alerts/`, `insights/`, `simulator/`, `shared/`
- [x] 1.3 Add dependencies: `kafkajs`, `@nestjs/mongoose`, `mongoose` (`@nestjs/microservices` was added then removed — see `design.md` Decisions)
- [x] 1.4 Wire up environment variables (`PORT`, `MONGODB_URI`, `KAFKA_BROKERS`, `KAFKA_TOPIC_MACHINE_EVENTS`) per `docs/deployment/docker-compose.md` §5

## 2. Shared Infrastructure (`shared/`)

- [x] 2.1 Define the event envelope type/DTO matching `docs/design/event-schema.md` §3
- [x] 2.2 Define the `TEMPERATURE_REPORTED` payload DTO matching `docs/design/event-schema.md` §5.2
- [x] 2.3 Create a Kafka module wrapping `kafkajs` directly (shared producer; consumer factory that takes a distinct group ID per caller)
- [x] 2.4 Create the Mongoose connection module reading `MONGODB_URI`

## 3. Machine Seeding

- [x] 3.1 Define the Machine Mongoose schema matching `docs/design/machine-schema.md` §3
- [x] 3.2 Write a startup seed step that upserts a fixed demo roster by `machineId` (at least `M-001` "CNC Mill 01", `temperatureThreshold: 80`, initial `status: IDLE`, `healthScore: 100`, per `machine-schema.md` §11)

## 4. Machine Event Ingestion (`simulator/`) — capability: `machine-event-ingestion`

- [x] 4.1 Implement `POST /simulator/events` controller
- [x] 4.2 Validate required envelope fields; respond `400 INVALID_EVENT_ENVELOPE` on failure
- [x] 4.3 Validate `machineId` exists in `machines`; respond `404 UNKNOWN_MACHINE` on failure
- [x] 4.4 Validate `eventType === TEMPERATURE_REPORTED`; respond `422 UNSUPPORTED_EVENT_TYPE` otherwise
- [x] 4.5 Validate the `TEMPERATURE_REPORTED` payload (`temperature`, `unit` required); respond `422 PAYLOAD_VALIDATION_FAILED` on failure
- [x] 4.6 Publish the valid event to `machine.events`, keyed by `machineId`
- [x] 4.7 Respond `202 { eventId, status: "PUBLISHED" }`

## 5. Event History (`events/`) — capability: `event-history`

- [x] 5.1 Define the `MachineEvent` Mongoose schema with a unique index on `eventId`, matching `docs/design/architecture.md` §12.1
- [x] 5.2 Implement a Kafka consumer with its own consumer group (`event-service-group`) subscribed to `machine.events`
- [x] 5.3 On consume, insert into `machine_events`; catch duplicate-key errors as a no-op
- [x] 5.4 Implement `GET /machines/:id/events` with `limit` + `before` cursor pagination
- [x] 5.5 Respond `404 MACHINE_NOT_FOUND` for an unknown `machineId`

## 6. Machine State Projection (`machines/`) — capability: `machine-state-projection`

- [x] 6.1 Implement a Kafka consumer with its own consumer group (`machine-service-group`) subscribed to `machine.events`
- [x] 6.2 On consume, look up the machine by `machineId`; skip processing if `event.eventId === machine.lastEventId`
- [x] 6.3 Apply the `TEMPERATURE_REPORTED` projection rule: raise `status` to `WARNING` and decrease `healthScore` by 10 (clamped `[0, 100]`) when over threshold, subject to severity precedence (`machine-schema.md` §4.2); otherwise update `currentTemperature` only
- [x] 6.4 Update `lastEventId` and `lastUpdatedAt` on every processed event
- [x] 6.5 Implement `GET /machines`
- [x] 6.6 Implement `GET /machines/:id`; respond `404 MACHINE_NOT_FOUND` for an unknown `machineId`

## 7. Alert Detection (`alerts/`) — capability: `alert-detection`

- [x] 7.1 Define the `Alert` Mongoose schema with a unique index on `eventId`, matching `docs/design/architecture.md` §12.3
- [x] 7.2 Implement a Kafka consumer with its own consumer group (`alert-service-group`) subscribed to `machine.events`
- [x] 7.3 On consume, create a `WARNING`/`ACTIVE` alert if `temperature` exceeds the machine's threshold; catch duplicate-key errors as a no-op
- [x] 7.4 Implement `GET /machines/:id/alerts` with an optional `status` filter; respond `404 MACHINE_NOT_FOUND` for an unknown `machineId`

## 8. Docker Compose Integration

- [x] 8.1 Add `backend/Dockerfile`
- [x] 8.2 Uncomment and align the `backend` service block in the root `docker-compose.yml`
- [x] 8.3 `docker compose up --build backend` alongside the already-running `kafka`/`mongodb`; confirm it starts without errors (hit a one-time cold-start consumer-group race on first boot — fixed with `restart: on-failure`, documented in `docker-compose.md` §4)

## 9. End-to-End Verification

- [x] 9.1 Run the seed step; confirm demo machines exist in MongoDB
- [x] 9.2 Walk through `docs/design/event-flow.md` §3's `TEMPERATURE_REPORTED` scenario against the real running backend: `POST /simulator/events` → `GET /machines/:id` → `GET /machines/:id/events` → `GET /machines/:id/alerts`
- [x] 9.3 Confirm the within-threshold contrast case (`event-flow.md` §4): no status/health-score change, only telemetry updates
- [x] 9.4 Confirm the severity-precedence contrast case (`event-flow.md` §5): manually set a machine to `ERROR`, send an over-threshold `TEMPERATURE_REPORTED` event, confirm `status` stays `ERROR` while `healthScore` still drops
