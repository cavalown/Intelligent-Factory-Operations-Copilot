# Tasks: add-observability

## 1. OTel bootstrap

- [ ] 1.1 Add OTel dependencies (`@opentelemetry/sdk-node`, `auto-instrumentations-node`, OTLP exporters) and `backend/src/instrumentation.ts` (NodeSDK init, service name, OTLP endpoint from env, `OTEL_SDK_DISABLED` respected), imported first in `main.ts`
- [ ] 1.2 Env: `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_SERVICE_NAME` / `OTEL_SDK_DISABLED` in `env.config.ts` following the plain-`process.env` pattern
- [ ] 1.3 Verify (not assume — retrospective Pattern 4) exporter fail-soft: backend starts cleanly with no collector reachable and with `OTEL_SDK_DISABLED=true`

## 2. Structured logging

- [ ] 2.1 Wire `nestjs-pino` as the Nest logger (`app.useLogger`); JSON to stdout; confirm all 14 existing `Logger` call sites still emit
- [ ] 2.2 Inject `trace_id`/`span_id` into every log line via pino mixin; ship logs through the OTel logs pipeline to Loki (documented fallback: stdout-only JSON if the Node log signal misbehaves)
- [ ] 2.3 HTTP access logging via nestjs-pino's request logging (method, path, status, duration); confirm a forced 5xx appears in both access log and an errored trace span

## 3. Domain correlation + metric

- [ ] 3.1 Add `ifoc.correlation_id` / `ifoc.event_id` / `ifoc.event_type` span attributes and log fields in the three consumers' message handling
- [ ] 3.2 Add the `ifoc.events.processed` counter (labels: eventType, consumer group) incremented on successful processing in each consumer

## 4. Compose + docs

- [ ] 4.1 Add the `lgtm` service (`grafana/otel-lgtm`) to docker-compose.yml — Grafana on `:3001`, OTLP `:4318`; backend gets `OTEL_EXPORTER_OTLP_ENDPOINT=http://lgtm:4318`
- [ ] 4.2 Update `docs/deployment/docker-compose.md`: service table (§2) + all `OTEL_*` env vars in the §5 registry
- [ ] 4.3 Registry sweep (retrospective Pattern 3): confirm no other enumerated doc needs the new member (no new module, no new collection, no new error code, no API change)

## 5. Verification

- [ ] 5.1 Demo flow with the stack up: simulator POST → one trace spanning HTTP + producer + three consumers in Tempo, with correlationId attributes; access logs with trace_id in Loki; events-processed metric in Prometheus — all via Grafana
- [ ] 5.2 Demo flow with `lgtm` stopped: full API + frontend behavior identical, no client-visible errors, backend logs still readable JSON via `docker logs`
