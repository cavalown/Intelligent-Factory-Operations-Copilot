# Key Design Rules

1. **Events are immutable.** `machine_events` is append-only. Never mutate stored events.
2. **Severity is a consumer interpretation, not a raw event field.** The raw event envelope has no `severity` field — Alert Service applies rules to decide whether to create an alert.
3. **AI explains data, it does not replace it.** Insight Service reads from Event/Machine/Alert collections; it is not the source of truth.
4. **Use `eventId` for idempotency.** Consumers must guard against duplicate event processing.
5. **`machineId` as Kafka message key** preserves per-machine event ordering within a partition.
