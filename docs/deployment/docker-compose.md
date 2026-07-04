# Docker Compose (Local Development)

## 1. Purpose

This document defines the Docker Compose setup that runs all of IFOC's MVP services locally: frontend, backend, MongoDB, and Kafka. This is the only deployment target for the MVP — see `docs/design/architecture.md` §13.1 (no Kubernetes, no managed cloud services in the MVP).

Kafka runs from day one of the MVP, not a later phase — it is the event backbone for the core `simulator → Kafka → consumers → MongoDB` flow described in `CLAUDE.md`, so it belongs in the same Compose file as everything else from the start.

---

## 2. Services Overview

| Service | Image | Purpose | Host Port |
| --- | --- | --- | --- |
| `frontend` | built from `frontend/` (Vue 3 + TypeScript) | Operator dashboard. | `5173` |
| `backend` | built from `backend/` (NestJS modular monolith) | REST API, Kafka consumer, Insight Service. | `3000` |
| `mongodb` | `mongo:7` | Stores `machine_events`, `machines`, `alerts`, `ai_summaries`. | `27017` |
| `kafka` | `apache/kafka:3.8.0` | Event backbone, topic `machine.events`. Runs in **KRaft mode** — no separate Zookeeper container. | `9092` |

Four services, no Zookeeper — KRaft mode was chosen specifically to keep the local MVP footprint to one container per concern (`docs/decisions/ADR-0001-use-kafka.md` covers why Kafka itself was chosen; this document only covers how it runs locally).

---

## 3. `docker-compose.yml`

```yaml
version: "3.9"

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

  backend:
    build: ./backend
    container_name: ifoc-backend
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      MONGODB_URI: mongodb://mongodb:27017/ifoc
      KAFKA_BROKERS: kafka:9092
      KAFKA_TOPIC_MACHINE_EVENTS: machine.events
      LLM_API_KEY: ${LLM_API_KEY}
    depends_on:
      - kafka
      - mongodb

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

---

## 5. Environment Variables

| Variable | Service | Description |
| --- | --- | --- |
| `MONGODB_URI` | `backend` | MongoDB connection string. |
| `KAFKA_BROKERS` | `backend` | Kafka bootstrap server address. |
| `KAFKA_TOPIC_MACHINE_EVENTS` | `backend` | Topic name, kept as a variable rather than hardcoded so `docs/design/event-schema.md` §8's naming convention can evolve without a code change. |
| `LLM_API_KEY` | `backend` | Credential for the Insight Service's LLM API calls (`architecture.md` §7.6). Not committed — supplied via a local `.env` file or shell environment. |
| `VITE_API_BASE_URL` | `frontend` | Base URL the dashboard uses to reach the backend, matching `docs/design/api.md` §2.1. |

`LLM_API_KEY` should be provided through a local `.env` file (gitignored) or the shell environment — never committed to the repository.

---

## 6. Startup

```bash
docker compose up -d
```

Expected order: `kafka` and `mongodb` start first (no dependencies), then `backend` (depends on both), then `frontend` (depends on `backend`). The backend should retry its Kafka/MongoDB connections on startup rather than crash-looping, since Compose's `depends_on` only waits for the container to start, not for Kafka/MongoDB to be ready to accept connections.

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
