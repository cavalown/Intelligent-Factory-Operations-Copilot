# Observability

## 1. Purpose

This document describes IFOC's observability subsystem — OpenTelemetry traces/metrics, `nestjs-pino` structured logs, and the `lgtm` (Grafana + Loki + Tempo + Prometheus, one container) demo stack — added in Phase 1.1 (`docs/product/product-roadmap.md`). It covers what's instrumented, how correlation works, how to read the signals in Grafana, and the environment variables that control it.

The implementation decisions and rationale live in `openspec/changes/add-observability/design.md`; this document is the lasting reference for using and reasoning about the subsystem, not the record of why it was built that way.

---

## 2. What's Instrumented

Everything is auto-instrumented via `@opentelemetry/auto-instrumentations-node`, bootstrapped in `backend/src/instrumentation.ts` — the first thing `backend/src/main.ts` imports, before Nest, Express, Mongoose, or kafkajs load (auto-instrumentation patches those modules at require-time, so it must run first).

| Signal | Source | Covers |
| --- | --- | --- |
| Traces | `instrumentation-http`, `instrumentation-express`, `instrumentation-mongoose`, `instrumentation-kafkajs`, `instrumentation-nestjs-core` | Every HTTP request, every Mongo operation, every Kafka produce/consume — including W3C trace-context propagation through Kafka message headers, so one trace spans an HTTP request, the Kafka publish, and all four consumers' processing. |
| Logs | `instrumentation-pino` (bundled in the same package) | Injects `trace_id`/`span_id`/`trace_flags` into every pino log record written while a span is active, and forwards pino log records into the OTel logs pipeline — both automatic; no manual mixin or transport was written for this. |
| Metrics | Auto-instrumentation (HTTP/Mongoose/kafkajs default metrics) + one custom counter | `ifoc.events.processed` (§4) is the only application-defined metric. |

No manual spans exist anywhere in the codebase — the auto-instrumentation set above covers every case this project needs. See `openspec/changes/add-observability/design.md` D1 for why, and `docs/retrospectives/2026-07-observability-review-lessons.md` Pattern 3 for a case where a small piece of hand-rolled plumbing (URL construction) crept back in despite this principle, and was corrected.

---

## 3. Correlation Model: Transport Identity vs. Domain Identity

Two independent identifiers travel with every event, and neither replaces the other:

- **`trace_id`/`span_id`** (W3C trace context) answer *"which spans belong to this request"* — assigned by OTel, propagated automatically through HTTP headers and Kafka message headers, present on every log line and every span.
- **`correlationId`** (the event envelope field, `docs/design/event-schema.md` §3) answers *"which business flow is this"* — assigned by the producer, stored with the event, and survives replay/redelivery in a way a trace ID doesn't (a redelivered message gets a *new* trace, but the *same* `correlationId`).

Each of the four Kafka consumers' processing spans carries `ifoc.correlation_id`, `ifoc.event_id`, and `ifoc.event_type` as span attributes (set once, in `KafkaConsumerBase`, shared by all four consumer subclasses — not duplicated per subclass). This is what makes it possible to search Tempo by `correlationId` and land on the exact trace a specific business event produced, even though the trace's own ID was never exposed to the event producer.

---

## 4. The `ifoc.events.processed` Counter

Labels: `eventType` (the event's `eventType` field) and `consumerGroup` (`event-service-group` / `machine-service-group` / `alert-service-group` / `rules-service-group`).

**Semantics:** incremented once per consumer group, only when that consumer's `handleMessage` caused a real effect — a new document, an updated projection, a new alert. It is **not** incremented for a deliberate no-op: an unrecognized `eventType`, a redelivered/duplicate `eventId`, an event for an unknown `machineId`, or (for the alert consumer specifically) an event that doesn't warrant an alert. `handleMessage`'s abstract signature returns `Promise<boolean>` for exactly this reason — `true` only on genuine effect — after an earlier version of this metric miscounted all of the above as "processed" (see `docs/retrospectives/2026-07-observability-review-lessons.md` Pattern 2 for the full story and why it's a trap worth naming).

