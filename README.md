# Intelligent Factory Operations Copilot 智慧製造營運助理系統

A production-style system that combines event-driven architecture, rule-based anomaly detection, RAG, and workflow automation to help engineers investigate manufacturing incidents.

[繁體中文版](README.zh-TW.md)

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Vue 3, TypeScript |
| Backend | NestJS (modular monolith) |
| Messaging | Kafka (topic: `machine.events`, key: `machineId`) |
| Database | MongoDB |
| AI | LLM API (direct summaries; RAG planned) |
| Observability | OpenTelemetry → Grafana LGTM stack |
| Local Runtime | Docker Compose |

## Quick Start

```bash
docker compose up
```

| Service | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000/api |
| Grafana (observability) | http://localhost:3001 |

See [`docs/deployment/docker-compose.md`](docs/deployment/docker-compose.md) for service details and environment variables, or [`docs/deployment/local-development.md`](docs/deployment/local-development.md) to run services outside Docker.

## Project Structure

| Path | Contents |
| --- | --- |
| [`backend/`](backend/) | NestJS API — event consumers, machine/alert projections, AI insight service |
| [`frontend/`](frontend/) | Vue 3 dashboard |
| [`docs/`](docs/README.md) | Product, design, and deployment documentation |
| [`ai/`](ai/README.md) | Project context, rules, and workflows for AI coding assistants |
| [`openspec/`](openspec) | Spec-driven change proposals |

## Documentation

Start at [`docs/README.md`](docs/README.md) — the full documentation index, with a suggested reading order. Highlights:

* [`docs/product/mvp.md`](docs/product/mvp.md) — what the MVP does and why
* [`docs/design/architecture.md`](docs/design/architecture.md) — system architecture
* [`docs/product/product-roadmap.md`](docs/product/product-roadmap.md) — long-term roadmap

## License

No license file yet — all rights reserved by default.
