import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, EachMessagePayload, Kafka } from 'kafkajs';

// Base class for a Kafka consumer with its OWN consumer group, per
// ai/rules/kafka-consumer-conventions.md. Each subclass (Event/Machine/Alert
// Service) passes its own groupId and gets a fully independent subscription
// to the topic — none of them share a group, so each sees every message.
export abstract class KafkaConsumerBase implements OnModuleInit, OnModuleDestroy {
  private readonly consumer: Consumer;

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
      eachMessage: (payload) => this.handleMessage(payload),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
  }

  protected abstract handleMessage(payload: EachMessagePayload): Promise<void>;
}
