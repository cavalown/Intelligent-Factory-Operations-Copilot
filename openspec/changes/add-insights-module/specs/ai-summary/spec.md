# ai-summary Specification (delta)

## ADDED Requirements

### Requirement: Generate a machine-scope AI summary on demand
The system SHALL, on `POST /machines/:id/summary`, synchronously gather the machine's current state, its recent events, and its alerts, call the configured LLM, persist the result to `ai_summaries` with `scope: "MACHINE"`, and return the new summary in the response, per `docs/design/api.md` §4.7.

#### Scenario: Successful machine summary generation
- **WHEN** a client POSTs `/machines/M-001/summary` and the LLM call succeeds
- **THEN** a document is stored in `ai_summaries` with `machineId: "M-001"`, `scope: "MACHINE"`, non-empty `summary`, `recommendedActions` array, `model`, `inputEventIds`, and `createdAt`, and the response body is that summary

#### Scenario: Unknown machine returns 404
- **WHEN** a client POSTs `/machines/:id/summary` for a `machineId` that does not exist
- **THEN** the system responds `404` with error code `MACHINE_NOT_FOUND` and does not call the LLM

### Requirement: Generate a factory-scope AI summary on demand
The system SHALL, on `POST /summary`, synchronously gather all machines' current state, recent cross-machine events, and alerts, call the configured LLM, persist the result to `ai_summaries` with `scope: "FACTORY"` and no `machineId`, and return the new summary in the response.

#### Scenario: Successful factory summary generation
- **WHEN** a client POSTs `/summary` and the LLM call succeeds
- **THEN** a document is stored in `ai_summaries` with `scope: "FACTORY"`, no `machineId`, non-empty `summary`, `recommendedActions` array, `model`, `inputEventIds`, and `createdAt`, and the response body is that summary

### Requirement: Serve the latest stored summary without calling the LLM
The system SHALL, on `GET /machines/:id/summary` and `GET /summary`, return the most recently created `ai_summaries` document for that scope (and machine, for machine scope) without invoking the LLM.

#### Scenario: Latest machine summary returned
- **WHEN** a client GETs `/machines/M-001/summary` and summaries exist for `M-001`
- **THEN** the most recent `scope: "MACHINE"` summary for `M-001` is returned, per the response shape in `docs/design/api.md` §4.6

#### Scenario: Latest factory summary returned
- **WHEN** a client GETs `/summary` and factory-scope summaries exist
- **THEN** the most recent `scope: "FACTORY"` summary is returned

#### Scenario: No summary yet returns 404
- **WHEN** a client GETs `/machines/M-001/summary` (or `/summary`) and no summary has ever been generated for that scope/machine
- **THEN** the system responds `404` with error code `SUMMARY_NOT_FOUND`

#### Scenario: Unknown machine returns 404 on GET
- **WHEN** a client GETs `/machines/:id/summary` for a `machineId` that does not exist
- **THEN** the system responds `404` with error code `MACHINE_NOT_FOUND`

### Requirement: LLM failure is isolated and returns 502
The system SHALL respond `502` with error code `LLM_CALL_FAILED` when the upstream LLM call fails or its output cannot be parsed into the summary shape, SHALL NOT persist any document for that attempt, and SHALL NOT affect the availability of machine, event, or alert endpoints.

#### Scenario: LLM call fails
- **WHEN** a client POSTs `/machines/M-001/summary` (or `/summary`) and the LLM call errors, times out, or returns unparseable output
- **THEN** the system responds `502` with error code `LLM_CALL_FAILED` and no new `ai_summaries` document is created

#### Scenario: Previously stored summary survives a failed regeneration
- **WHEN** a summary exists and a subsequent POST fails with `LLM_CALL_FAILED`
- **THEN** a GET for the same scope still returns the previously stored summary

### Requirement: Summaries are traceable to their input events
The system SHALL record in each `ai_summaries` document the `inputEventIds` of the events whose content was provided to the LLM, per key design rule 3 (AI explains data, it does not replace it).

#### Scenario: inputEventIds reference real events
- **WHEN** a summary is generated from a context containing events
- **THEN** the stored document's `inputEventIds` contains exactly the `eventId`s of the events included in the prompt context

### Requirement: LLM provider is selected via environment configuration
The system SHALL select the LLM adapter from `LLM_PROVIDER` (with `LLM_API_KEY` and `LLM_MODEL`) at startup, and SHALL fail fast at startup with a clear error when the configured provider is unknown.

#### Scenario: Configured provider is used
- **WHEN** the application starts with a supported `LLM_PROVIDER` value
- **THEN** summary generation uses that provider's adapter and stores its model identifier in the summary's `model` field

#### Scenario: Unknown provider fails fast
- **WHEN** the application starts with an unrecognized `LLM_PROVIDER` value
- **THEN** startup fails with an error message naming the invalid value and the supported providers
