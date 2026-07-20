# Docker Compose (Local Development)

## 1. Purpose

This document defines the Docker Compose setup that runs all of IFOC's MVP services locally: frontend, backend, MongoDB, Kafka, and the `lgtm` observability stack (Phase 1.1). This is the only deployment target for the MVP — see `docs/design/architecture.md` §13.1 (no Kubernetes, no managed cloud services in the MVP).

Kafka runs from day one of the MVP, not a later phase — it is the event backbone for the core `simulator → Kafka → consumers → MongoDB` flow described in `CLAUDE.md`, so it belongs in the same Compose file as everything else from the start.

Topology diagram source: [`docs/assets/mermaid/deployment-topology.mmd`](../assets/mermaid/deployment-topology.mmd).

---

## 2. Services Overview

| Service | Image | Purpose | Host Port |
| --- | --- | --- | --- |
| `frontend` | built from `frontend/` (Vue 3 + TypeScript) | Operator dashboard. | `5173` |
| `backend` | built from `backend/` (NestJS modular monolith) | REST API, Kafka consumer, Insight Service. | `3000` |
| `mongodb` | `mongo:7` | Stores `machine_events`, `machines`, `alerts`, `ai_summaries`. | `27017` |
| `kafka` | `apache/kafka:3.8.0` | Event backbone, topic `machine.events`. Runs in **KRaft mode** — no separate Zookeeper container. | `9092` |
| `lgtm` | `grafana/otel-lgtm:latest` | Demo-weight observability stack (Collector + Loki + Tempo + Prometheus + Grafana in one container) — see `docs/product/product-roadmap.md` Phase 1.1. Ephemeral storage; the platform runs identically with this container absent or stopped. | `3001` (Grafana UI), `4318` (OTLP HTTP) |

Five services, no Zookeeper — KRaft mode was chosen specifically to keep the local MVP footprint to one container per concern (`docs/decisions/ADR-0001-use-kafka.md` covers why Kafka itself was chosen; this document only covers how it runs locally).

---

## 3. `docker-compose.yml`

```yaml
services:
  kafka:
    image: apache/kafka:3.8.0
    container_name: ifoc-kafka
    ports:
      - "9092:9092"
      - "9093:9093"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,PLAINTEXT_HOST://0.0.0.0:9093,CONTROLLER://0.0.0.0:9094
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:9093
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka:9094
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
    volumes:
      - kafka_data:/var/lib/kafka/data

  mongodb:
    image: mongo:7
    container_name: ifoc-mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  lgtm:
    image: grafana/otel-lgtm:latest
    container_name: ifoc-lgtm
    ports:
      - "3001:3000" # Grafana UI (backend already owns host :3000)
      - "4318:4318" # OTLP HTTP receiver

  backend:
    build: ./backend
    container_name: ifoc-backend
    restart: on-failure
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      MONGODB_URI: mongodb://mongodb:27017/ifoc
      KAFKA_BROKERS: kafka:9092
      KAFKA_TOPIC_MACHINE_EVENTS: machine.events
      KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED: machine.events.enriched
      LLM_PROVIDER: ${LLM_PROVIDER:-mock}
      LLM_API_KEY: ${LLM_API_KEY:-}
      LLM_MODEL: ${LLM_MODEL:-}
      OTEL_SERVICE_NAME: ifoc-backend
      OTEL_EXPORTER_OTLP_ENDPOINT: http://lgtm:4318
      OTEL_SDK_DISABLED: ${OTEL_SDK_DISABLED:-false}
    depends_on:
      - kafka
      - mongodb
      # lgtm deliberately excluded: backend doesn't need it ready at any
      # point (OTLP export is fail-soft regardless of start order — design.md
      # D5), and depends_on would otherwise block backend's own startup if
      # the lgtm image fails to pull (e.g. offline, registry rate limiting).

  frontend:
    build: ./frontend
    container_name: ifoc-frontend
    ports:
      - "5173:5173"
    environment:
      VITE_API_BASE_URL: http://localhost:3000/api
    depends_on:
      - backend

volumes:
  kafka_data:
  mongo_data:
```

---

## 4. Kafka Configuration Notes

