## Context

Current code (`backend/src/shared/kafka/kafka-consumer.base.ts`, lines 27-43):

```typescript
await this.consumer.run({
  eachMessage: async (payload) => {
    try {
      await this.handleMessage(payload);
    } catch (err) {
      this.logger.error(
        `Failed to process message: ${err}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  },
});
```

This is a blanket `catch`: every error, regardless of cause, is logged and the message is treated as handled (kafkajs commits the offset, moves to the next message). Two genuinely different failure classes flow through this same path today:

1. **Data-is-bad errors** — malformed JSON (`JSON.parse` `SyntaxError`), a Mongoose `ValidationError`/`CastError` from a value that violates a schema constraint (e.g. an out-of-enum `status`), or any error whose cause is "this specific message's content is wrong." Retrying the same message would fail identically every time — skipping it is the only sane response without a dead-letter queue.
2. **Transient-infrastructure errors** — a dropped MongoDB connection, a network blip, a temporary Kafka broker unavailability surfacing through a downstream call. Retrying (or just letting the process crash and get restarted by Docker, then having Kafka redeliver on reconnect) would very likely succeed. Treating these identically to class 1 silently drops a perfectly good event.

Before this catch-all existed, ALL errors crashed the process (visible via container restart, and Kafka would redeliver on reconnect since the offset was never committed for the failed message). The catch-all fixed class 1's failure mode (infinite retry loop stalling the whole consumer group) but, as a side effect, also changed class 2's failure mode from "crash and eventually recover via redelivery" to "silently drop forever."

## Goals / Non-Goals

**Goals:**
- Make the class-1 vs class-2 tradeoff an explicit, recorded decision — not an accidental side effect of the reliability-hardening change.

**Non-Goals:**
- Not attempting to build a fully general observability/alerting pipeline for skipped messages in this change (any option below could be extended with that later, but it's not required to resolve this decision).
- Not re-litigating whether the reliability-hardening change itself was correct — the poison-pill problem it fixed is real and the fix stays; this is only about narrowing what gets caught.

## Decisions

**Revised decision: Option B (error classification), superseding an earlier choice of Option C.** Option C (bounded retry with backoff) was implemented first and then reverted after a `/code-review` pass on the implementation found it introduced more risk than it removed — see "Why Option C was reverted" after Option C's section below. Options A and C are kept below as documented alternatives, not deleted, since the comparison and the reversal reasoning are useful context for anyone revisiting this later.

### Option A — Accept current behavior, document it as a known risk (not chosen)

Do nothing to the code. Record explicitly (here, and optionally in `docs/design/architecture.md` or a similar living doc) that `KafkaConsumerBase` treats all `handleMessage` failures identically: log once, skip forever, no retry — including transient infrastructure failures.

**Tradeoffs:**
- ✅ Zero implementation cost, zero new complexity.
- ✅ Consistent, simple mental model: "the consumer never gets stuck, full stop."
- ❌ A real, valid event can be silently and permanently lost due to nothing more than bad luck (a MongoDB blip at the wrong moment). For an MVP/demo project with synthetic data and no SLA, the practical cost of this is low — but it is real, and it would resurface as a confusing "why is this data missing" bug if it ever happens during a demo.
- ❌ Silent data loss with no operator-facing signal beyond a log line (already flagged as an accepted risk in `kafka-consumer-reliability-hardening`'s design doc, but that framing was specifically about malformed messages — this option explicitly extends the same acceptance to transient infra failures too).

### Option B — Classify errors: only skip on data errors, let infra errors propagate (chosen)

Change the catch block to inspect the error and only swallow it if it's a "data is bad" error class; anything else is rethrown — **not to crash the process directly, but because kafkajs's own `Runner` wraps every `eachMessage` invocation in its own retrier** (confirmed via code review of `kafkajs`'s source, `node_modules/kafkajs/src/consumer/runner.js` and `retry/defaults.js`: default config is `{retries: 5, initialRetryTime: 300ms, factor: 0.2 jitter, multiplier: 2, maxRetryTime: 30000ms}`). A rethrown error is caught by kafkajs's own retry loop first — jittered, battle-tested, already a dependency — and only crashes the process if kafkajs's own retry budget is exhausted, at which point Docker restarts the container and Kafka redelivers on reconnect (the pre-hardening recovery path).

```typescript
// backend/src/shared/kafka/error-classification.util.ts
import mongoose from 'mongoose';

