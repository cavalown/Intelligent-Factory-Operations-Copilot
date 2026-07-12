# Design: add-insights-module

## Context

`backend/src/insights/insights.module.ts` is an empty `@Module({})` already imported by `app.module.ts`. Every other MVP backend capability exists (events, machines, alerts, simulator). The behavior of the per-machine summary endpoints is already contracted in `docs/design/api.md` §4.6–4.7 and `docs/design/architecture.md` §7.6 / §10.3; this change implements that contract and extends it with a factory scope (decided during the 2026-07-10 exploration — the Dashboard's AI Summary Card is factory-level but had no endpoint).

Constraints from key design rules: AI explains data, it does not replace it (Insight Service reads from Event/Machine/Alert data; it is never a source of truth). Per MVP scope: no job queue, no RAG, no WebSocket — `POST` calls the LLM synchronously.

Scale philosophy: 3 machines today, 300-machine vision. Interfaces should be cut where the industry-grade version would cut them (provider-agnostic LLM client, scope-parameterized pipeline), but their implementations stay MVP-thin (no retry queue, no fallback chain, no caching layer).

## Goals / Non-Goals

**Goals:**

- Implement `GET/POST /machines/:id/summary` exactly per the existing API contract.
- Add `GET/POST /summary` (factory scope) with the same response shape, `scope: "FACTORY"`, `machineId` omitted.
- One shared pipeline: gather context → build compact prompt → call LLM → persist → return.
- `LlmClient` interface with env-selected provider; exactly one concrete adapter in this change.
- LLM failure isolation: a failed LLM call returns `502 LLM_CALL_FAILED` and never affects machine/event/alert endpoints.
- Persist summaries in `ai_summaries` with `inputEventIds` traceability.

**Non-Goals:**

- Job queue / async generation, polling endpoints, streaming responses.
- Prompt caching, summary invalidation/freshness policy (GET always returns the latest stored document, however stale).
- Multiple provider adapters, retries, fallback chains.
- Kafka topics `insight.summary.requested/generated` (listed in architecture.md as future shape; MVP flow is synchronous REST per §10.3).
- Frontend work (separate change after this one).

## Decisions

### D1: One pipeline, two context gatherers

`InsightsService.generate(scope, machineId?)` runs the same steps for both scopes; only the context-gathering step branches:

```
                     ┌────────────────────────┐
 POST /machines/:id/summary ─▶│                        │
                     │  gatherContext(scope)  │──▶ buildPrompt ──▶ LlmClient ──▶ persist ──▶ respond
 POST /summary ────────▶│                        │
                     └────────────────────────┘
   MACHINE: machine state + its recent events + its alerts
   FACTORY: all machines' state + recent cross-machine events + all active alerts
```

Rationale: the two endpoints differ only in what facts feed the prompt. A scope-parameterized service keeps `ai_summaries` uniform (`scope` field already anticipated this) and means adding a future scope (e.g. production line) touches only the gatherer. Alternative considered: two separate services — rejected as duplication of the 4 identical steps.

### D2: Read via existing domain services, not direct model access

The context gatherer consumes `MachinesService`, `EventsService`, and `AlertsService` rather than injecting Mongoose models. This enforces key design rule 3 (Insight explains data owned by other services) at the module boundary. `EventsModule` and `AlertsModule` currently export nothing — add `exports: [EventsService]` / `exports: [AlertsService]`; `MachinesModule` already exports its service.

Alternative considered: inject `ai_summaries`-style read models directly — rejected because it duplicates query logic (event sorting, alert filtering) that the owning services already implement.

### D3: `LlmClient` as an injection token + env-selected adapter

```
insights/llm/
├── llm-client.ts          # interface + DI token: generate(prompt): Promise<LlmSummaryResult>
├── llm-client.factory.ts  # env-driven provider selection, fail-fast on unknown
└── mock-llm.client.ts     # first concrete adapter (see note below)
```

**Implementation note (2026-07-10):** the real-provider decision was deferred by the user at apply time, so the first concrete adapter is a built-in `mock` provider (default `LLM_PROVIDER=mock`): no API key required, deterministic placeholder output, whole pipeline runnable end-to-end. A real provider adapter (Anthropic/OpenAI/…) is a follow-up — add one adapter file, register it in the factory, and the MVP DoD item "AI Summary is generated from recent events" is genuinely met.

The module provides `LLM_CLIENT` via a factory that reads `env.llm.provider`. An unknown/unconfigured provider fails fast at startup with a clear message. `LlmSummaryResult` is `{ summary: string; recommendedActions: string[]; model: string }` — the adapter owns turning provider output into that shape (structured output / tool use / JSON parsing is an adapter detail, deferred).

Env additions follow the existing `env.config.ts` pattern (plain `process.env`, no `@nestjs/config`): `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`.

Alternative considered: hard-code one SDK in `InsightsService` — rejected; the interface cut is exactly where the 300-machine version would need to swap providers, and it costs almost nothing now.

### D4: Failure isolation via existing `ApiError`

LLM call failures (network, auth, malformed output) are caught in `InsightsService` and rethrown as `ApiError(502, 'LLM_CALL_FAILED', …)` per api.md §4.7. No new error mechanism. `GET` endpoints never call the LLM, so they cannot 502 this way — they return the latest stored summary or `404 SUMMARY_NOT_FOUND`.

### D5: Factory-scope documents reuse the machine-scope shape

A `FACTORY` summary document is identical except `scope: "FACTORY"` and no `machineId`. `GET /summary` returns the most recent `scope: "FACTORY"` document. The Mongoose schema makes `machineId` optional and indexes `{ scope: 1, machineId: 1, createdAt: -1 }` for the two "latest summary" lookups.

### D6: Docs updated in the same change

`docs/design/api.md` gains §4.6-style sections for `GET/POST /summary`, and `ai/context/api-contract-summary.md` adds the two routes. Rationale: the api.md is the authoritative contract the frontend change will be built against; letting it lag would re-create the very gap this change closes.

## Risks / Trade-offs

- [Synchronous LLM call can be slow (seconds)] → Acceptable for MVP demo; frontend should show a loading state on the trigger button. No timeout queue — but the adapter sets a hard HTTP timeout so a hung call becomes a clean 502 rather than a hung request.
- [LLM output may not parse into `summary`/`recommendedActions`] → Adapter treats unparseable output as a failure → `502 LLM_CALL_FAILED`. Never store a malformed summary.
- [Factory-scope prompt could grow unbounded with machine count] → At 3 machines this is trivial. Cap gathered events (exact number is a deferred detail) so the interface behavior ("recent context, bounded") is already the 300-machine behavior.
- [First adapter's provider choice baked into env defaults] → Only the adapter file and factory registration are provider-specific; documented as swappable.
- [Storing summaries without freshness metadata beyond `createdAt`] → MVP accepts stale summaries on GET; regeneration is an explicit user action (POST). Revisit if/when auto-refresh lands.

## Open Questions

Deferred by explicit decision (record here; resolve during implementation or a later discussion):

1. ~~How many recent events feed the prompt per scope.~~ **Resolved at apply time, revised after the 2026-07-10 code review:** machine scope takes the 20 newest events (`SUMMARY_EVENT_LIMIT`, matching `EventsService`'s `DEFAULT_LIMIT`); factory scope samples `FACTORY_EVENTS_PER_MACHINE = 5` per machine and merges most-recent-first, so a chatty machine cannot crowd a quiet-but-WARNING machine out of the prompt. Active alerts are capped at `SUMMARY_ALERT_LIMIT = 20` (the MVP never resolves alerts, so the ACTIVE set only grows).
2. Structured-output strategy inside the adapter (native structured output vs. tool use vs. JSON-in-text parsing) — still open; becomes relevant with the first real provider adapter.
3. Frontend UX after a 502 (retry affordance, error copy) — belongs to the frontend change.
4. ~~Which real LLM provider to adapter first~~ **Resolved 2026-07-12: deferred to Phase 3 by explicit user decision (no paid API spending in Phase 1/2).** The mock provider is Phase 1's shipping configuration; the real adapter (and open question 2, structured output) land together at Phase 3 entry.
