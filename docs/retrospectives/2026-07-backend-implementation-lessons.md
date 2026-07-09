# Backend Implementation Lessons (2026-07)

Covers the session that built IFOC's backend from the walking skeleton through 3 rounds of `/code-review` and one full architectural reversal (Kafka consumer error handling: a hand-rolled retry mechanism was implemented, verified working, then reverted after code review found it fundamentally conflicted with the Kafka client library's own retry mechanism). This document is organized by **root-cause pattern**, not by bug, because most of the ~20 individual findings across the 3 review rounds reduce to 4-5 repeated mistakes.

---

## Pattern 1: Validation written against the spec's examples, not against the field's full constraint space

**Bugs this produced:**
- `STATUS_CHANGED`'s `currentStatus` was validated as "is a string" but never checked against the actual 5-member `MachineStatus` enum, so an out-of-enum value like `"BOGUS"` passed HTTP validation, reached the Kafka consumer, and threw a Mongoose `ValidationError` at save time.
- `schemaVersion` was validated as `typeof x !== 'number'`, which does not reject `NaN` or `Infinity` — both have `typeof === 'number'` in JavaScript. A value like `1e400` (valid JSON syntax, parses to `Infinity` via floating-point overflow) slipped through.
- `TEMPERATURE_REPORTED`'s `temperature` had the same `typeof`-only gap, and the fix was initially applied to only one of the two consumers that read it (see Pattern 3 below for why partial fixes kept happening).

**Why this happened:** Each validator was written by looking at `docs/design/event-schema.md`'s "required payload fields" table and asking "is this field present and roughly the right JS type?" — which correctly catches missing fields, but never asks "what is this field's *actual* domain?" The domain for `currentStatus` isn't "a string," it's "one of 5 specific strings," defined in a *different* file (`machine-schema.md` / `machine.schema.ts`'s `MACHINE_STATUSES`). The domain for a "number" field in this codebase isn't "anything `typeof` calls a number," it's "a finite number" — a distinction JavaScript doesn't make for you and that only shows up if you deliberately think about `NaN`/`Infinity` as inputs, not just wrong-type inputs.

**How to avoid it:** When writing a validator for a field, don't stop at "does the schema doc say this field is required and roughly what type." Ask: where does this field's *value* get consumed downstream, and what does *that* code assume? If a downstream Mongoose schema has an `enum:` constraint, the validator should check membership in that same enum (ideally importing the same constant, not re-typing the list). If a downstream calculation does arithmetic or comparison on a "number," validate with `Number.isFinite()`, not `typeof === 'number'`.

---

## Pattern 2: Fixing one reported edge case without re-checking the function's full input space

**The bug:** `events.service.ts`'s pagination `limit` parameter had a known bug: `Number(query.limit) || DEFAULT_LIMIT` treats `limit=0` as falsy, silently returning the default page size instead of a 0-sized page. The fix — `query.limit !== undefined ? Number(query.limit) : DEFAULT_LIMIT` — correctly fixed the `0` case. It also **silently reintroduced a different bug**: a non-numeric `limit` (e.g. `?limit=abc`) now produces `Number('abc')` = `NaN`, which propagates unguarded into a MongoDB query. The *original* buggy code accidentally handled this case correctly, because `NaN` is also falsy — the fix traded one edge case for another without anyone noticing until the next `/code-review` pass caught it.

**Why this happened:** The fix was scoped to "make `limit=0` work," verified by testing `limit=0`, and considered done. It was never re-tested against the *other* edge cases the original one-liner happened to also handle (non-numeric strings, `undefined`, negative numbers) — because those weren't the reported bug, so they weren't in scope for the fix's own verification. A single terse expression like `Number(x) || DEFAULT` quietly encodes handling for several unrelated edge cases at once (falsy-zero, `NaN`, `undefined` all collapse to the same branch); replacing it with something more explicit requires deliberately re-deriving the full behavior table for all of those cases, not just the one being fixed.

**How to avoid it:** When a fix changes how a function handles one edge case, explicitly enumerate the other edge cases the *old* code was implicitly handling (even accidentally) and confirm the *new* code still handles all of them — don't just verify the one case from the bug report. This is especially true when the original code was a single dense expression (`a || b`, `a ?? b`, a truthy check standing in for multiple conditions) — density is often what let multiple cases collapse into one line unnoticed in the first place.

