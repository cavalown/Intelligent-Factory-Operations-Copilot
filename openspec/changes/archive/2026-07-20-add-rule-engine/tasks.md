# Tasks: add-rule-engine

## 1. Foundation

- [x] 1.1 Add `KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED` (default `machine.events.enriched`) to `env.config.ts`, following the existing `kafkaTopicMachineEvents` pattern
- [x] 1.2 Add `temperatureExceedsThreshold?: boolean` and `isSensorFailure?: boolean` to `MachineEventEnvelope` in `backend/src/shared/types/machine-event.types.ts` (design.md D3 — envelope-level fields, not added to any `payload` interface)
- [x] 1.3 Create the `rules/` module (`rules.module.ts`), importing `MachinesModule` for `MachinesService.findRaw()` access (module-boundaries.md — go through the exported service, don't import the Machine model directly; `AlertConsumerService` already does this, same pattern)

## 2. Rule Engine consumer/producer

- [x] 2.1 `RuleEngineConsumerService extends KafkaConsumerBase`, own consumer group `rules-service-group`, subscribes to `env.kafkaTopicMachineEvents`
- [x] 2.2 `handleMessage(event): Promise<boolean>`: for `TEMPERATURE_REPORTED`, look up the machine via `MachinesService.findRaw(event.machineId)` and set `temperatureExceedsThreshold` (omit the field entirely if the machine isn't found — spec's "unknown machine passed through unclassified" scenario); for `STATUS_CHANGED`, set `isSensorFailure` from `payload.currentStatus === 'WARNING'`; for every other `eventType`, add neither field. **Revised in §6.1**: also skips the machine lookup and omits the field for a non-finite `temperature`.
- [x] 2.3 Republish via `KafkaProducerService.publish(env.kafkaTopicMachineEventsEnriched, event.machineId, enrichedEvent)`, preserving every original field including `eventId` (design.md D1/D2 — same key, same id)
- [x] 2.4 `handleMessage` returns `true` for every consumed message. **Revised in §6.2**: returns `false` for the two "can't classify" no-ops (unknown machine, non-finite temperature), matching `ai/rules/observability-conventions.md`'s literal contract; still returns `true` for every other case, since republishing itself remains the real effect there.

## 3. Migrate Machine Service and Alert Service

- [x] 3.1 `MachineProjectionConsumerService`: change its `super(...)` call to subscribe to `env.kafkaTopicMachineEventsEnriched` instead of `env.kafkaTopicMachineEvents`
- [x] 3.2 `MachineProjectionConsumerService`'s `TEMPERATURE_REPORTED` case: read `event.temperatureExceedsThreshold` instead of comparing `payload.temperature` to `machine.temperatureThreshold`
- [x] 3.3 `MachineProjectionConsumerService`'s `STATUS_CHANGED` health-score case: read `event.isSensorFailure` instead of calling `isStatusChangedSensorFailure(currentStatus)`; delete that now-dead function from this file
- [x] 3.4 `AlertConsumerService`: change its `super(...)` call to subscribe to `env.kafkaTopicMachineEventsEnriched`
- [x] 3.5 `AlertConsumerService.resolveAlert`'s `TEMPERATURE_REPORTED` and `STATUS_CHANGED` branches: read `event.temperatureExceedsThreshold` / `event.isSensorFailure` instead of recomputing; delete this file's copy of `isStatusChangedSensorFailure` too. `resolveAlert` no longer needs `MachinesService` for this lookup, so it was also removed from the constructor and `resolveAlert` was de-async'd (no longer awaits anything).
- [x] 3.6 Delete `backend/src/shared/sensor-failure-contract.spec.ts` (design.md D6 — the two independent implementations it compared no longer exist; nothing left to drift)

## 4. Compose + registry updates

- [x] 4.1 `docker-compose.yml`: no new service needed (topic auto-creates like `machine.events` already does); added `KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED: machine.events.enriched` to `backend`'s environment block
- [x] 4.2 Registry sweep (retrospective Pattern 3, applied deliberately this time): added `rules/` to the module list in `docs/design/architecture.md` §14.1 and `ai/rules/module-boundaries.md` (+ zh-TW twin for architecture.md); added `KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED` to `docs/deployment/docker-compose.md` §5 env var registry and `docs/deployment/local-development.md`'s var list (+ zh-TW both); documented the enriched envelope's two new optional fields in a new `docs/design/event-schema.md` §3.3 (+ zh-TW); updated the cold-start-race note's consumer-group count (3→4, + zh-TW)
- [x] 4.3 Confirmed no new API endpoint / Mongo collection / error code. Went one step further than the enumerated list: `docs/design/observability.md` (+ zh-TW) generally described "three Kafka consumers" as an architectural fact (not just the historical worked-example capture) — updated those statements to four, and added a dated caveat above the pre-existing worked example noting it predates this change's added hop, without rewriting the captured trace data itself.

## 5. Verification

- [x] 5.1 Demo flow: published a `TEMPERATURE_REPORTED` event for `M-002` at 85°C (threshold 80) via `POST /simulator/events`. Confirmed via `ifoc_events_processed_total{consumerGroup="rules-service-group"}` (Prometheus, queried inside the `lgtm` container) that Rule Engine processed it, and that Machine Service (`healthScore` 34→24, `status` stayed `WARNING`) and Alert Service (alert created with message "Temperature 85C exceeds warning threshold.") both reacted correctly reading only the enriched field.
- [x] 5.2 Verified idempotency end to end: resent the identical `eventId` (`evt_rule_engine_demo_001`) through the full pipeline. `healthScore` stayed at 24 (not double-decremented) and exactly one alert exists for that `eventId` — confirms design.md's compensation-mechanism analysis holds through the added Rule Engine hop.
- [x] 5.3 Verified per-machine ordering survives the extra hop: sent 8 rapid `TEMPERATURE_REPORTED` events (60→67°C) for `M-002` back to back; final projection showed `currentTemperature: 67` and `lastEventId: evt_rule_engine_order_67` — the last event sent, not a race.
- [x] 5.4 Verified the unknown-machine pass-through scenario: published a raw `TEMPERATURE_REPORTED` event for a non-existent `machineId` directly to the `machine.events` topic (bypassing the HTTP API's own `UNKNOWN_MACHINE` guard via `kafka-console-producer.sh`). Confirmed via `kafka-console-consumer.sh` against `machine.events.enriched` that Rule Engine republished the event with `temperatureExceedsThreshold` omitted (not dropped), the backend process stayed up throughout, no error was logged, and `GET /machines/M-999-NOPE` still correctly returns `404 MACHINE_NOT_FOUND` (Machine/Alert Service's existing unknown-machine skip untouched).
- [x] 5.5 Full regression: `npm run build`, `npm run lint` (0 errors — 1 pre-existing, unrelated warning in `main.ts`), `npm test` (47/47 passing across 12 suites) all clean; `openspec validate add-rule-engine --strict` passes.

## 6. Code-review fixes

A high-effort `/code-review` pass (8 finder angles, 1-vote verification per candidate) surfaced 10 confirmed/plausible findings. All 10 were fixed:

- [x] 6.1 Added a `Number.isFinite(temperature)` guard to `RuleEngineConsumerService`'s `TEMPERATURE_REPORTED` branch, matching the guard both downstream consumers already had — a non-finite temperature now skips the machine lookup and republishes unclassified (same treatment as an unknown machine) instead of silently computing a fabricated `temperatureExceedsThreshold: false`.
- [x] 6.2 `handleMessage` now returns `false` for the two "can't classify" no-ops (unknown machine, non-finite temperature) instead of unconditionally `true`, aligning with `ai/rules/observability-conventions.md`'s literal enumerated no-op list. The residual gap this doesn't (and structurally can't) close — `rules-service-group`'s counter can still double-count a genuinely-classified event on Kafka redelivery, since Rule Engine owns no persistence to detect a duplicate — is now explicitly documented as an accepted exception in `ai/rules/observability-conventions.md` and this file's Risks section, rather than left as a silent inconsistency.
- [x] 6.3 Added `backend/src/rules/rule-engine-consumer.service.spec.ts` — direct unit coverage of the classification logic (temperature above/below/non-finite threshold, unknown machine, STATUS_CHANGED WARNING/non-WARNING, unrelated event types, eventId/key preservation), the test coverage design.md's own Risks section required as the deleted contract test's replacement but which hadn't actually been written yet.
- [x] 6.4 Scoped `temperatureExceedsThreshold`/`isSensorFailure` to `TemperatureReportedEvent`/`StatusChangedEvent` specifically (via intersection types) instead of the shared `MachineEventEnvelope` base, so the type system now rejects reading/setting a classification field on the wrong `eventType` — matching the protection `payload` already had.
- [x] 6.5 Updated `docs/design/machine-schema.md` §5.4 (+ zh-TW) to reflect that the duplication it documents is now resolved by this change, rather than describing a still-open problem and a contract test that no longer exists.
- [x] 6.6 Added `.zh-TW.md` twins for all six artifacts in this change directory (`proposal.md`, `design.md`, `tasks.md`, and the three `specs/*/spec.md` files), per `ai/rules/bilingual-docs.md`'s explicit scope (`docs/`, `openspec/`, ...) and this repo's own precedent (`add-observability`'s archived artifacts all have them).
- [x] 6.7 Added `KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED` to `backend/.env.example`, which had been missed in the original §4 registry sweep.
- [x] 6.8 Fixed `machine-status-transitions.spec.ts`'s stale `TEMPERATURE_REPORTED` fixture — removed the now-inert `temperatureThreshold: 80` mock field, made the "within threshold" test set `temperatureExceedsThreshold: false` explicitly instead of relying on the field being coincidentally `undefined`, and added a new test exercising `temperatureExceedsThreshold: true` (the status-raise / health-score-drop branch, previously untested post-migration).
- [x] 6.9 Renamed the consumer group from `rule-engine-group` to `rules-service-group` to match the `<module>-service-group` pattern the other three consumers follow, per `ai/rules/kafka-consumer-conventions.md`. Swept across code, docs, and both zh-TW twins.
- [x] 6.10 Documented the Mongo-I/O/serialization trade-off (no net reduction in reads per `TEMPERATURE_REPORTED` event; Machine/Alert Service processing is now serialized behind Rule Engine instead of running in parallel) as an explicit accepted Risk in design.md, rather than leaving it uncalled-out.
