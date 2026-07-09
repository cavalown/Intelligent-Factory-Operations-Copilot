import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EachMessagePayload, Kafka } from 'kafkajs';
import { Model } from 'mongoose';
import { KAFKA_CLIENT } from '../shared/kafka/kafka-client.provider';
import { KafkaConsumerBase } from '../shared/kafka/kafka-consumer.base';
import { env } from '../shared/config/env.config';
import { MachineEvent } from '../shared/types/machine-event.types';
import {
  Machine,
  MachineDocument,
  MachineStatus,
} from './schemas/machine.schema';
import { clampHealthScore, raiseSeverity } from './machine-status.util';

// MVP rule (design.md Decision 1 of remaining-mvp-event-types): any
// STATUS_CHANGED to WARNING is treated as sensor failure. Deliberately not
// shared with alert-consumer.service.ts's identically-named function — see
// docs/design/machine-schema.md §5.4 and
// openspec/changes/duplicate-logic-cleanup/design.md Decision 2. A contract
// test asserts the two stay in agreement.
export function isStatusChangedSensorFailure(currentStatus: string): boolean {
  return currentStatus === 'WARNING';
}

// Machine Service: projects events into current machine state.
// Own consumer group per ai/rules/kafka-consumer-conventions.md.
@Injectable()
export class MachineProjectionConsumerService extends KafkaConsumerBase {
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
    const event = JSON.parse(message.value.toString()) as MachineEvent;

    const machine = await this.machineModel.findOne({
      machineId: event.machineId,
    });
    if (!machine) return;

    // Idempotency: only guards immediate repeats, per machine-schema.md §8.
    if (machine.lastEventId === event.eventId) return;

    // docs/design/machine-schema.md §4.3 / §5.2 / §7
    switch (event.eventType) {
      case 'STATUS_CHANGED': {
        const currentStatus = event.payload.currentStatus as MachineStatus;
        machine.status = currentStatus;
        if (isStatusChangedSensorFailure(currentStatus)) {
          machine.healthScore = clampHealthScore(machine.healthScore - 15);
        }
        break;
      }
      case 'TEMPERATURE_REPORTED': {
        const { temperature } = event.payload;
        if (!Number.isFinite(temperature)) {
          this.logger.warn(
            `Skipping non-finite temperature for event ${event.eventId}`,
          );
          break;
        }
        machine.currentTemperature = temperature;
        if (temperature > machine.temperatureThreshold) {
          machine.status = raiseSeverity(machine.status, 'WARNING');
          machine.healthScore = clampHealthScore(machine.healthScore - 10);
        }
        break;
      }
      case 'ERROR_OCCURRED': {
        machine.status = raiseSeverity(machine.status, 'ERROR');
        machine.healthScore = clampHealthScore(machine.healthScore - 30);
        break;
      }
      case 'MAINTENANCE_REQUIRED': {
        machine.status = raiseSeverity(machine.status, 'MAINTENANCE');
        machine.healthScore = clampHealthScore(machine.healthScore - 20);
        break;
      }
      case 'PRODUCTION_COMPLETED': {
        machine.status = raiseSeverity(machine.status, 'RUNNING');
        machine.healthScore = clampHealthScore(machine.healthScore + 2);
        if (Number.isFinite(event.payload.quantity)) {
          machine.productionCount += event.payload.quantity;
        } else {
          this.logger.warn(
            `Skipping non-numeric quantity for event ${event.eventId}`,
          );
        }
        break;
      }
      default:
        // Unrecognized eventType — skip entirely, don't mark as processed.
        // See openspec/changes/archive/2026-07-08-kafka-consumer-reliability-hardening/design.md.
        this.logger.warn(
          `Skipping unrecognized eventType for event ${(event as MachineEvent).eventId}`,
        );
        return;
    }

    machine.lastEventId = event.eventId;
    machine.lastUpdatedAt = event.producedAt;

    await machine.save();
  }
}
