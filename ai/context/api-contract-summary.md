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
GET  /dashboard/stats         # machine counts by status, production, avg health, last-24h aggregates
GET  /machines/:id/utilization # rolling-24h operating/stopped/idle durations
GET  /alerts                  # cross-machine alerts (Dashboard Active Alerts widget)
POST /simulator/events        # publishes event to Kafka
```

Full API contract: `docs/design/api.md`.
