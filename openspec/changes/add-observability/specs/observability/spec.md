# observability Specification (delta)

## ADDED Requirements

### Requirement: One trace spans a request and the consumer work it triggers
The system SHALL propagate W3C trace context from HTTP requests through Kafka message headers into every consumer, so a single trace contains the simulator POST, the Kafka publish, and each consumer's processing spans.

#### Scenario: Simulator event trace crosses Kafka
- **WHEN** a client POSTs `/simulator/events` while the observability stack is running
- **THEN** one trace exists containing the HTTP server span, the Kafka producer span, and processing spans from the event, machine, and alert consumer groups

#### Scenario: Consumer spans carry domain identity
- **WHEN** a consumer processes an event
- **THEN** its span carries the event's `correlationId`, `eventId`, and `eventType` as attributes (domain identity coexists with trace identity)

### Requirement: Logs are structured JSON with trace correlation
The system SHALL emit all backend logs as structured JSON on stdout; request-scoped lines SHALL include the active `trace_id`, and consumer-processing lines SHALL include the event's `correlationId`. Existing `Logger` call sites keep working through the Nest logger facade.

#### Scenario: Request log carries trace id
- **WHEN** any HTTP request is handled
- **THEN** an access log line is emitted (method, path, status, duration) as JSON including the request's `trace_id`

#### Scenario: A 500 is never invisible
- **WHEN** an API request results in a 5xx response
- **THEN** the access log records it and the corresponding trace marks the span as errored

### Requirement: Processed events are counted as a metric
The system SHALL increment an `ifoc.events.processed` counter, labeled by `eventType` and consumer group, each time a consumer completes processing an event.

#### Scenario: Counter reflects processing
- **WHEN** the machine projection consumer processes a `TEMPERATURE_REPORTED` event
- **THEN** the counter increases for labels (`TEMPERATURE_REPORTED`, machine consumer group), queryable in the observability stack

### Requirement: Telemetry ships via OTLP to a local demo stack, and its absence is harmless
The system SHALL export traces, metrics, and logs via OTLP to the endpoint configured by `OTEL_EXPORTER_OTLP_ENDPOINT` (the compose `lgtm` service — `grafana/otel-lgtm`), SHALL support `OTEL_SDK_DISABLED=true` as an off-switch, and SHALL start and serve all functionality identically when the observability container is absent or unreachable.

#### Scenario: Telemetry visible in Grafana
- **WHEN** the compose stack runs with the `lgtm` service and demo traffic flows
- **THEN** traces are queryable in Tempo, logs in Loki (correlated by trace id), and the events-processed metric in Prometheus, via Grafana on its dedicated port

#### Scenario: Observability container down, platform unaffected
- **WHEN** the `lgtm` container is stopped and the full demo flow is exercised
- **THEN** every API call, consumer, and frontend behavior works exactly as before, with no errors surfaced to clients and no crash-looping
