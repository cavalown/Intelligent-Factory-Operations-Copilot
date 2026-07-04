# ADR-0003: Use REST over GraphQL/gRPC for the MVP API

## Status

Accepted

## Context

The API Layer (`docs/design/architecture.md` §11) has exactly one consumer for the MVP: the Vue 3 dashboard. The endpoint surface is small and fixed — seven endpoints total, listed in `docs/design/api.md` §4 — covering machine list/detail, event history, alerts, and AI summary retrieval/generation. There is no mobile client, no third-party API consumer, and no requirement for the dashboard to compose arbitrary queries across resources.

## Decision

Use REST for the MVP API. Endpoints return plain JSON resource representations, following the conventions in `docs/design/api.md` §2.

## Consequences

**Easier:**

* A small, fixed set of endpoints maps directly onto dashboard pages (`architecture.md` §7.8: Factory overview, Machine list, Machine detail, Event Center, Simulator controls, AI summary panel) — each page fetches from one or two clear URLs.
* No schema/codegen tooling (GraphQL schema, gRPC `.proto` files, client generation) needs to be introduced before the MVP can ship.
* REST is directly callable from a browser fetch call with no additional client library, keeping the Vue 3 frontend simple.

**Harder:**

* If a future dashboard view needs data assembled from several resources in one round trip (e.g. a combined dashboard summary), REST either needs a purpose-built aggregate endpoint or the frontend must make multiple requests — there's no ad hoc query composition the way GraphQL provides.
* Cursor-based pagination (`api.md` §4.3) and filtering conventions have to be designed and documented by hand per endpoint, rather than coming for free from a query language.

## Alternatives Considered

* **GraphQL** — well suited to a client that needs to shape its own queries across many related resource types, or when multiple independent frontend teams consume the same API differently. Rejected for the MVP because there is exactly one consumer with a known, small set of fixed views — GraphQL's flexibility solves a problem IFOC doesn't have yet, at the cost of schema/resolver infrastructure the MVP doesn't need.
* **gRPC** — strong fit for service-to-service calls (e.g. a future extracted Insight Service calling Machine Service), but poor fit for a browser-based dashboard client, which would need a gRPC-Web proxy layer. Revisit if/when internal service-to-service calls appear after the modular monolith is split (`architecture.md` §14.2).
