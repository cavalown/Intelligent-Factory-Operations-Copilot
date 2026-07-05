# Machine State Rules

When consumers process events, they apply these projection rules:

| Event | Machine Status | Health Score |
|---|---|---|
| `TEMPERATURE_REPORTED` (high) | WARNING | −10 |
| `ERROR_OCCURRED` | ERROR | −30 |
| `MAINTENANCE_REQUIRED` | MAINTENANCE | −20 |
| `STATUS_CHANGED` (sensor failure) | WARNING | −15 |
| `PRODUCTION_COMPLETED` | RUNNING | +2 |

Full detail, including severity precedence and bounds: `docs/design/machine-schema.md`.
