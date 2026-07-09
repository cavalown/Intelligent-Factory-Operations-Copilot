## Context

This change bundles 4 low-severity code-review findings that don't share a single root cause the way `kafka-consumer-reliability-hardening`'s findings do — they're grouped here because none of them affect runtime correctness under normal operation, unlike that other change. The one exception worth designing carefully is the sensor-failure contract test, since it's the concrete follow-up to the `machine-schema.md` §5.4 explore-session decision (keep Machine Service and Alert Service structurally independent; use a contract test instead of a shared business-logic module, since `ai/rules/module-boundaries.md` forbids business logic in `shared/`).

## Goals / Non-Goals

**Goals:**
- Fix the one real (if minor) bug: `limit=0` silently ignored.
- Remove duplicated implementation with no behavior change (`isDuplicateKeyError`, dead type alias).
- Add a contract test that fails loudly if Machine Service's and Alert Service's independent "is this STATUS_CHANGED a sensor failure" classifications ever disagree again, without merging their implementations.

**Non-Goals:**
- Not resolving the project's broader "automated testing strategy not finalized" open question (`ai/rules/testing.md`) — this change adds exactly one narrowly-scoped test using the Jest setup NestJS already scaffolded (`npm test` already runs `*.spec.ts` under `backend/src/`; this is additive, not a new testing framework decision).
- Not extracting the temperature-threshold duplication between the two services (also flagged in the explore session) — `machine-schema.md` §5.4 explicitly defers that to Phase 2's Rule Engine, and it's a different (already-consistent) piece of duplicated logic, not the one that actually drifted.
- Not touching the two consumers' actual classification logic beyond what's needed to make it testable (see Decision 2) — the goal is to catch drift, not to change today's (currently-consistent, after finding #9 was fixed elsewhere... actually finding #9's inverted polarity has NOT yet been fixed anywhere; see Decision 2 for how this change handles that).

## Decisions

### 1. `isDuplicateKeyError` moves to `backend/src/shared/database/mongo-error.util.ts`

Per `ai/rules/module-boundaries.md`, `shared/` is for "types, DTOs, and cross-cutting infrastructure... No business logic." A MongoDB error-code check is infrastructure (it's about the database driver's error shape, not this app's business rules), so it belongs in `shared/database/` (alongside `database.module.ts`) rather than `shared/kafka/` — despite both of today's call sites being Kafka consumers, the check itself has nothing to do with Kafka. Both `event-consumer.service.ts` and `alert-consumer.service.ts` import and call the shared function instead of defining their own private copy.

### 2. The contract test needs each service's classification logic to be independently callable — extract a small pure function per service, not shared between them

To test "does Machine Service's classification agree with Alert Service's classification" without merging their code, each service needs its sensor-failure check extracted into a small, independently-testable pure function:

```typescript
// still inside machine-projection-consumer.service.ts, not shared:
function isStatusChangedSensorFailure(currentStatus: string): boolean {
  return currentStatus === 'WARNING';
}

// still inside alert-consumer.service.ts, not shared:
function isStatusChangedSensorFailure(currentStatus: string): boolean {
  return currentStatus === 'WARNING'; // fixed: was `!== 'WARNING'` (inverted)
}
```

Both files get a function with the *same name and same logic*, but no shared import between them — this is intentional per `machine-schema.md` §5.4's decision to keep the two services structurally independent. The contract test imports both functions and asserts they agree across a shared fixture list. This also directly fixes finding #9's inverted polarity as a side effect of making the logic testable in the first place — the bug was found by code review, and extracting the logic into a named, testable function is what makes "these two disagree" a one-line test assertion instead of something only caught by manual inspection.

Alternative considered: don't extract anything, write an integration-style test that feeds a Kafka message through both real consumers and inspects their MongoDB writes. Rejected — much heavier (needs Kafka/Mongo test infrastructure this project doesn't have yet), and tests more than the actual point of drift; a focused unit test on the two extracted predicates is cheaper and just as effective at catching the specific bug class.

### 3. `limit=0` fix: explicit `undefined` check, not a truthy/falsy rewrite

```typescript
// before:
const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
// after:
const rawLimit = query.limit !== undefined ? Number(query.limit) : DEFAULT_LIMIT;
const limit = Math.min(Math.max(rawLimit, 1), MAX_LIMIT);
```

`limit=0` now flows through as `0`, then gets clamped to `1` by the existing `Math.max(..., 1)` — i.e. the fix is scoped to "stop miscategorizing 0 as absent," not "allow a literal zero-size page" (a 0-size page is a degenerate case not worth supporting; clamping to 1 matches the existing documented minimum-useful behavior).

## Risks / Trade-offs

- **[Risk] The two `isStatusChangedSensorFailure` functions still have to be manually kept in sync by whoever edits one of them** — the contract test only catches drift *after* it happens (at test-run time), not at edit time. → **Mitigation**: accepted; this is the whole point of choosing contract-test over shared-code per `machine-schema.md` §5.4 — it's a cheaper, lower-coupling safety net, not a structural guarantee. Phase 2's Rule Engine is the structural fix.
- **[Risk] This is the first real unit test in the codebase** (`app.controller.spec.ts` is an untouched Nest scaffold stub) — sets an implicit precedent without a broader testing strategy decision having been made. → **Mitigation**: scoped narrowly on purpose (see Non-Goals); flagged here explicitly so it's understood as "one test that happened to be the right tool for this specific problem," not "the testing strategy has now been decided."

### Addendum: open question surfaced by a second code-review pass, not resolved here

A second `/code-review` run against this change's own implementation (see `proposal.md`'s "Update" note) found that `KafkaConsumerBase`'s catch-all (from `kafka-consumer-reliability-hardening`) swallows **every** error from `handleMessage` uniformly — not just malformed "poison pill" messages, but also transient infrastructure failures (e.g. a dropped MongoDB connection mid-`.save()`). The 3 subclasses' own `catch (err) { if (isDuplicateKeyError(err)) return; throw err; }` pattern was written assuming that `throw` would propagate and crash the process (making a transient failure visible via container restart, then naturally retried when Kafka redelivers on reconnect). Now that the base class catches everything one level up, that `throw` just gets logged-and-skipped like any other error — a well-formed event that failed only because of a temporary outage is now silently dropped forever instead of being retried.

This is a real design question — distinguishing "safe to skip forever" (malformed data) from "should be retried" (transient infra) requires either an error-type taxonomy (e.g. only catch `SyntaxError`/`ValidationError`/`CastError` at the base-class level, let everything else propagate) or a retry-with-backoff layer, both of which are more than a one-line fix. **Not resolved in this change** — surfaced to the user for a decision rather than silently picked, per this project's working norm of not resolving non-obvious design decisions unilaterally.

## Migration Plan

No data migration. Purely additive/refactor: `isDuplicateKeyError`'s behavior is unchanged (same check, new location); the dead type alias's removal has no runtime effect (TypeScript-only); the `limit=0` fix changes one edge-case response. Deploy as a normal backend rebuild.
