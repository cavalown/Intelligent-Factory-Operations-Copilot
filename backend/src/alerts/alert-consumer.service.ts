import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EachMessagePayload, Kafka } from 'kafkajs';
import { Model } from 'mongoose';
import { KAFKA_CLIENT } from '../shared/kafka/kafka-client.provider';
import { KafkaConsumerBase } from '../shared/kafka/kafka-consumer.base';
import { env } from '../shared/config/env.config';
import { TemperatureReportedEvent } from '../shared/types/machine-event.types';
import { MachinesService } from '../machines/machines.service';
import { Alert, AlertDocument } from './schemas/alert.schema';

// Alert Service: derives alert severity from event type + payload, per the
// Alert Rules table (CLAUDE.md / ai/context/alert-rules.md /
// docs/design/architecture.md §9.3). Own consumer group per
// ai/rules/kafka-consumer-conventions.md.
@Injectable()
export class AlertConsumerService extends KafkaConsumerBase {
  private readonly logger = new Logger(AlertConsumerService.name);

  constructor(
    @Inject(KAFKA_CLIENT) kafka: Kafka,
    private readonly machinesService: MachinesService,
    @InjectModel(Alert.name)
    private readonly alertModel: Model<AlertDocument>,
  ) {
    super(kafka, 'alert-service-group', env.kafkaTopicMachineEvents);
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

    const machine = await this.machinesService.findRaw(event.machineId);
    if (!machine) return;

    const { temperature } = event.payload;
    if (temperature <= machine.temperatureThreshold) return;

    try {
      await this.alertModel.create({
        alertId: `alert_${randomUUID()}`,
        machineId: event.machineId,
        eventId: event.eventId,
        severity: 'WARNING',
        status: 'ACTIVE',
        message: `Temperature ${temperature}${event.payload.unit} exceeds warning threshold.`,
        createdAt: event.producedAt,
        resolvedAt: null,
      });
    } catch (err: unknown) {
      if (this.isDuplicateKeyError(err)) {
        // Already created for this eventId — idempotent no-op.
        return;
      }
      throw err;
    }
  }

  private isDuplicateKeyError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: number }).code === 11000
    );
  }
}