Practically: all four consumer groups eventually process every message (each has its own independent subscription — `ai/rules/kafka-consumer-conventions.md`; `machine-service-group` and `alert-service-group` see it one hop later, via `rules-service-group`'s republish), so one event can legitimately increment 0 to 4 of the four group counters depending on what each consumer actually did with it. `rules-service-group` increments whenever it actually classified the event — it does *not* increment for the two "can't classify" no-ops `ai/rules/observability-conventions.md` names (an unknown `machineId`, a non-finite temperature), matching how the other three consumers treat those exact cases; a message still gets republished either way (downstream needs it unclassified rather than dropped), but the counter reflects classification, not just republishing. A `TEMPERATURE_REPORTED` event above threshold for a known machine increments all four (classified+republished, stored, projected, alerted); the same event type below threshold increments three (classified+republished, stored, projected — no alert); the same event type for an unknown machine increments only two (stored, projected — `rules-service-group` and `alert-service-group` both treat it as a no-op).

`rules-service-group` has no persistence of its own (`ai/rules/module-boundaries.md` — it's an enrichment consumer, not a projection), so unlike the other three consumer groups it cannot detect a redelivered/duplicate `eventId` and skip re-counting it — a crash between publishing the enriched event and committing the source offset (an accepted, documented possibility per `add-rule-engine/design.md`'s Risks section) will republish and re-count that event a second time. This is a deliberate, scoped exception to this section's general "false for every no-op, including idempotent duplicates" semantics, not an oversight.

---

## 5. Fail-Soft Behavior

The platform must behave identically whether or not the `lgtm` container is present, reachable, or running (`design.md` D5). Concretely:

- OTLP exporters (traces, metrics, logs) buffer-and-drop on export failure — a broken or absent collector produces no client-visible error, no crash, no blocked request.
- `docker-compose.yml`'s `backend` service does **not** `depends_on` `lgtm` — a failed/slow `lgtm` image pull can never block `backend` from starting (see `docs/retrospectives/2026-07-observability-review-lessons.md` Pattern 4 for why this specific line was deliberately *not* added).
- `OTEL_SDK_DISABLED=true` is a hard off-switch, checked explicitly in `instrumentation.ts` before the SDK is even constructed.

---

## 6. Environment Variables

See `docs/deployment/docker-compose.md` §5 for the full registry. The two that matter for this subsystem specifically:

- `OTEL_SERVICE_NAME` (default `ifoc-backend`) — read explicitly in `env.config.ts` and passed as `serviceName`, because the OTel SDK doesn't auto-detect this one from the environment the way it does the endpoint.
- `OTEL_EXPORTER_OTLP_ENDPOINT` — deliberately **not** read through `env.config.ts`. Each OTLP exporter resolves it (and any signal-specific override, e.g. `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`) directly from `process.env` per the OTel spec's own fallback chain. An earlier version of `instrumentation.ts` built exporter URLs by hand from a single `env.config.ts`-sourced value, which silently defeated signal-specific overrides — see `docs/retrospectives/2026-07-observability-review-lessons.md` Pattern 3.

---

## 7. Viewing It in Grafana

`docker compose up -d` starts `lgtm` alongside everything else. Grafana is at **http://localhost:3001** (the backend already owns host port `:3000`).

**Traces (Tempo):** Explore → Tempo. Search by tag — `ifoc.correlation_id=<value>` finds the exact trace a business event produced, without ever having seen its `trace_id`. Or paste a `trace_id` directly if you have one from a log line.

**Logs (Loki):** Explore → Loki. `{service_name="ifoc-backend"}` for everything; add `| trace_id="<value>"` to jump straight to the log lines for one request. Every log record carries `trace_id`/`span_id` as structured metadata (not just in the message body) once it's inside an active span.

**Metrics (Prometheus):** Explore → Prometheus. `ifoc_events_processed_total` (OTel's `ifoc.events.processed` becomes this name under Prometheus's naming convention — dots become underscores, counters get a `_total` suffix).

**Jumping between them:** a Loki log line with a `trace_id` has a "Trace: ..." derived-field link straight into the matching Tempo trace — that link is what `docs/deployment/docker-compose.md`'s Loki datasource provisioning (`derivedFields`) sets up.

---

## 8. Worked Example

*Captured before `openspec/changes/add-rule-engine`. The correlation/log/metric mechanics below are unchanged, but the topology has an added hop: `machine-service-group` and `alert-service-group` now consume `machine.events.enriched`, republished by a fourth consumer group, `rules-service-group`, which consumes the raw `machine.events` trace shown here — see `docs/design/event-schema.md` §3.3.*

A real `POST /simulator/events` for a `TEMPERATURE_REPORTED` event at 88°C (above `M-001`'s 80°C threshold), `correlationId: "corr_demo_show_..."`:

**The access log** (`docker logs ifoc-backend`, and the same record in Loki):
```json
{
  "level": 30,
  "req": { "method": "POST", "url": "/api/simulator/events" },
  "trace_id": "0c99c2f55e0cb22d9006f3858891c88d",
  "span_id": "3277f07b44342ca4",
  "trace_flags": "01",
  "res": { "statusCode": 202 },
  "responseTime": 35,
  "msg": "request completed"
}
```

**The Tempo trace** (found by searching `ifoc.correlation_id=corr_demo_show_...`, same `trace_id` as above), abbreviated to the spans that matter:
```text
POST /api/simulator/events
  mongodb.find / mongoose.Machine.findOne   (threshold lookup)
  send machine.events                        (Kafka producer)
  process machine.events  ← ifoc.correlation_id=corr_demo_show_...   (event-service-group: stores history)
  process machine.events  ← ifoc.correlation_id=corr_demo_show_...   (machine-service-group: updates projection)
  process machine.events  ← ifoc.correlation_id=corr_demo_show_...   (alert-service-group: creates the alert)
  mongoose.MachineEvent.save
  mongoose.Machine.save
  mongoose.Alert.save
```

**The metric** (`ifoc_events_processed_total`, filtered to this backend instance), before and after this one event:
```text
event-service-group    3 → 4
machine-service-group  3 → 4
alert-service-group    1 → 2   (this event crossed the threshold — an alert was created)
```

Contrast: the same event type at a temperature *below* threshold increments `event-service-group` and `machine-service-group` but **not** `alert-service-group` (§4) — `resolveAlert` returns null, `handleMessage` returns `false`, no attribute/counter fires.

---

## 9. Where the Rules Live

| Concern | Source |
| --- | --- |
| Why these design choices (auto-instrumentation, pino wiring, the `lgtm` container, fail-soft) | `openspec/changes/add-observability/design.md` |
| Compose service definition, env var registry | `docs/deployment/docker-compose.md` §3, §5 |
| Kafka consumer group conventions | `ai/rules/kafka-consumer-conventions.md` |
| Event envelope fields (`correlationId`, `eventId`, `eventType`) | `docs/design/event-schema.md` §3 |
| Mistakes made building this subsystem, and why | `docs/retrospectives/2026-07-observability-review-lessons.md` |
