import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EachMessagePayload, Kafka } from 'kafkajs';
import { Model } from 'mongoose';
import { KAFKA_CLIENT } from '../shared/kafka/kafka-client.provider';
import { KafkaConsumerBase } from '../shared/kafka/kafka-consumer.base';
import { env } from '../shared/config/env.config';
import { TemperatureReportedEvent } from '../shared/types/machine-event.types';
import { Machine, MachineDocument } from './schemas/machine.schema';
import { clampHealthScore, raiseSeverity } from './machine-status.util';

// Machine Service: projects events into current machine state.
// Own consumer group per ai/rules/kafka-consumer-conventions.md.
@Injectable()
export class MachineProjectionConsumerService extends KafkaConsumerBase {
  private readonly logger = new Logger(
    MachineProjectionConsumerService.name,
  );

  constructor(
    @Inject(KAFKA_CLIENT) kafka: Kafka,
    @InjectModel(Machine.name)
    private readonly machineModel: Model<MachineDocument>,
  ) {
    super(kafka, 'machine-service-group', env.kafkaTopicMachineEvents);
  }

  protected async handleMessage({
    message,
  }: EachMessagePayload): Promise<void> {
    if (!message.value) return;
    const event = JSON.parse(
      message.value.toString(),
    ) as TemperatureReportedEvent;

    // This change only implements TEMPERATURE_REPORTED — see
    // ai/skills/add-mvp-event-type.md for adding the rest.
    if (event.eventType !== 'TEMPERATURE_REPORTED') return;

    const machine = await this.machineModel.findOne({
      machineId: event.machineId,
    });
    if (!machine) return;

    // Idempotency: only guards immediate repeats, per machine-schema.md §8.
    if (machine.lastEventId === event.eventId) return;

    const { temperature } = event.payload;
    machine.currentTemperature = temperature;

    // docs/design/machine-schema.md §4.3 / §5.2
    if (temperature > machine.temperatureThreshold) {
      machine.status = raiseSeverity(machine.status, 'WARNING');
      machine.healthScore = clampHealthScore(machine.healthScore - 10);
    }

    machine.lastEventId = event.eventId;
    machine.lastUpdatedAt = event.producedAt;

    await machine.save();
  }
}
