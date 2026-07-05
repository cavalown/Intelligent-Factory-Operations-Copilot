# Kafka Consumer Conventions

Each module that consumes `machine.events` uses its own Kafka consumer group ID (`<module>-service-group`), never a shared group. Sharing a group would load-balance messages across consumers instead of fanning them out to all of them — that would break the "independent projections from the same event" design that `docs/design/architecture.md` §9 depends on.

Idempotency guards follow what's already decided per module (see `docs/design/machine-schema.md` §8 and the relevant `openspec/changes/*/design.md`). Don't add new ad hoc dedup mechanisms without documenting them first.
