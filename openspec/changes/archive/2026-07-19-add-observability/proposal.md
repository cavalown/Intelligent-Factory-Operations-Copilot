# Proposal: add-observability

## Why

The platform's own runtime behavior is invisible: HTTP requests (including 500s) leave no trace, the 14 existing log call sites emit unstructured text mixed with kafkajs's JSON on the same stdout, and nothing correlates an API request to the Kafka consumer work it triggers — even though the event envelope has carried a `correlationId` since day one. Decided 2026-07-12 (exploration): adopt OpenTelemetry + the Grafana observability stack as **Phase 1.1** of the roadmap — substantial enough to be its own sub-phase, foundational enough not to wait for Phase 2. Deliberately demo-weight: this project does not deploy to production.

## What Changes

- **Backend OpenTelemetry instrumentation**: `@opentelemetry/auto-instrumentations-node` bootstrapped before Nest — automatic traces and metrics for HTTP/Express, Mongoose, and kafkajs (W3C trace context propagates through Kafka message headers, so one trace spans simulator POST → publish → all three consumers).
- **Structured JSON logging with trace correlation**: `nestjs-pino` replaces the default Nest logger transport (existing `Logger` call sites keep working via `app.useLogger`); every request-scoped line carries `trace_id`/`span_id`; HTTP access logging comes with it — closing the "500 with no trace" hole twice over.
- **Domain correlation**: the event envelope's `correlationId` becomes a span attribute and log field in all three consumers (domain identity and transport identity coexist).
- **One custom metric** as the pattern-setter: `ifoc.events.processed` counter labeled by `eventType` and consumer group.
- **One new compose service**: `grafana/otel-lgtm` (Collector + Loki + Tempo + Prometheus + Grafana in a single container, official demo/dev image). Backend ships telemetry via OTLP; Grafana at `:3001`.
- **Graceful degradation**: the backend starts and runs identically when the lgtm container is absent (exporter failures are quiet; `OTEL_SDK_DISABLED=true` supported).
- Docs: `docker-compose.md` (service + `OTEL_*` env vars registry), roadmap already updated with Phase 1.1.

Out of scope: frontend/browser telemetry; production-shape LGTM stack (the OTLP endpoint is the stable interface — swapping the demo container for real components later touches zero application code); paid/hosted observability services; alerting on telemetry.

## Capabilities

### New Capabilities

- `observability`: end-to-end tracing across HTTP and Kafka, structured trace-correlated logging, the events-processed metric, OTLP shipping to the local stack, and fail-soft behavior without it.

### Modified Capabilities

None — no existing capability's requirements change; instrumentation is additive infrastructure.

## Impact

- **Code**: backend `instrumentation.ts` (OTel bootstrap, loaded before Nest), `main.ts` (pino logger wiring), consumer classes (correlationId attribute + counter), `env.config.ts` additions.
- **Dependencies**: OTel SDK packages, `nestjs-pino`/`pino` (all open-source; no spend).
- **Infra**: one new compose service (`lgtm`), ~1GB RAM when running; optional (profile or just `docker compose up` includes it).
- **Docs**: `docs/deployment/docker-compose.md` (service table §2, env vars §5), `docs/product/product-roadmap.md` + `ai/context/roadmap-summary.md` (Phase 1.1 — already applied with this proposal).
- **No API contract changes**; no frontend changes.
