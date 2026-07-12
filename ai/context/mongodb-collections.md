# MongoDB Collections

| Collection | Purpose |
|---|---|
| `machine_events` | Immutable event history |
| `machines` | Machine profiles + current state projection |
| `alerts` | Alerts derived from WARNING/CRITICAL events |
| `ai_summaries` | LLM-generated summaries (traceable to `inputEventIds`) |
| `machine_status_transitions` | Rebuildable projection of projected-status changes (written by the machines projection consumer; feeds 24h utilization) |
