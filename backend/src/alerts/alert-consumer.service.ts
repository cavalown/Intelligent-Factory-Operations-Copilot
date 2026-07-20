import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Kafka } from 'kafkajs';
import { Model } from 'mongoose';
import { KAFKA_CLIENT } from '../shared/kafka/kafka-client.provider';
import { KafkaConsumerBase } from '../shared/kafka/kafka-consumer.base';
import { env } from '../shared/config/env.config';
import { isDuplicateKeyError } from '../shared/database/mongo-error.util';
import { MachineEvent } from '../shared/types/machine-event.types';
import { Alert, AlertDocument, AlertSeverity } from './schemas/alert.schema';

// Alert Service: derives alert severity from event type + payload, per the
// Alert Rules table (CLAUDE.md / ai/context/alert-rules.md /
// docs/design/architecture.md §9.3). Consumes the Rule Engine's enriched
// topic, reading its classification instead of re-deriving it
// (openspec/changes/add-rule-engine/design.md D5). Own consumer group per
// ai/rules/kafka-consumer-conventions.md.
@Injectable()
export class AlertConsumerService extends KafkaConsumerBase {
  constructor(
    @Inject(KAFKA_CLIENT) kafka: Kafka,
    @InjectModel(Alert.name)
    private readonly alertModel: Model<AlertDocument>,
  ) {
    super(kafka, 'alert-service-group', env.kafkaTopicMachineEventsEnriched);
  }

  protected async handleMessage(event: MachineEvent): Promise<boolean> {
    const alert = this.resolveAlert(event);
    if (!alert) return false;

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
      return true;
    } catch (err: unknown) {
      if (isDuplicateKeyError(err)) {
        // Already created for this eventId — idempotent no-op.
        return false;
      }
      throw err;
    }
  }

  // docs/design/architecture.md §9.3 — returns null when no alert should be created.
  private resolveAlert(
    event: MachineEvent,
  ): { severity: AlertSeverity; message: string } | null {
    switch (event.eventType) {
      case 'STATUS_CHANGED': {
        if (!event.isSensorFailure) return null;
        return {
          severity: 'WARNING',
          message: `Machine status changed to WARNING: ${event.payload.reason ?? 'no reason given'}.`,
        };
      }
      case 'TEMPERATURE_REPORTED': {
        const { temperature, unit } = event.payload;
        if (!Number.isFinite(temperature)) {
          this.logger.warn(
            `Skipping non-finite temperature for event ${event.eventId}`,
          );
          return null;
        }
        if (!event.temperatureExceedsThreshold) return null;
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
      default:
        this.logger.warn(
          `Skipping unrecognized eventType for event ${(event as MachineEvent).eventId}`,
        );
        return null;
    }
  }
}
