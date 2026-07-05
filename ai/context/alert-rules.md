# Alert Rules

Alert Service derives severity from event type and payload — raw events have no `severity` field:

| Event | Condition | Alert | Severity |
|---|---|---|---|
| `TEMPERATURE_REPORTED` | over threshold | Yes | WARNING |
| `ERROR_OCCURRED` | always | Yes | CRITICAL |
| `MAINTENANCE_REQUIRED` | always | Yes | WARNING |
| `STATUS_CHANGED` | sensor failure only | Yes | WARNING |
| `PRODUCTION_COMPLETED` | never | No | — |

Full detail: `docs/design/architecture.md` §9.3.
