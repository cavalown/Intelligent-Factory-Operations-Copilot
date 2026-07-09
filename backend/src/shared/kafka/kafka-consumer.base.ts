import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';
import { isDataError } from './error-classification.util';

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
    private readonly groupId: string,
    private readonly topic: string,
  ) {
    this.consumer = kafka.consumer({ groupId: this.groupId });
  }

  async onModuleInit(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic, fromBeginning: true });
    await this.consumer.run({
      eachMessage: async (payload) => {
        try {
          await this.handleMessage(payload);
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

  protected abstract handleMessage(payload: EachMessagePayload): Promise<void>;
}
