import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MachinesService } from '../machines/machines.service';
import { ApiError } from '../shared/errors/api-error';
import { Alert, AlertDocument } from './schemas/alert.schema';

@Injectable()
export class AlertsService {
  constructor(
    private readonly machinesService: MachinesService,
    @InjectModel(Alert.name)
    private readonly alertModel: Model<AlertDocument>,
  ) {}

  // docs/design/api.md §4.4
  async listAlertsForMachine(machineId: string, status?: string) {
    const exists = await this.machinesService.exists(machineId);
    if (!exists) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'MACHINE_NOT_FOUND',
        `Machine ${machineId} was not found.`,
      );
    }

    const filter: Record<string, unknown> = { machineId };
    if (status) {
      filter.status = status;
    }

    const alerts = await this.alertModel.find(filter).sort({ _id: -1 }).exec();

    return { data: alerts.map((a) => this.toResponse(a)) };
  }

  private toResponse(a: AlertDocument) {
    return {
      alertId: a.alertId,
      machineId: a.machineId,
      eventId: a.eventId,
      severity: a.severity,
      status: a.status,
      message: a.message,
      createdAt: a.createdAt,
      resolvedAt: a.resolvedAt,
    };
  }
}
