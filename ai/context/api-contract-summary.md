# REST API Contract (Summary)

```
GET  /machines
GET  /machines/:id
GET  /machines/:id/events
GET  /machines/:id/alerts
GET  /machines/:id/summary
POST /machines/:id/summary    # triggers LLM call
GET  /summary                 # factory-scope AI summary (Dashboard card)
POST /summary                 # triggers factory-scope LLM call
POST /simulator/events        # publishes event to Kafka
```

Full API contract: `docs/design/api.md`.
