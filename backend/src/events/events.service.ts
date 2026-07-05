import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MachinesService } from '../machines/machines.service';
import { ApiError } from '../shared/errors/api-error';
import {
  MachineEvent,
  MachineEventDocument,
} from './schemas/machine-event.schema';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class EventsService {
  constructor(
    private readonly machinesService: MachinesService,
    @InjectModel(MachineEvent.name)
    private readonly machineEventModel: Model<MachineEventDocument>,
  ) {}

  // docs/design/api.md §4.3 — most-recent-first, cursor-based pagination.
  async listEventsForMachine(
    machineId: string,
    query: { limit?: string; before?: string; eventType?: string },
  ) {
    await this.assertMachineExists(machineId);

    const limit = Math.min(
      Math.max(Number(query.limit) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );

    const filter: Record<string, unknown> = { machineId };
    if (query.eventType) {
      filter.eventType = query.eventType;
    }

    if (query.before) {
      const cursorEvent = await this.machineEventModel
        .findOne({ eventId: query.before })
        .exec();
      if (cursorEvent) {
        filter._id = { $lt: cursorEvent._id };
      }
    }

    const events = await this.machineEventModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .exec();

    const hasMore = events.length > limit;
    const page = events.slice(0, limit);

    return {
      data: page.map((e) => this.toResponse(e)),
      pagination: {
        limit,
        nextCursor: hasMore ? page[page.length - 1].eventId : null,
        hasMore,
      },
    };
  }

  private async assertMachineExists(machineId: string): Promise<void> {
    const exists = await this.machinesService.exists(machineId);
    if (!exists) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'MACHINE_NOT_FOUND',
        `Machine ${machineId} was not found.`,
      );
    }
  }

  private toResponse(e: MachineEventDocument) {
    return {
      eventId: e.eventId,
      eventType: e.eventType,
      schemaVersion: e.schemaVersion,
      source: e.source,
      machineId: e.machineId,
      occurredAt: e.occurredAt,
      producedAt: e.producedAt,
      correlationId: e.correlationId,
      payload: e.payload,
    };
  }
}
