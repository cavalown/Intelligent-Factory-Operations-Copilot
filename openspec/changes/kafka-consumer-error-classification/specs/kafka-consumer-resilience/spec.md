## ADDED Requirements

### Requirement: Only data errors are swallowed at the consumer error boundary; other errors propagate for kafkajs's own retry to handle
The system SHALL swallow (log and skip, committing the offset) a `handleMessage` failure only when the error indicates the message's content itself is unprocessable (a JSON parse failure, or a Mongoose validation/cast error). Any other error SHALL be rethrown so it reaches kafkajs's own consumer-level retry mechanism, rather than being retried by application-level logic inside `handleMessage`'s caller.

#### Scenario: A malformed message is skipped immediately, no retry delay
- **WHEN** `handleMessage` throws a `SyntaxError` (invalid JSON) or a Mongoose `ValidationError`/`CastError`
- **THEN** the consuming service logs the error and immediately continues processing the next message, with no added delay

#### Scenario: A non-data error propagates to kafkajs's retry mechanism
- **WHEN** `handleMessage` throws an error that is not a `SyntaxError`, Mongoose `ValidationError`, or Mongoose `CastError` (e.g. a transient MongoDB connection failure)
- **THEN** the error propagates out of the consumer's `eachMessage` callback, is retried by kafkajs's own consumer-level retry mechanism, and only results in a process crash (recoverable via container restart and Kafka redelivery) if kafkajs's own retry budget is exhausted

This requirement applies uniformly to `EventConsumerService`, `MachineProjectionConsumerService`, and `AlertConsumerService`, since all three subclass the same `KafkaConsumerBase` and the classification happens generically around the abstract `handleMessage` call.