export function isDataError(err: unknown): boolean {
  return (
    err instanceof SyntaxError ||             // JSON.parse failures
    err instanceof mongoose.Error.ValidationError ||
    err instanceof mongoose.Error.CastError
  );
}
```

```typescript
// kafka-consumer.base.ts
} catch (err) {
  if (isDataError(err)) {
    this.logger.error(`Skipping unprocessable message: ${err}`, ...);
    return; // swallow — commits the offset, moves to the next message
  }
  throw err; // let kafkajs's own retrier (jittered, already tested) handle it
}
```

**Tradeoffs:**
- ✅ Directly fixes the regression: transient infra errors get kafkajs's own jittered retry (and eventual crash-and-redeliver as a last resort) back, malformed messages still don't stall the consumer group.
- ✅ Small, contained change — one classification helper, no new dependencies, and *less* code than Option C (no retry loop, no backoff timer to write/maintain ourselves).
- ✅ No risk of exceeding the consumer's session timeout from our own code — we're not blocking `eachMessage` with manual retry delays; kafkajs's runner-level retry already accounts for consumer-group liveness correctly (it's the library's job, not ours).
- ✅ No risk of retrying an entire multi-step `handleMessage` and re-doing already-succeeded side effects, since a genuinely retryable error only gets retried by kafkajs re-invoking `eachMessage` fresh — same risk profile as the pre-hardening/pre-any-of-this-work behavior, which was never flagged as a problem.
- ❌ The classification list (`SyntaxError`, `ValidationError`, `CastError`) is a best-effort enumeration, not exhaustive — a new error type introduced later (e.g. from a future validation library swap) could silently fall into the wrong bucket unless the list is kept up to date. This is the same category of "duplicated knowledge that can drift" the project has hit before (see `docs/design/machine-schema.md` §5.4), just in a different shape (a type-check list instead of a duplicated predicate).
- ❌ A sustained outage still eventually crash-loops the container (Docker restarts, immediately fails again, repeat) until the outage clears, once kafkajs's own retry budget (default ~30s worth, `maxRetryTime`) is exhausted — acceptable for a side project, and arguably more honest than any option that pretends to fully mask a sustained outage.

### Option C — Bounded retry with backoff for all errors (chosen, then reverted)

Wrap `handleMessage` in a retry loop (3 attempts, with a 200ms delay before attempt 2 and a 400ms delay before attempt 3 — no delay after the final attempt, since at that point there's nothing left to wait for) before falling back to log-and-skip. No classification needed — a data error will simply fail all 3 attempts identically and get skipped; a transient error has a real chance of succeeding on attempt 2 or 3.

```typescript
// backend/src/shared/kafka/retry.util.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 200,
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** i));
    }
  }
  throw new Error('unreachable'); // satisfies TS control-flow analysis
}
```

`KafkaConsumerBase`'s `eachMessage` calls `withRetry(() => this.handleMessage(payload))` instead of calling `this.handleMessage(payload)` directly; the existing outer `try/catch`+log-and-skip stays as the final fallback after all attempts are exhausted.

**Tradeoffs (as originally assessed — see revert reasoning below for what this assessment got wrong):**
- ✅ No error-classification list to keep in sync — simpler mental model than Option B in that specific sense.
- ✅ Handles a broader class of transient issues than Option B's fixed enum (e.g. a slow-but-eventually-successful Mongo write under load, not just outright connection failures).
- ❌ Heavier: introduces retry/backoff logic and timing behavior into the hot message-processing path — every message that hits a real data error now takes ~600ms longer to fail (200ms + 400ms delays between the 3 attempts) before being skipped, versus failing immediately in Option B.
- ❌ Retries happen **inside** a single `eachMessage` invocation, so the consumer makes no progress on other messages in the same partition while retrying — for a single-partition topic (current MVP config, see `docs/deployment/docker-compose.md` §4), this means one message's retry delay blocks everything behind it, which could visibly stall the whole pipeline for up to ~600ms per bad message. **Accepted at the time**: assessed as a non-issue at MVP/demo scale — this assessment itself wasn't wrong, but see below for the risk that *was* missed.
- ~~Most complex of the three options to implement and reason about correctly. Mitigated by keeping `withRetry` a small, generic, dependency-free utility (no interaction with kafkajs's own consumer-level retry config — this operates entirely inside a single `eachMessage` call, before kafkajs's own retry/heartbeat machinery is involved).~~ **This claim was wrong** — see below.

### Why Option C was reverted

A `/code-review` pass on the actual `retry.util.ts` + `kafka-consumer.base.ts` implementation (after it was built and manually verified working) found two flaws serious enough to revert the decision rather than patch around them:

1. **The "no interaction with kafkajs's own consumer-level retry config" claim above was factually wrong.** kafkajs's `Runner` already wraps every `eachMessage` invocation in its own jittered retrier (`node_modules/kafkajs/src/consumer/runner.js` + `retry/defaults.js`). Because `KafkaConsumerBase`'s outer `try/catch` swallowed every error before it could reach kafkajs's runner, that built-in mechanism was silently made dead code — `withRetry` was a hand-rolled, un-jittered duplicate of functionality already present in a library this project already depends on. No jitter means multiple consumers retrying in lockstep after a shared outage could retry in synchronized waves instead of staggered ones, worsening exactly the kind of "just-recovering dependency gets re-overwhelmed" scenario retry logic exists to avoid.
2. **Retrying a slow-to-fail operation (not just a fast one) inside a single `eachMessage` call, with no `heartbeat()` call during the retries, can exceed the consumer's session timeout and trigger a group rebalance.** kafkajs only calls `heartbeat()` *between* `eachMessage` invocations, never during one. During a real (not brief) MongoDB outage, mongoose's own ~30s default `serverSelectionTimeoutMS` means each of the 3 retry attempts could individually block up to ~30s, so a single `eachMessage` call could block 90+ seconds with zero heartbeats — comfortably exceeding kafkajs's default 30s session timeout and getting the consumer evicted from its group mid-retry. This is the opposite of the reliability goal: the "fix" could introduce a new failure mode (rebalance churn) precisely during the sustained-outage scenario it was meant to help with.

A third, narrower issue reinforced the decision: retrying the *entire* `handleMessage` (not just the failing sub-operation) meant a single failing write could trigger up to 3x redundant DB reads/writes, and in `alert-consumer.service.ts` specifically, re-running the whole handler on retry caused `resolveAlert` to re-fetch machine state fresh each attempt — meaning a transient, unrelated failure could silently and permanently drop a legitimate alert if machine state changed between retry attempts, with no error or log to indicate the loss.

Option B avoids all three: no custom retry loop (so no jitter gap, no un-heartbeated blocking), and a genuinely retryable error is handled by kafkajs re-invoking a *fresh* `eachMessage` call (not a hand-nested retry loop), so there's no "retry the whole handler including already-fetched state" problem.

## Comparison

| | Option A (accept) | Option B (classify, chosen) | Option C (retry, reverted) |
| --- | --- | --- | --- |
| Implementation cost | None | Small | Medium |
| Fixes transient-error data loss | No | Yes (via kafkajs's own jittered retry, then crash+redeliver as last resort) | Partially (only if resolved within ~600ms retry window, and only if not itself broken by the session-timeout risk below) |
| New moving parts to maintain | None | An error-type allowlist | Retry/backoff logic (hand-rolled, un-jittered) |
| Risk of drift/staleness | N/A | Allowlist can miss a new error type | N/A |
| Jitter on retry (avoids synchronized retry storms) | N/A | Yes — inherited from kafkajs | No |
| Risk of exceeding consumer session timeout | No | No (kafkajs's own retrier is session-timeout-aware) | Yes — confirmed by code review |
| Risk of re-running already-succeeded side effects on retry | No | No | Yes — confirmed by code review (whole `handleMessage` retried, not just the failing step) |
| Added latency on the happy path | None | None | None |
| Added latency when skipping a bad message | None | None | ~600ms (3 attempts) |
| Matches project's "match implementation weight to current, real pressure" principle (`docs/design/architecture.md` §14.2, `docs/design/machine-schema.md` §5.4) | Best fit — no real pressure demonstrated yet | Reasonable — small, targeted, and leans on an already-tested library feature rather than reinventing it | Turned out to be over-built *and* under-tested relative to what it reinvented |

## Migration Plan

No data migration. `backend/src/shared/kafka/retry.util.ts` and its test are deleted; a new `backend/src/shared/kafka/error-classification.util.ts` is added. Purely a behavior change inside `KafkaConsumerBase`; deploy as a normal backend rebuild.

## Open Questions

None remaining — Option B was chosen (after reverting an initial choice of Option C once code review found it flawed); see Decisions above.
