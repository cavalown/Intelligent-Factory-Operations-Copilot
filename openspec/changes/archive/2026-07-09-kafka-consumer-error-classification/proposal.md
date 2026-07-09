## Why

`kafka-consumer-reliability-hardening` added a catch-all around `KafkaConsumerBase`'s `handleMessage` call to stop a single malformed "poison pill" message from stalling a consumer group forever. A follow-up `/code-review` pass found that the catch-all is broader than intended: it swallows **every** error uniformly, not just malformed-data errors. This includes transient infrastructure failures (e.g. a dropped MongoDB connection mid-`.save()`) that the 3 subclasses' own `catch (err) { if (isDuplicateKeyError(err)) return; throw err; }` pattern was written to let propagate and crash the process — under the old (pre-hardening) behavior, a crash meant the container restarted and Kafka redelivered the message once the consumer reconnected. Now, that same transient failure is logged once and the message is gone for good, with no retry.

This proposal exists to make the choice explicit and get it decided deliberately, rather than leaving the current broader-than-intended behavior in place by default. `design.md` laid out three candidates (accept as-is, classify errors, bounded retry) with their tradeoffs. **The user initially chose Option C (bounded retry with backoff), which was implemented and manually verified working — but a second `/code-review` pass on that implementation found it introduced worse problems than it solved** (see `design.md`'s "Why Option C was reverted"): it silently duplicated kafkajs's own built-in jittered retry mechanism (without the jitter), and retrying a slow-to-fail operation with no `heartbeat()` call risked exceeding the consumer's session timeout and triggering a group rebalance during exactly the sustained-outage scenario it was meant to help with. **The decision was revised to Option B (error classification)**, which reuses kafkajs's own already-tested retry mechanism instead of reinventing it.

## What Changes

- `backend/src/shared/kafka/retry.util.ts` and `retry.util.spec.ts` (Option C's implementation) are deleted.
- New `backend/src/shared/kafka/error-classification.util.ts` exports `isDataError(err: unknown): boolean`, classifying `SyntaxError` (JSON parse failures), Mongoose `ValidationError`, and Mongoose `CastError` as "this message's content is wrong, retrying won't help."
- `KafkaConsumerBase`'s `eachMessage` catch block changes from "log and swallow everything" to: swallow (log-and-skip) only `isDataError` errors; rethrow everything else, letting it reach kafkajs's own runner-level retrier (jittered, already a tested part of the `kafkajs` dependency) instead of a hand-rolled retry loop.
- No per-subclass changes needed — the classification happens generically in the base class, so all 3 consumers (Event/Machine/Alert Service) get the corrected behavior uniformly.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `kafka-consumer-resilience`: the existing "Consumer error boundary prevents indefinite stall" requirement (from `kafka-consumer-reliability-hardening`) gains a new requirement that only data errors are swallowed at the `handleMessage` boundary; other errors propagate so kafkajs's own retry mechanism can handle them.

## Impact

- **Code**: `backend/src/shared/kafka/kafka-consumer.base.ts`, new `backend/src/shared/kafka/error-classification.util.ts`, deleted `backend/src/shared/kafka/retry.util.ts` + `retry.util.spec.ts`. No changes needed to `event-consumer.service.ts` / `machine-projection-consumer.service.ts` / `alert-consumer.service.ts`.
- **Behavior change**: a transient infrastructure failure now propagates to kafkajs's own retry mechanism (jittered, ~5 retries by default, up to ~30s) instead of either being silently dropped (pre-this-proposal state) or retried by a hand-rolled loop with session-timeout risk (Option C's reverted state). A malformed/unprocessable message is still logged and skipped immediately, with no added latency (unlike Option C's ~600ms retry delay for a deterministically-failing message).
- **Docs**: `openspec/changes/archive/2026-07-08-kafka-consumer-reliability-hardening`'s design rationale is extended (not contradicted) by this change — the poison-pill fix stays, this narrows what gets caught at that boundary.
- **No API contract changes** — purely internal consumer error-handling behavior.
