# Design: add-observability

## Context

Current state: Nest's default human-readable logger on stdout (14 call sites, all warnings/errors at decision points), kafkajs's own JSON logs interleaved on the same stream, zero HTTP request logging, and no runtime correlation between an API call and the consumer work it triggers. The event envelope's `correlationId` exists but never reaches any log or trace. Phase 1.1 (roadmap) commits to OpenTelemetry + Grafana stack at demo weight — the user's explicit framing: "畢竟是 demo，根本不會部署" (demo only, never deployed), and no paid services before Phase 3.

## Goals / Non-Goals

**Goals:**

- One trace spans simulator POST → Kafka publish → all three consumers (event/machine/alert), viewable in Grafana Tempo.
- Every log line is JSON; request-scoped lines carry `trace_id`; consumer lines carry the event's `correlationId` and `eventId`.
- HTTP access logging (method, path, status, duration) — a 500 is never invisible again.
- `ifoc.events.processed` counter (labels: `eventType`, consumer group) as the custom-metric pattern.
- Backend behaves identically with or without the observability container.

**Non-Goals:**

- Browser/frontend telemetry; production LGTM deployment; sampling strategy (demo keeps 100%); alerting rules; log retention policy (the lgtm container is ephemeral by design); replacing kafkajs's internal logger.

## Decisions

### D1: OTel bootstrap as a preloaded module, auto-instrumentation over manual spans

`backend/src/instrumentation.ts` initializes `NodeSDK` with `@opentelemetry/auto-instrumentations-node` and OTLP exporters, imported first in `main.ts` (before Nest/Express/Mongoose/kafkajs load, which instrumentation requires). Manual spans only where auto ones lack domain meaning (none needed initially — consumer processing is already visible via the kafkajs instrumentation). Rationale: auto-instrumentation covers HTTP/Mongoose/kafkajs including **context propagation through Kafka headers** — hand-rolling that propagation is exactly the kind of infrastructure duplication Pattern 3 of the first retrospective warns about.

### D2: Logs — pino via nestjs-pino, dual-destination (stdout JSON + OTLP)

`nestjs-pino` becomes the logger implementation behind Nest's `Logger` facade (`app.useLogger`), so **all 14 existing call sites keep working unchanged**. pino emits JSON to stdout (docker logs stay useful, 12-factor preserved) and a mixin injects the active `trace_id`/`span_id` into every line. Logs also ship via the OTel logs pipeline to Loki so Grafana can jump log↔trace. Honest note: OTel's Node log signal is the least mature of the three — if the OTLP log transport misbehaves, the fallback documented here is stdout-only JSON (Loki loses logs but nothing else degrades; traces/metrics are unaffected). HTTP access logging comes free with `pino-http` inside nestjs-pino.

### D3: One `grafana/otel-lgtm` container — the demo-weight Grafana stack

Official all-in-one image (Collector + Loki + Tempo + Prometheus + Grafana) intended exactly for dev/demo. Compose gains one `lgtm` service; Grafana UI on `:3001` (backend owns `:3000`). Ephemeral storage — restarting it wipes telemetry, which is fine for a demo and reinforces that it's not a production posture. Upgrade path if this ever matters: replace the one container with real LGTM components; the backend's `OTEL_EXPORTER_OTLP_ENDPOINT` is the entire coupling surface. Rejected alternatives: full split stack now (5 containers, 2GB+, production posture nobody needs — "根本不會部署"); hosted services (violates no-spend).

### D4: Domain identity and transport identity coexist

W3C trace context answers "which spans belong to this request"; the envelope's `correlationId` answers "which business flow is this" (it survives replay, batch scenarios, and appears in stored events). Consumers set both as span attributes (`ifoc.correlation_id`, `ifoc.event_id`, `ifoc.event_type`) and log fields. Neither replaces the other.

### D5: Fail-soft is a requirement, not a hope

OTLP exporters buffer-and-drop quietly when the endpoint is unreachable (default SDK behavior — verified in the demo checklist, not assumed, per retrospective Pattern 4 on asserted library claims). `OTEL_SDK_DISABLED=true` gives a hard off-switch. The spec has an explicit scenario: stop the lgtm container, the whole demo flow still passes.

### D6: Env vars follow the existing registry pattern

`OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://lgtm:4318` in compose, unset ⇒ exporter no-ops locally), `OTEL_SERVICE_NAME=ifoc-backend`, `OTEL_SDK_DISABLED`. All documented in `docker-compose.md` §5 (the env-var registry — Pattern 3 of the dashboard-metrics retrospective: extend the registry in the same change).

## Risks / Trade-offs

- [~1GB RAM for the lgtm container on a machine that has hit disk-full] → it's one `docker compose stop lgtm` away from off, and D5 guarantees nothing else cares.
- [Auto-instrumentation adds startup latency and per-request overhead] → negligible at demo load; sampling stays 100% deliberately (demo wants every trace).
- [OTel Node log signal maturity] → D2's documented fallback (stdout JSON only) keeps the blast radius to "Grafana loses the log pane".
- [pino swap could change log timestamps/format that tests or scripts grep] → nothing greps log output today (verified: no CI, no log-parsing scripts); `docker logs` consumers are humans.

## Open Questions

1. Grafana provisioning: ship a pre-built dashboard JSON (events-processed rate, HTTP latency) or let the demo use Tempo/Loki explore views raw? (Lean: explore views first, dashboard only if the demo script wants a money shot.)
2. Should the simulator's frontend page display the `correlationId` it generated, so a demo operator can paste it into Grafana? (Nice demo glue; decide during implementation.)
