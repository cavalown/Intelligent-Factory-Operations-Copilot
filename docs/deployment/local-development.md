# Local Development (Outside Full Docker Compose)

## 1. Purpose

`docs/deployment/docker-compose.md` runs all four MVP services in containers — good for a clean demo, but slow to iterate on: every backend or frontend code change requires a rebuild.

This document covers the **hybrid workflow**: infrastructure (`kafka`, `mongodb`) stays in Docker, while `backend` and `frontend` run natively on the host with hot reload. This is the expected day-to-day development setup once `backend/` and `frontend/` exist as real projects.

---

## 2. Prerequisites

* Docker Desktop (or equivalent) running, for the `kafka` and `mongodb` containers.
* Node.js (version to be pinned once `backend/package.json` / `frontend/package.json` exist — see §5 Open Assumptions).
* npm (or the package manager the project settles on).

---

## 3. Step 1 — Start Infrastructure Only

Start just `kafka` and `mongodb` from the existing Compose file, skipping `backend` and `frontend`:

```bash
docker compose up -d kafka mongodb
```

Both are reachable from the host:

* MongoDB: `localhost:27017`
* Kafka: `localhost:9093` — the `PLAINTEXT_HOST` listener defined in `docker-compose.md` §3, not `9092`. Port `9092` is the container-to-container listener and is not reachable correctly from a host process (see `docker-compose.md` §4).

---

## 4. Step 2 — Run Backend and Frontend Natively

### Backend

```bash
cd backend
npm install
npm run start:dev
```

Environment variables point at the host-exposed ports instead of Docker network hostnames:

```text
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ifoc
KAFKA_BROKERS=localhost:9093
KAFKA_TOPIC_MACHINE_EVENTS=machine.events
KAFKA_TOPIC_MACHINE_EVENTS_ENRICHED=machine.events.enriched
LLM_API_KEY=<your key>
```

This is the same variable set as `docker-compose.md` §5, with `mongodb`/`kafka` (Docker network hostnames) swapped for `localhost` and the appropriate host ports.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

```text
VITE_API_BASE_URL=http://localhost:3000/api
```

Identical to the containerized setup — the frontend always talks to the backend over `localhost:3000`, whether the backend is containerized or native, since `docker-compose.md`'s `backend` service also publishes port `3000` to the host.

---

## 5. Comparison with Full Docker Compose

| | Full Docker Compose | Hybrid (this document) |
| --- | --- | --- |
| `kafka`, `mongodb` | Container | Container (same as full setup) |
| `backend`, `frontend` | Container, rebuild to see changes | Native process, hot reload |
| Kafka address used by backend | `kafka:9092` | `localhost:9093` |
| MongoDB address used by backend | `mongodb:27017` | `localhost:27017` |
| Best for | Demos, confirming the containerized build works | Day-to-day development |

---

## 6. Open Assumptions

1. **Node.js version** is not yet pinned anywhere in the repo (no `.nvmrc` or `engines` field exists yet, since `backend/` and `frontend/` don't exist). Pin this once the projects are scaffolded.
2. This document assumes `backend`'s `start:dev` script and `frontend`'s `dev` script exist and read configuration from environment variables (not a hardcoded config file) — standard for NestJS/Vite, but worth confirming once those projects are scaffolded.
