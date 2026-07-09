# Proposal: add-insights-module

## Why

The insights module is the last unimplemented backend capability in the MVP: `backend/src/insights/insights.module.ts` is an empty shell, yet the MVP's Dashboard (AI Summary Card) and Machine Detail page (AI Summary) both depend on it. Completing it now unblocks frontend work — the frontend can then be built against real endpoints with no mocking. Exploration on 2026-07-10 also surfaced a contract gap: the Dashboard's AI Summary Card is factory-level, but `docs/design/api.md` only defines per-machine summary endpoints.

## What Changes

- Implement the existing API contract: `GET /machines/:id/summary` and `POST /machines/:id/summary` (`docs/design/api.md` §4.6–4.7). POST calls the LLM synchronously (no job queue in MVP); upstream LLM failure returns `502 LLM_CALL_FAILED` and stays isolated from dashboard availability.
- Add factory-scope endpoints `GET /summary` and `POST /summary` for the Dashboard's AI Summary Card. `ai_summaries.scope` supports `MACHINE | FACTORY`.
- Both scopes share one pipeline — gather context → build compact prompt → call LLM → persist to `ai_summaries` (traceable via `inputEventIds`) → return `summary` + `recommendedActions[]`. Only the context gatherer differs (machine: single machine's recent events + state + alerts; factory: all machines' state + recent cross-machine events + alerts).
- LLM provider is not hard-coded: a thin `LlmClient` interface selected via env (`LLM_PROVIDER` / `LLM_API_KEY` / `LLM_MODEL`), with one concrete adapter in the first version.
- Module structure follows the existing `alerts` module pattern (controller / service / schemas, plus an `llm/` subdirectory).
- Update `docs/design/api.md` and `ai/context/api-contract-summary.md` to add the factory-scope endpoints.

Deliberately deferred (record only, decide during implementation or later): how many events feed the prompt, structured-output strategy, frontend retry UX after a 502.

## Capabilities

### New Capabilities

- `ai-summary`: Generating, persisting, and serving LLM operational summaries — per-machine and factory scope — including context gathering, provider-agnostic LLM client, traceability to input events, and failure isolation.

### Modified Capabilities

None — existing capabilities (`alert-detection`, `event-history`, `machine-event-ingestion`, `machine-state-projection`, `kafka-consumer-resilience`) are read as inputs but their requirements do not change.

## Impact

- **Code**: `backend/src/insights/**` (new controller, service, context gatherers, `llm/` client + adapter, `schemas/ai-summary.schema.ts`); `backend/src/shared/config/env.config.ts` (new `LLM_*` vars); `backend/src/app.module.ts` unchanged (InsightsModule already imported) — verify wiring.
- **API**: two new routes (`GET/POST /summary`) in addition to the two contracted per-machine routes; new error code `LLM_CALL_FAILED` (502) and `SUMMARY_NOT_FOUND` (404).
- **Database**: new `ai_summaries` collection (already listed in `ai/context/mongodb-collections.md`).
- **Docs**: `docs/design/api.md`, `ai/context/api-contract-summary.md` gain the factory-scope endpoints.
- **Dependencies**: one LLM provider SDK (or plain HTTP client) for the first adapter; new env vars `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`.
- **Sequencing**: frontend MVP work starts after this change completes.
