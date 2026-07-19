import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { metrics, trace } from '@opentelemetry/api';
import { Consumer, Kafka } from 'kafkajs';
import { isDataError } from './error-classification.util';
import { MachineEvent } from '../types/machine-event.types';

// Domain identity (openspec/changes/add-observability/design.md D4) and the
// events-processed metric (design.md's pattern-setter custom metric) are
// shared across all three consumer subclasses, so both live here rather than
// being duplicated per subclass.
const eventsProcessedCounter = metrics
  .getMeter('ifoc-backend')
  .createCounter('ifoc.events.processed', {
    description:
      'Kafka events successfully processed, labeled by eventType and consumer group.',
  });

// Base class for a Kafka consumer with its OWN consumer group, per
// ai/rules/kafka-consumer-conventions.md. Each subclass (Event/Machine/Alert
// Service) passes its own groupId and gets a fully independent subscription
// to the topic — none of them share a group, so each sees every message.
export abstract class KafkaConsumerBase
  implements OnModuleInit, OnModuleDestroy
{
  private readonly consumer: Consumer;
  // Shared by subclasses via `this.logger` — avoids each subclass declaring
  // its own duplicate Logger instance with the same class-name context.
  protected readonly logger = new Logger(this.constructor.name);

  protected constructor(
    kafka: Kafka,
    protected readonly groupId: string,
    private readonly topic: string,
  ) {
    this.consumer = kafka.consumer({ groupId: this.groupId });
  }

  async onModuleInit(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic, fromBeginning: true });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          // Parsed once here (rather than per-subclass) so handleMessage
          // and the events-processed metric/span attributes below share a
          // single envelope — see openspec/changes/add-observability/design.md
          // D4 and the code-review finding that motivated this refactor.
          const parsed: unknown = JSON.parse(message.value.toString());
          if (parsed === null || typeof parsed !== 'object') {
            // A JSON-valid but non-object envelope (e.g. literal `null`)
            // would otherwise null-deref downstream; treat it the same as
            // a syntax error so isDataError below swallows it instead of
            // reaching kafkajs's retry path for a deterministically-bad
            // message.
            throw new SyntaxError(
              'Kafka message parsed to a non-object envelope',
            );
          }
          const event = parsed as MachineEvent;

          // handleMessage reports whether it did real work (true) or
          // deliberately skipped (false — unrecognized eventType,
          // idempotent duplicate, unknown machine, etc.); only genuine
          // processing counts toward the metric/span attributes, per the
          // counter's own "successfully processed" contract.
          const processed = await this.handleMessage(event);
          if (processed) this.recordProcessed(event);
        } catch (err) {
          if (isDataError(err)) {
            // This message's content is unprocessable — retrying would fail
            // identically every time. Swallow so kafkajs commits the offset
            // and moves on, rather than stalling this consumer group
            // forever on the same "poison pill" message. See
            // openspec/changes/kafka-consumer-error-classification/design.md
            // Decision (Option B).
            this.logger.error(
              `Skipping unprocessable message: ${err}`,
              err instanceof Error ? err.stack : undefined,
            );
            return;
          }
          // Not a data error (e.g. a transient MongoDB failure) — rethrow so
          // it reaches kafkajs's own jittered, already-tested runner-level
          // retry mechanism instead of being retried by hand-rolled logic
          // here. See the same design.md's "Why Option C was reverted".
          throw err;
        }
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }

  private recordProcessed(event: MachineEvent): void {
    trace.getActiveSpan()?.setAttributes({
      'ifoc.correlation_id': event.correlationId ?? '',
      'ifoc.event_id': event.eventId,
      'ifoc.event_type': event.eventType,
    });
    eventsProcessedCounter.add(1, {
      eventType: event.eventType,
      consumerGroup: this.groupId,
    });
  }

  // Returns true when the event caused a real effect (write/projection
  // update/alert), false for a deliberate no-op skip (unrecognized type,
  // idempotent duplicate, unknown machine, stale eventId, ...). Only true
  // counts toward ifoc.events.processed — see the call site in onModuleInit.
  protected abstract handleMessage(event: MachineEvent): Promise<boolean>;
}