---

## Pattern 3: Designing custom infrastructure logic without first checking whether the library already in use provides it

**The bug (the big one):** To fix Kafka consumers silently dropping events on transient failures (e.g. a brief MongoDB disconnect), a bounded retry-with-backoff utility (`withRetry`, 3 attempts, exponential delay) was designed, implemented, manually verified working, and shipped — chosen by the user from 3 documented options after a design discussion. A second `/code-review` pass then found:
1. **`kafkajs` (already a project dependency) has its own built-in, tested, jittered retry mechanism for exactly this failure class** (`Runner`-level retry on `eachMessage` errors, configurable via `kafka.consumer({ retry: {...} })`, defaulting to 5 retries with jitter). The hand-rolled retry didn't just duplicate this — it **made it permanently unreachable**, because the outer `try/catch` around `eachMessage` swallowed every error before it could ever propagate to kafkajs's own retry layer.
2. The hand-rolled retry had no jitter (fixed backoff), creating a synchronized-retry-storm risk that kafkajs's own mechanism already avoids.
3. Retrying inside a single `eachMessage` invocation with no `heartbeat()` call during the retry delays risked exceeding the consumer's session timeout during a real (not brief) outage, which would trigger a **group rebalance** — a new failure mode, introduced by the fix, in exactly the scenario the fix was meant to help with.

The decision was reversed: the hand-rolled retry was deleted, replaced with a much smaller "classify the error, and only swallow it ourselves if retrying definitely can't help; otherwise let it propagate to kafkajs's own retry" approach — which needed no custom retry loop at all.

