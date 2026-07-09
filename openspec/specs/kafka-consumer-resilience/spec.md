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

