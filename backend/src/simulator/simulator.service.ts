import { HttpStatus, Injectable } from '@nestjs/common';
import { MachinesService } from '../machines/machines.service';
import { KafkaProducerService } from '../shared/kafka/kafka-producer.service';
import { ApiError } from '../shared/errors/api-error';
import { env } from '../shared/config/env.config';
import {
  IMPLEMENTED_EVENT_TYPES,
  MachineEvent,
} from '../shared/types/machine-event.types';

// docs/design/event-schema.md §9.1 (correlationId is optional).
const REQUIRED_ENVELOPE_FIELDS = [
  'eventId',
  'eventType',
  'schemaVersion',
  'source',
  'machineId',
  'occurredAt',
  'producedAt',
  'payload',
] as const;

@Injectable()
export class SimulatorService {
  constructor(
    private readonly machinesService: MachinesService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async ingestEvent(
    body: Record<string, unknown>,
  ): Promise<{ eventId: string; status: 'PUBLISHED' }> {
    this.validateEnvelope(body);

    const machineId = body.machineId as string;
    const machineExists = await this.machinesService.exists(machineId);
    if (!machineExists) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'UNKNOWN_MACHINE',
        `Machine ${machineId} is not pre-seeded.`,
      );
    }

    const eventType = body.eventType as string;
    if (!(IMPLEMENTED_EVENT_TYPES as readonly string[]).includes(eventType)) {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'UNSUPPORTED_EVENT_TYPE',
        `Event type ${eventType} is not supported yet.`,
      );
    }

    this.validatePayload(eventType, body.payload);

    const event = body as unknown as MachineEvent;
    await this.kafkaProducer.publish(
      env.kafkaTopicMachineEvents,
      machineId,
      event,
    );

    return { eventId: event.eventId, status: 'PUBLISHED' };
  }

  private validateEnvelope(body: Record<string, unknown>): void {
    for (const field of REQUIRED_ENVELOPE_FIELDS) {
      if (body[field] === undefined || body[field] === null) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'INVALID_EVENT_ENVELOPE',
          `Missing required envelope field: ${field}`,
        );
      }
    }
  }

  // docs/design/event-schema.md §9.2
  private validatePayload(eventType: string, payload: unknown): void {
    switch (eventType) {
      case 'STATUS_CHANGED':
        return this.validateStatusChangedPayload(payload);
      case 'TEMPERATURE_REPORTED':
        return this.validateTemperatureReportedPayload(payload);
      case 'ERROR_OCCURRED':
        return this.validateErrorOccurredPayload(payload);
      case 'MAINTENANCE_REQUIRED':
        return this.validateMaintenanceRequiredPayload(payload);
      case 'PRODUCTION_COMPLETED':
        return this.validateProductionCompletedPayload(payload);
    }
  }

  private validateStatusChangedPayload(payload: unknown): void {
    const p = (payload ?? {}) as Record<string, unknown>;
    if (typeof p.currentStatus !== 'string') {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PAYLOAD_VALIDATION_FAILED',
        'STATUS_CHANGED payload requires a string currentStatus.',
      );
    }
  }

  private validateTemperatureReportedPayload(payload: unknown): void {
    const p = (payload ?? {}) as Record<string, unknown>;
    if (typeof p.temperature !== 'number' || typeof p.unit !== 'string') {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PAYLOAD_VALIDATION_FAILED',
        'TEMPERATURE_REPORTED payload requires a numeric temperature and string unit.',
      );
    }
  }

  private validateErrorOccurredPayload(payload: unknown): void {
    const p = (payload ?? {}) as Record<string, unknown>;
    if (typeof p.errorCode !== 'string' || typeof p.errorMessage !== 'string') {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PAYLOAD_VALIDATION_FAILED',
        'ERROR_OCCURRED payload requires a string errorCode and errorMessage.',
      );
    }
  }

  private validateMaintenanceRequiredPayload(payload: unknown): void {
    const p = (payload ?? {}) as Record<string, unknown>;
    if (typeof p.maintenanceType !== 'string' || typeof p.reason !== 'string') {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PAYLOAD_VALIDATION_FAILED',
        'MAINTENANCE_REQUIRED payload requires a string maintenanceType and reason.',
      );
    }
  }

  private validateProductionCompletedPayload(payload: unknown): void {
    const p = (payload ?? {}) as Record<string, unknown>;
    if (typeof p.quantity !== 'number') {
      throw new ApiError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'PAYLOAD_VALIDATION_FAILED',
        'PRODUCTION_COMPLETED payload requires a numeric quantity.',
      );
    }
  }
}
