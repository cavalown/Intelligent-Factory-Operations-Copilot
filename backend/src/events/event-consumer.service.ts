import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Kafka } from 'kafkajs';
import { Model } from 'mongoose';
import { KAFKA_CLIENT } from '../shared/kafka/kafka-client.provider';
import { KafkaConsumerBase } from '../shared/kafka/kafka-consumer.base';
import { env } from '../shared/config/env.config';
import { isDuplicateKeyError } from '../shared/database/mongo-error.util';
import { MachineEvent } from '../shared/types/machine-event.types';
import {
  MachineEvent as MachineEventEntity,
  MachineEventDocument,
} from './schemas/machine-event.schema';

// Event Service: stores every consumed event as immutable history.
// Own consumer group per ai/rules/kafka-consumer-conventions.md.
@Injectable()
export class EventConsumerService extends KafkaConsumerBase {
  constructor(
    @Inject(KAFKA_CLIENT) kafka: Kafka,
    @InjectModel(MachineEventEntity.name)
    private readonly machineEventModel: Model<MachineEventDocument>,
  ) {
    super(kafka, 'event-service-group', env.kafkaTopicMachineEvents);
  }

  protected async handleMessage(event: MachineEvent): Promise<boolean> {
    try {
      // The envelope is stored verbatim as history; MachineEvent's
      // per-eventType `payload` interfaces are always plain objects, just
      // without an index signature, so this cast is structurally safe.
      await this.machineEventModel.create(
        event as unknown as MachineEventEntity,
      );
      return true;
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        // Already stored — idempotent no-op, per machine-schema.md §8.
        return false;
      }
      throw err;
    }
  }
}
