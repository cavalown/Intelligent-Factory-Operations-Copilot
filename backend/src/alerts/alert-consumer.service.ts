import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EachMessagePayload, Kafka } from 'kafkajs';
import { Model } from 'mongoose';
import { KAFKA_CLIENT } from '../shared/kafka/kafka-client.provider';
import { KafkaConsumerBase } from '../shared/kafka/kafka-consumer.base';
import { env } from '../shared/config/env.config';
import { MachineEvent } from '../shared/types/machine-event.types';
import { MachinesService } from '../machines/machines.service';
import { Alert, AlertDocument, AlertSeverity } from './schemas/alert.schema';

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
    const event = JSON.parse(message.value.toString()) as MachineEvent;

    const alert = await this.resolveAlert(event);
    if (!alert) return;

    try {
      await this.alertModel.create({
        alertId: `alert_${randomUUID()}`,
        machineId: event.machineId,
        eventId: event.eventId,
        severity: alert.severity,
        status: 'ACTIVE',
        message: alert.message,
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

  // docs/design/architecture.md §9.3 — returns null when no alert should be created.
  private async resolveAlert(
    event: MachineEvent,
  ): Promise<{ severity: AlertSeverity; message: string } | null> {
    switch (event.eventType) {
      case 'STATUS_CHANGED': {
        // MVP rule (design.md Decision 1 of remaining-mvp-event-types):
        // any STATUS_CHANGED to WARNING is treated as sensor failure.
        if (event.payload.currentStatus !== 'WARNING') return null;
        return {
          severity: 'WARNING',
          message: `Machine status changed to WARNING: ${event.payload.reason ?? 'no reason given'}.`,
        };
      }
      case 'TEMPERATURE_REPORTED': {
        const machine = await this.machinesService.findRaw(event.machineId);
        if (!machine) return null;
        const { temperature, unit } = event.payload;
        if (temperature <= machine.temperatureThreshold) return null;
        return {
          severity: 'WARNING',
          message: `Temperature ${temperature}${unit} exceeds warning threshold.`,
        };
      }
      case 'ERROR_OCCURRED':
        return {
          severity: 'CRITICAL',
          message: `Error ${event.payload.errorCode}: ${event.payload.errorMessage}`,
        };
      case 'MAINTENANCE_REQUIRED':
        return {
          severity: 'WARNING',
          message: `Maintenance required (${event.payload.maintenanceType}): ${event.payload.reason}`,
        };
      case 'PRODUCTION_COMPLETED':
        return null;
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