**Why this happened:** The problem was framed as "how do we add retry logic to our Kafka message handler," which is a request to *build* something. Nobody asked "does the Kafka client library we're already using solve this problem already" before starting to design. This is a scoping failure at the very first step: the initial design document (`design.md`) presented 3 options — accept, classify, or retry — and even explicitly claimed (in Option C's own writeup) "no interaction with kafkajs's own consumer-level retry config," treating that as a *feature* of the hand-rolled approach (simpler, self-contained) rather than checking whether it was actually true. It wasn't checked against the library's source before being written down as a design fact — see Pattern 4.

Worth noting: the *same session* correctly applied "check for existing reuse" at a smaller scope — `isDuplicateKeyError` being duplicated across two files was caught and consolidated into a shared utility, explicitly because it duplicated *sibling application code*. The reflex to grep the *current codebase* for existing helpers was present and working. The reflex to check the *underlying dependency's* documented/source-level behavior before designing a whole new mechanism was not — reuse-checking was applied at the "did we already write this" scope but not at the "did the library we depend on already solve this" scope.

**How to avoid it:** Before designing custom logic for a cross-cutting infrastructure concern (retry, backoff, timeout, connection pooling, rate limiting, circuit breaking), explicitly research whether the library already in use (here: `kafkajs`) has first-class support for it, and read enough of that library's source/docs to know *how* it works (not just *that* a config option with a promising name exists) — specifically, how it interacts with error propagation, since "does this library retry for me" is a question about control flow, not just configuration. Only design something bespoke after confirming the existing mechanism doesn't fit, and say so explicitly in the design doc ("kafkajs's own retry doesn't work here because X").

---

## Pattern 4: A design document's technical claims about a library's behavior were asserted, not verified

**The bug:** `design.md`'s Option C section stated the hand-rolled retry had "no interaction with kafkajs's own consumer-level retry config — this operates entirely inside a single `eachMessage` call, before kafkajs's own retry/heartbeat machinery is involved." This is the specific sentence that turned out to be wrong (see Pattern 3) — and it was written and put in front of the user as a stated fact/tradeoff, shaping their decision, without having actually traced kafkajs's source to check it.

**Why this happened:** The claim *sounded* right from surface-level reasoning: the new code doesn't import anything from `kafkajs`'s retry module, so intuitively it seems disconnected from it. But whether two pieces of code "interact" is a question about runtime control flow (does an error thrown in one place get caught somewhere that matters), not about import statements. Reasoning from "what does this code visibly touch" instead of "what does this code's *failure to throw* prevent from happening elsewhere" produced a plausible-sounding but false conclusion.

**How to avoid it:** Any design-doc claim of the shape "X doesn't affect Y" or "X and Y are independent," when X and Y are both part of the same runtime call stack (even indirectly, even across a library boundary), needs to be verified by actually tracing the control flow — not asserted from what the new code imports or doesn't import. If the claim can't be quickly verified, say so explicitly ("assumed, not verified — see Open Questions") rather than stating it as settled fact. This is the same discipline the `/code-review` skill itself enforces (CONFIRMED requires quoting the actual line/source, not inferring it) — it should also apply when *writing* design docs, not just when reviewing code against them.

---

## Pattern 5: A latent bug existed for the whole session and was only found because a new kind of check (a real unit test) finally exercised it

**The bug:** `Machine.status`, `Alert.severity`, and `Alert.status` are Mongoose `@Prop()` fields typed as string-literal unions (e.g. `MachineStatus`). `@nestjs/mongoose`'s decorator needs an explicit `type: String` for such fields to resolve correctly under TypeScript's `emitDecoratorMetadata` when the type is defined in a *different file* and consumed via more restrictive `import type` / `isolatedModules` semantics — without it, the decorator throws "Cannot determine a type" at the moment the class is actually loaded. This had been present since the very first walking-skeleton commit, but never surfaced, because the full NestJS application (which resolves types across the whole compiled program, not per-file) never hit the failure mode, and no test had ever imported these schema classes in isolation until the very first real unit test (`sensor-failure-contract.spec.ts`, written for an unrelated reason — a business-logic contract test) transitively loaded them under `ts-jest`.

**Why this happened:** Nothing about the running application (Docker container, `nest build`, `nest start`) ever exercised this code path — full-program compilation happens to resolve the type correctly, so `npm run build` and the actual running server both worked fine the entire time. The bug was invisible to every verification method used up to that point (manual HTTP testing against the real running system, `docker logs`, `tsc --noEmit`) because none of them load a single file in isolation the way `ts-jest`'s per-file transpilation does.

**How to avoid it:** This isn't really avoidable by writing better code up front — it's a class of bug (compiler-mode-dependent metadata resolution) that specifically requires the *kind* of check that catches it (a real unit test importing the file in isolation) to exist before it can be found. The actionable lesson is narrower: when a project has been running for a while with zero real unit tests (as this one had, per `ai/rules/testing.md`'s "strategy not finalized" note), expect that adding the *first* one will likely surface at least one unrelated latent issue purely due to being a new kind of check — budget time for that when introducing testing infrastructure, and don't be surprised or worried when it happens; it's a sign the new check is doing its job, not a sign something regressed.

---

## Meta-lesson: what actually caught these bugs, and what didn't

None of the 5 patterns above were caught by:
- Manual HTTP/Kafka testing against the real running system (used extensively and correctly throughout — confirmed every *feature* worked as intended, every time)
- `tsc --noEmit` / `npm run build` / `npm run lint` (all clean, every round)
- The author's own re-reading of the code immediately after writing it

All 5 were caught by an independent, systematic `/code-review` pass — specifically the angles that don't just ask "does this do what it's supposed to" (which manual testing already answers) but "what does this *remove or change* that something else depended on" (removed-behavior auditor), "what happens at this code's actual boundaries with its dependencies" (cross-file tracer, and for Pattern 3/4, tracing into the `kafkajs` library's own source), and "is this the right depth of fix, or a bandaid" (altitude).

**Implication:** manual verification against a running system is necessary but not sufficient for infrastructure-level or cross-cutting changes — it proves the happy path and the specific scenario you thought to test, but structurally cannot catch "this conflicts with something else's behavior" or "this doesn't cover the input space you didn't think to test," because you only test what you already suspect might be wrong. For any change touching shared infrastructure (Kafka consumer base classes, validation shared across event types, anything with an existing library that might already do it), treat a `/code-review` pass — or at minimum, deliberately researching the underlying library's behavior — as part of *finishing* the change, not an optional extra step after it's "done."
