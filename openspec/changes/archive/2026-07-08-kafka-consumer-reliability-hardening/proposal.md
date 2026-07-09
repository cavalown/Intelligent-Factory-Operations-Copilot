## Why

A `/code-review` pass over the whole backend implementation found 6 CONFIRMED/PLAUSIBLE correctness bugs, all sharing one root cause: none of the 3 Kafka consumers (Event/Machine/Alert Service) have any error boundary around message handling, and the simulator's input validation is weaker than what the downstream Mongoose schemas actually require. A single malformed or edge-case event can either (a) crash a consumer permanently — since an uncaught error in `eachMessage` prevents Kafka offset commit, kafkajs retries the same "poison pill" message forever, halting that entire consumer group — or (b) silently corrupt stored data (`NaN` production counts, alert messages containing the literal text "undefined"). This needs fixing before the frontend starts depending on this data being trustworthy.

## What Changes

- `KafkaConsumerBase` (`backend/src/shared/kafka/kafka-consumer.base.ts`) wraps every subclass's `handleMessage` call in a try/catch: on error, log it and still let the message be considered handled (no infinite retry), rather than letting exceptions propagate into kafkajs uncaught. This is the shared fix for the "poison pill" failure mode across all 3 consumers at once.
- `SimulatorService` validates `STATUS_CHANGED`'s `payload.currentStatus` against the 5 allowed `MachineStatus` values (not just "is a string"), and validates `schemaVersion` is actually numeric (not just "is present") — closing the two concrete gaps that let invalid data reach Kafka in the first place.
- `MachineProjectionConsumerService`'s event-type switch gets a `default` branch that skips the machine save entirely for an unrecognized `eventType`, instead of silently falling through to the final `lastEventId`/`save()` and marking an unprocessed event as processed.
- `MachineProjectionConsumerService`'s `PRODUCTION_COMPLETED` handling guards against a non-numeric `quantity` before applying it, instead of allowing `productionCount` to become permanently `NaN`.
- `AlertConsumerService`'s `TEMPERATURE_REPORTED` handling guards against a missing/non-numeric `temperature` before comparing against the threshold, instead of creating an alert whose message reads "Temperature undefinedC exceeds warning threshold."

## Capabilities

### New Capabilities

- `kafka-consumer-resilience`: cross-cutting behavior of `KafkaConsumerBase` and its 3 subclasses when a Kafka message can't be processed — an unhandled error in one consumer's message handling must not block that consumer group from progressing on subsequent messages.

### Modified Capabilities

- `machine-event-ingestion`: the "Reject a payload that fails schema validation" requirement strengthens for `STATUS_CHANGED` (must be one of the 5 allowed statuses, not just a string) and for the shared envelope validation (`schemaVersion` must be numeric, not just present).
- `machine-state-projection`: new requirements for (a) skipping unrecognized event types without falsely marking them processed, and (b) not corrupting `productionCount` when `quantity` is missing/invalid.
- `alert-detection`: new requirement for not creating a malformed alert when `TEMPERATURE_REPORTED`'s `temperature` is missing/invalid.

## Impact

- **Code**: `backend/src/shared/kafka/kafka-consumer.base.ts`, `backend/src/simulator/simulator.service.ts`, `backend/src/machines/machine-projection-consumer.service.ts`, `backend/src/alerts/alert-consumer.service.ts`.
- **Behavior change**: today, an invalid/malformed Kafka message can crash a whole consumer group indefinitely. After this change, it gets logged and skipped instead. This is a deliberate MVP-appropriate choice (log-and-skip, no dead-letter queue) — see `design.md` for the tradeoff.
- **No API contract changes** — `docs/design/api.md` is unaffected; the two new/strengthened validations (`STATUS_CHANGED` enum, `schemaVersion` type) already fall under the existing `422 PAYLOAD_VALIDATION_FAILED` / `400 INVALID_EVENT_ENVELOPE` error codes documented there.
- **Docs**: none required beyond what's already written — this is pure implementation catch-up on bugs found by code review, not a new design decision needing separate documentation.
