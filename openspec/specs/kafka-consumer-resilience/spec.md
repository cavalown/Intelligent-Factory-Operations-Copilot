# kafka-consumer-resilience Specification

## Purpose
TBD - created by archiving change kafka-consumer-reliability-hardening. Update Purpose after archive.
## Requirements
### Requirement: Consumer error boundary prevents indefinite stall
The system SHALL catch any error thrown while processing a single Kafka message in a consumer's `handleMessage`, log it, and allow the consumer to continue processing subsequent messages, rather than letting the error propagate and block the consumer group indefinitely.

#### Scenario: Malformed JSON does not stall the consumer
- **WHEN** a message on `machine.events` is not valid JSON
- **THEN** the consuming service logs the parse failure and continues processing the next message, without retrying the malformed message indefinitely

#### Scenario: A downstream persistence error does not stall the consumer
- **WHEN** `handleMessage` throws while persisting a message (e.g. a MongoDB validation error not related to duplicate-key idempotency)
- **THEN** the consuming service logs the error and continues processing the next message

This requirement applies uniformly to `EventConsumerService`, `MachineProjectionConsumerService`, and `AlertConsumerService`, since all three subclass the same `KafkaConsumerBase`.

### Requirement: Only data errors are swallowed at the consumer error boundary; other errors propagate for kafkajs's own retry to handle
The system SHALL swallow (log and skip, committing the offset) a `handleMessage` failure only when the error indicates the message's content itself is unprocessable (a JSON parse failure, or a Mongoose validation/cast error). Any other error SHALL be rethrown so it reaches kafkajs's own consumer-level retry mechanism, rather than being retried by application-level logic inside `handleMessage`'s caller.

#### Scenario: A malformed message is skipped immediately, no retry delay
- **WHEN** `handleMessage` throws a `SyntaxError` (invalid JSON) or a Mongoose `ValidationError`/`CastError`
- **THEN** the consuming service logs the error and immediately continues processing the next message, with no added delay

#### Scenario: A non-data error propagates to kafkajs's retry mechanism
- **WHEN** `handleMessage` throws an error that is not a `SyntaxError`, Mongoose `ValidationError`, or Mongoose `CastError` (e.g. a transient MongoDB connection failure)
- **THEN** the error propagates out of the consumer's `eachMessage` callback, is retried by kafkajs's own consumer-level retry mechanism, and only results in a process crash (recoverable via container restart and Kafka redelivery) if kafkajs's own retry budget is exhausted

This requirement applies uniformly to `EventConsumerService`, `MachineProjectionConsumerService`, and `AlertConsumerService`, since all three subclass the same `KafkaConsumerBase` and the classification happens generically around the abstract `handleMessage` call.