* **KRaft combined mode**: `kafka` acts as both broker and controller (`KAFKA_PROCESS_ROLES: broker,controller`) in a single container — appropriate for a one-node local dev cluster, not a production topology.
* **Topic auto-creation**: `KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"` means `machine.events` is created automatically the first time a producer publishes to it. No init container or manual topic-creation step is required for the MVP.
* **Partitions**: an auto-created topic gets the broker's default partition count (1, unless overridden). One partition is sufficient for MVP event volume and trivially preserves ordering. Keying messages by `machineId` (`event-schema.md` §8) is still correct practice even with one partition — if partition count increases later for throughput, per-machine ordering is preserved automatically without any producer/consumer code change.
* **Internal vs. host addressing (dual listeners)**: Kafka exposes two separate listeners on purpose. `PLAINTEXT` (`kafka:9092`, advertised as `kafka:9092`) is for container-to-container traffic — this is what the containerized `backend` service uses. `PLAINTEXT_HOST` (`localhost:9093`, advertised as `localhost:9093`) is for anything connecting from the host machine — a local Kafka CLI, or a `backend` process run natively instead of in Docker (see `docs/deployment/local-development.md`). A single listener does not work for both cases: after the initial connection, a Kafka client reconnects using whatever address the broker *advertises*, and a host process cannot resolve the Docker-internal hostname `kafka`.
* **Known cold-start race**: on a fresh `docker compose up --build backend`, all 4 of the backend's independent consumer groups (`event-service-group`, `machine-service-group`, `alert-service-group`, `rules-service-group`) request the group coordinator from the single-broker cluster at once. This has been observed to occasionally throw an unretried `KafkaJSProtocolError` that crashes the backend process on its very first boot. `restart: on-failure` on the `backend` service (added in the Compose file above) recovers automatically — the retry always succeeds once the broker's coordinator metadata has settled. This is a single-broker-dev-cluster quirk, not an application bug.

---

## 5. Environment Variables

| Variable | Service | Description |
| --- | --- | --- |
| `MONGODB_URI` | `backend` | MongoDB connection string. |
| `KAFKA_BROKERS` | `backend` | Kafka bootstrap server address. |
| `KAFKA_TOPIC_MACHINE_EVENTS` | `backend` | Topic name, kept as a variable rather than hardcoded so `docs/design/event-schema.md` §8's naming convention can evolve without a code change. |
| `KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED` | `backend` | Topic the Rule Engine republishes classified events to; Machine Service and Alert Service consume this instead of `KAFKA_TOPIC_MACHINE_EVENTS` (`openspec/changes/add-rule-engine/design.md` D1). Defaults to `machine.events.enriched`, auto-created the same way as the raw topic. |
| `LLM_PROVIDER` | `backend` | Which Insight Service LLM adapter to use. Defaults to `mock` (built-in, no API key needed) so local dev and the demo run without external credentials; an unknown value fails startup fast. |
| `LLM_API_KEY` | `backend` | Credential for the Insight Service's LLM API calls (`architecture.md` §7.6). Not committed — supplied via a local `.env` file or shell environment. Unused by the `mock` provider. |
| `LLM_MODEL` | `backend` | Model identifier passed to the configured LLM provider. Unused by the `mock` provider. |
| `OTEL_SERVICE_NAME` | `backend` | Service name attached to all emitted traces/metrics/logs (`backend/src/instrumentation.ts`). Defaults to `ifoc-backend`. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `backend` | Base URL the OTel SDK ships traces/metrics/logs to via OTLP/HTTP. Defaults to `http://localhost:4318` (the OTel spec default); set to `http://lgtm:4318` in Compose. Unreachable is harmless — exporters buffer-and-drop (Phase 1.1, `openspec/changes/add-observability/design.md` D5). |
| `OTEL_SDK_DISABLED` | `backend` | `true` fully disables the OTel SDK (no traces/metrics/logs export, no auto-instrumentation). Defaults to `false`. |
| `VITE_API_BASE_URL` | `frontend` | Base URL the dashboard uses to reach the backend, matching `docs/design/api.md` §2.1. |

`LLM_API_KEY` should be provided through a local `.env` file (gitignored) or the shell environment — never committed to the repository.

---

## 6. Startup

```bash
docker compose up -d
```

Expected order: `kafka` and `mongodb` start first (no dependencies), then `backend` (depends on both), then `frontend` (depends on `backend`). The backend should retry its Kafka/MongoDB connections on startup rather than crash-looping, since Compose's `depends_on` only waits for the container to start, not for Kafka/MongoDB to be ready to accept connections. `lgtm` starts independently, with no dependency relationship to `backend` in either direction — deliberately: the backend never waits on it to start (so a failed/slow `lgtm` image pull can never block `backend` from coming up) and serves normally whether `lgtm` is present, absent, stopped, or removed, per `add-observability/design.md` D5.

To reset all local data (events, projections, Kafka log):

```bash
docker compose down -v
```

---

## 7. Open Assumptions

1. **Kafka image**: `apache/kafka:3.8.0`, the official Apache Kafka image with built-in KRaft support. An equivalent Bitnami or Confluent image would also work with different environment variable names — this choice hasn't been validated against team familiarity or licensing preferences.
2. **Single Kafka partition** for `machine.events` (see §4). Fine for demo-scale event volume; revisit if local load testing shows a need for more producer/consumer parallelism.
3. **`LLM_API_KEY`** is a generic placeholder name. The actual LLM provider (and therefore the real environment variable name/shape, e.g. an OpenAI-style key vs. an Anthropic-style key) has not been decided yet — `architecture.md` and `mvp.md` specify "LLM API" without naming a vendor.

If any of these change, only this document needs updating — they don't affect the event schema, API contract, or machine schema already written.
