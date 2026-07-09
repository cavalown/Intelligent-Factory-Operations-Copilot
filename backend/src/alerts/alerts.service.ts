import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MachinesService } from '../machines/machines.service';
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
    await this.machinesService.assertExists(machineId);
    return this.listAlerts({ machineId, status });
  }

  // Internal read for the Insight Service's context gathering
  // (add-insights-module design D2). Not exposed over HTTP; callers passing
  // machineId are responsible for having validated it exists.
  async listAlerts(options: {
    machineId?: string;
    status?: string;
    limit?: number;
  }) {
    const filter: Record<string, unknown> = {};
    if (options.machineId) {
      filter.machineId = options.machineId;
    }
    if (options.status) {
      filter.status = options.status;
    }

    let query = this.alertModel.find(filter).sort({ _id: -1 });
    if (options.limit) {
      query = query.limit(options.limit);
    }
    const alerts = await query.exec();

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
