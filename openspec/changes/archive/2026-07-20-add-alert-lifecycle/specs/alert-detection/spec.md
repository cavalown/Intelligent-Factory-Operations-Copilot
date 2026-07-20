## MODIFIED Requirements

### Requirement: The status filter is validated against the alert-status domain

The system SHALL reject a `status` query value (on `GET /alerts` and `GET /machines/:id/alerts`) containing any comma-separated segment that is not a member of the alert-status set (`ACTIVE`, `ACKNOWLEDGED`, `RESOLVED`), responding `400` with error code `INVALID_QUERY_PARAMETER`, validating each segment's membership against the same constant the schema uses.

#### Scenario: Out-of-domain status rejected
- **WHEN** a client GETs `/alerts?status=foo` (or `?status=active`, wrong case)
- **THEN** the system responds `400` with error code `INVALID_QUERY_PARAMETER` instead of silently returning an empty list

#### Scenario: One invalid segment in a multi-value list rejects the whole request
- **WHEN** a client GETs `/alerts?status=ACTIVE,foo`
- **THEN** the system responds `400` with error code `INVALID_QUERY_PARAMETER`
