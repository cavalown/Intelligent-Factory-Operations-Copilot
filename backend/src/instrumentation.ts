// OTel bootstrap — must be the first thing `main.ts` imports, before Nest,
// Express, Mongoose, or kafkajs load: auto-instrumentation patches those
// modules at require-time, so it has to run before anything else requires
// them (openspec/changes/add-observability/design.md D1).
import 'dotenv/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { env } from './shared/config/env.config';

if (!env.otelSdkDisabled) {
  // No explicit `url` passed to any exporter below: each one resolves its
  // own endpoint from OTEL_EXPORTER_OTLP_<SIGNAL>_ENDPOINT, falling back to
  // the generic OTEL_EXPORTER_OTLP_ENDPOINT, falling back to the OTel spec's
  // own http://localhost:4318 default — the SDK's built-in resolution
  // (verified against @opentelemetry/otlp-exporter-base). Passing an
  // explicit url here would silently disable the signal-specific overrides.
  const sdk = new NodeSDK({
    serviceName: env.otelServiceName,
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
    }),
    logRecordProcessors: [
      new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() }),
    ],
    // Auto-instrumentation covers HTTP/Express, Mongoose, and kafkajs
    // (including W3C trace-context propagation through Kafka message
    // headers) and pino (trace_id/span_id log injection plus forwarding pino
    // logs into this same OTLP logs pipeline) via
    // @opentelemetry/instrumentation-pino, bundled in this package — no
    // manual spans or hand-rolled pino mixin needed (design.md D1/D2).
    instrumentations: [getNodeAutoInstrumentations()],
  });

  // Exporters already fail soft — buffer-and-drop on connection failure when
  // the `lgtm` container is absent (design.md D5) — so a broken/unreachable
  // OTLP endpoint never blocks or crashes startup.
  sdk.start();
}
