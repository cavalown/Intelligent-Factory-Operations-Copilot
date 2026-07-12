# Tasks: add-insights-module

## 1. Foundations

- [x] 1.1 Add `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL` to `backend/src/shared/config/env.config.ts` following the existing plain-`process.env` pattern
- [x] 1.2 Create `ai-summary.schema.ts` (`ai_summaries` collection): `summaryId`, optional `machineId`, `scope: MACHINE | FACTORY` (explicit `type: String` per the Mongoose union-type gotcha), `inputEventIds`, `summary`, `recommendedActions`, `model`, `createdAt`; index `{ scope: 1, machineId: 1, createdAt: -1 }`
- [x] 1.3 Export `EventsService` from `EventsModule` and `AlertsService` from `AlertsModule` so the insights context gatherer can consume them (design D2); added `AlertsService.listAlerts()` cross-machine read for factory scope

## 2. LLM Client

- [x] 2.1 Define `LlmClient` interface + DI token in `insights/llm/llm-client.ts` (`generateSummary(prompt) → { summary, recommendedActions, model }`)
- [x] 2.2 Implement the first concrete adapter — **built-in `mock` provider** (real-provider choice deferred by user, see design D3 implementation note); no API key, deterministic output
- [x] 2.2b Follow-up: implement a real provider adapter — **resolved by deferral (2026-07-12): user decided no paid LLM API before Phase 3**; the mock provider ships as Phase 1's AI summary (demo-appropriate one-shot trigger), and the real adapter lands at Phase 3 entry (RAG needs a real LLM anyway). The `LlmClient` interface + env switching already make that a one-file addition. See design.md Open Question 4 and docs/product/product-roadmap.md Phase 3.
- [x] 2.3 Provide `LLM_CLIENT` in `InsightsModule` via an env-driven factory; fail fast at startup on unknown `LLM_PROVIDER` naming the invalid value and supported providers

## 3. Insights Pipeline

- [x] 3.1 Implement context gathering in `InsightsService` for both scopes via `MachinesService` / `EventsService` / `AlertsService` (MACHINE: single machine state + recent events + alerts; FACTORY: all machines + recent cross-machine events + alerts), capturing `inputEventIds`
- [x] 3.2 Implement compact prompt building from gathered context (cap: `SUMMARY_EVENT_LIMIT = 20`, resolving design Open Question 1)
- [x] 3.3 Implement `generateSummary(scope, machineId?)`: gather → prompt → LLM → persist → return; wrap LLM failures in `ApiError(502, 'LLM_CALL_FAILED', …)` and persist nothing on failure
- [x] 3.4 Implement latest-summary reads for both scopes (no LLM call; `SUMMARY_NOT_FOUND` when none exists)

## 4. API Endpoints

- [x] 4.1 Implement `GET/POST /machines/:id/summary` per `docs/design/api.md` §4.6–4.7, including `MACHINE_NOT_FOUND` on unknown machine (validated before any LLM call)
- [x] 4.2 Implement `GET/POST /summary` (factory scope) with the same response shape, `scope: "FACTORY"`, no `machineId`
- [x] 4.3 Wire controller/service/schema/llm providers into `InsightsModule` following the `alerts` module pattern

## 5. Tests

- [x] 5.1 Unit-test `InsightsService`: success path per scope, LLM failure → 502 + nothing persisted, existing summary survives failed regeneration, `inputEventIds` match prompt context
- [x] 5.2 Unit-test controller/endpoint behavior: 404 `MACHINE_NOT_FOUND`, 404 `SUMMARY_NOT_FOUND`, GET never calls the LLM
- [x] 5.3 Unit-test the LLM client factory: provider selection and fail-fast on unknown provider

## 6. Documentation

- [x] 6.1 Add `GET/POST /summary` sections to `docs/design/api.md` (§4.9–4.10; §5.4 and §6 updated for FACTORY scope)
- [x] 6.2 Update `ai/context/api-contract-summary.md` endpoint list with the two factory-scope routes
- [x] 6.3 Document the new `LLM_*` env vars in `docs/deployment/docker-compose.md` §5 and pass them through in `docker-compose.yml`

## 7. Verification

- [x] 7.1 Run the full demo path against Docker Compose: simulate events → POST machine summary → GET it → POST factory summary → GET it (`mock` provider, no API key needed); verify fail-fast by starting once with an unknown `LLM_PROVIDER` (the 502 path is covered by unit tests until a real adapter exists) — verified 2026-07-10: 404 before first summary, 200 on both scopes, factory response carries no `machineId`, `MACHINE_NOT_FOUND` on M-999, startup aborts on `LLM_PROVIDER=bogus`
