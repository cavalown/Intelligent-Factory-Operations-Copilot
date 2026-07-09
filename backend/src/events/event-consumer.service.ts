import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EachMessagePayload, Kafka } from 'kafkajs';
import { Model } from 'mongoose';
import { KAFKA_CLIENT } from '../shared/kafka/kafka-client.provider';
import { KafkaConsumerBase } from '../shared/kafka/kafka-consumer.base';
import { env } from '../shared/config/env.config';
import { isDuplicateKeyError } from '../shared/database/mongo-error.util';
import {
  MachineEvent,
  MachineEventDocument,
} from './schemas/machine-event.schema';

// Event Service: stores every consumed event as immutable history.
// Own consumer group per ai/rules/kafka-consumer-conventions.md.
@Injectable()
export class EventConsumerService extends KafkaConsumerBase {
  constructor(
    @Inject(KAFKA_CLIENT) kafka: Kafka,
    @InjectModel(MachineEvent.name)
    private readonly machineEventModel: Model<MachineEventDocument>,
  ) {
    super(kafka, 'event-service-group', env.kafkaTopicMachineEvents);
  }

  protected async handleMessage({
    message,
  }: EachMessagePayload): Promise<void> {
    if (!message.value) return;
    const event = JSON.parse(message.value.toString());

    try {
      await this.machineEventModel.create(event);
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        // Already stored — idempotent no-op, per machine-schema.md §8.
        return;
      }
      throw err;
    }
  }
}
