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
import { MachinesService } from '../machines/machines.service';
import { Alert, AlertDocument, AlertSeverity } from './schemas/alert.schema';

// MVP rule (design.md Decision 1 of remaining-mvp-event-types): any
// STATUS_CHANGED to WARNING is treated as sensor failure. Deliberately not
// shared with machine-projection-consumer.service.ts's identically-named
// function — see docs/design/machine-schema.md §5.4 and
// openspec/changes/duplicate-logic-cleanup/design.md Decision 2. A contract
// test asserts the two stay in agreement.
export function isStatusChangedSensorFailure(currentStatus: string): boolean {
  return currentStatus === 'WARNING';
}

// Alert Service: derives alert severity from event type + payload, per the
// Alert Rules table (CLAUDE.md / ai/context/alert-rules.md /
// docs/design/architecture.md §9.3). Own consumer group per
// ai/rules/kafka-consumer-conventions.md.
@Injectable()
export class AlertConsumerService extends KafkaConsumerBase {
  constructor(
    @Inject(KAFKA_CLIENT) kafka: Kafka,
    private readonly machinesService: MachinesService,
    @InjectModel(Alert.name)
    private readonly alertModel: Model<AlertDocument>,
  ) {
    super(kafka, 'alert-service-group', env.kafkaTopicMachineEvents);
  }

  protected async handleMessage(event: MachineEvent): Promise<boolean> {
    const alert = await this.resolveAlert(event);
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
  private async resolveAlert(
    event: MachineEvent,
  ): Promise<{ severity: AlertSeverity; message: string } | null> {
    switch (event.eventType) {
      case 'STATUS_CHANGED': {
        if (!isStatusChangedSensorFailure(event.payload.currentStatus))
          return null;
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
        const machine = await this.machinesService.findRaw(event.machineId);
        if (!machine) return null;
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
      default:
        this.logger.warn(
          `Skipping unrecognized eventType for event ${(event as MachineEvent).eventId}`,
        );
        return null;
    }
  }
}
