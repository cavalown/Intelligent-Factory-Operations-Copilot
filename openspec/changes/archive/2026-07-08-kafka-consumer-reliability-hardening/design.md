## Context

`KafkaConsumerBase.onModuleInit` (`backend/src/shared/kafka/kafka-consumer.base.ts`) wires `eachMessage: (payload) => this.handleMessage(payload)` directly, with no wrapper. All 3 subclasses (`EventConsumerService`, `MachineProjectionConsumerService`, `AlertConsumerService`) call `JSON.parse(message.value.toString())` and then act on the result with no schema validation, trusting that every message on `machine.events` passed through `SimulatorService`'s HTTP-boundary validation. That trust is misplaced in two ways: (1) `SimulatorService`'s own validation has real gaps (`STATUS_CHANGED.currentStatus` isn't checked against the enum; `schemaVersion` isn't checked for type), and (2) even with perfect HTTP-boundary validation, the topic isn't guaranteed to only ever receive messages from that one HTTP path (replays, future producers, manual test messages).

## Goals / Non-Goals

**Goals:**
- No single malformed/edge-case Kafka message can permanently stall a consumer group.
- Close the two concrete validation gaps at the HTTP boundary (`currentStatus` enum, `schemaVersion` type) so the common case is caught early with a clear `4xx` response instead of surfacing as a consumer crash minutes later.
- Prevent the two silent-corruption cases (`NaN` `productionCount`, "undefined" in alert messages) with narrow, local guards.

**Non-Goals:**
- No dead-letter queue, no retry-with-backoff policy, no alerting/observability pipeline for skipped messages. This is deliberately the smallest fix that stops the bleeding — see Risks below for what's explicitly deferred.
- No change to the `machine.events` topic schema, partitioning, or consumer group configuration.
- No re-validation of every field on every message (that would duplicate `SimulatorService`'s validation inside the consumers, which is its own maintenance burden) — only the specific fields whose absence/malformation causes a crash or silent corruption get a guard.

## Decisions

### 1. Fix the error boundary once, in `KafkaConsumerBase`, not in each subclass

All 3 consumers share the same missing-error-boundary problem, so the fix belongs in the shared base class, not copy-pasted into each subclass (avoiding yet another 3x duplication in a codebase code review just flagged for exactly that). `onModuleInit` changes from:

```typescript
await this.consumer.run({
  eachMessage: (payload) => this.handleMessage(payload),
});
```

to wrapping the call:

```typescript
await this.consumer.run({
  eachMessage: async (payload) => {
    try {
      await this.handleMessage(payload);
    } catch (err) {
      this.logger.error(`Failed to process message: ${err}`, err instanceof Error ? err.stack : undefined);
    }
  },
});
```

This requires `KafkaConsumerBase` to have its own `Logger` (subclasses already each create their own `Logger` instance for other messages; the base class gets one too, scoped to the concrete subclass's name via `this.constructor.name`).

### 2. Policy on catch: log-and-skip, not retry-and-crash

Catching the error and *not* rethrowing means kafkajs still advances past that message (the consumer's `eachMessage` returning normally is what allows offset commit to proceed) — the message is effectively skipped, not retried. This trades "a bad message blocks everything forever" for "a bad message is dropped after being logged." For an MVP with no dead-letter queue, this is the safer default: a stuck consumer group silently blocks the entire pipeline (all machines, not just the one event), while a dropped message only loses that one event's effect. Anyone investigating a discrepancy can grep the logs for the error `docker logs` output.

Alternative considered: retry with a bounded attempt count before skipping. Rejected for now — no evidence yet that transient failures (vs. permanently malformed messages) are a real problem in this codebase's failure modes; the 6 findings this change fixes are all deterministic (an invalid message is invalid forever, retrying it changes nothing). Revisit if a real transient-failure case shows up.

### 3. Close validation gaps at the boundary too, even though the catch-all now exists

The catch-all in Decision 1 is a safety net, not a substitute for input validation — it turns a crash into a silent skip, which is strictly better but still means the event is lost with no feedback to whoever sent it. `SimulatorService`'s two gaps (`currentStatus` enum, `schemaVersion` type) are cheap to close and give the HTTP caller an immediate, actionable `4xx` instead of a `202` followed by silent data loss downstream. Per `docs/design/api.md` §6 (line 387), a wrong-typed envelope field already falls under the documented `400 INVALID_EVENT_ENVELOPE` — `schemaVersion`'s type check belongs in `validateEnvelope`, not a new error code. `currentStatus`'s enum check is a payload concern and already documented under `422 PAYLOAD_VALIDATION_FAILED`.

### 4. `NaN`/`undefined` guards stay local to their call site, not folded into the catch-all

Decision 1's try/catch only helps when something *throws*. `productionCount += undefined` (→ `NaN`) and `undefined <= threshold` (→ `false`, skipping the intended early-return) don't throw — they're silent logic bugs, not exceptions. These need their own narrow `typeof`/`Number.isFinite` guards at the exact point of use, per finding #4 and #6 from the code review. No shared abstraction for this — two isolated one-line guards, not worth generalizing.

## Risks / Trade-offs

- **[Risk] Silently skipping a malformed message means data loss with no operator-visible signal beyond a log line.** → **Mitigation**: accepted for the MVP (see Decision 2); a proper dead-letter topic or alerting-on-parse-failure is Phase 2/3 infrastructure work, out of scope here. Flagged explicitly so it isn't mistaken for "solved."
- **[Risk] The `KafkaConsumerBase` catch-all could mask a real bug during development** (e.g. a typo in a new event-type branch would now log-and-continue instead of crashing loudly in a dev environment). → **Mitigation**: the log line includes the full error and stack trace; `docker logs ifoc-backend` remains the source of truth during manual verification, same as today.
- **[Risk] Closing the `currentStatus` enum gap at the simulator boundary doesn't help if a message reaches Kafka some other way** (replay, manual publish). → **Mitigation**: this is exactly why Decision 1's catch-all exists as defense in depth — the boundary fix and the catch-all are complementary, not redundant.

## Migration Plan

No data migration. Purely additive/defensive: existing valid-input behavior is unchanged; only the previously-crashing/corrupting paths change behavior (to log-and-skip or to reject with 4xx). Deploy as a normal backend rebuild (`docker compose up -d --build backend`).
