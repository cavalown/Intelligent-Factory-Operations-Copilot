import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MachinesService } from '../machines/machines.service';
import { ApiError } from '../shared/errors/api-error';
import { Alert, AlertDocument, ALERT_STATUSES } from './schemas/alert.schema';

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
    // Domain validation against the schema's own constant (code-style.md:
    // enum membership, not just "is a string"). Sits here so both HTTP routes
    // are covered; internal callers pass literals. `status` may be a
    // comma-separated list (add-alert-lifecycle design D3) — every segment
    // is validated, a single value behaves exactly as before this change.
    const statuses = options.status?.split(',');
    if (
      statuses !== undefined &&
      !statuses.every((s) => (ALERT_STATUSES as readonly string[]).includes(s))
    ) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'INVALID_QUERY_PARAMETER',
        `status must be one of: ${ALERT_STATUSES.join(', ')}.`,
      );
    }

    const filter: Record<string, unknown> = {};
    if (options.machineId) {
      filter.machineId = options.machineId;
    }
    if (statuses !== undefined) {
      filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }

    let query = this.alertModel.find(filter).sort({ _id: -1 });
    if (options.limit) {
      query = query.limit(options.limit);
    }
    const alerts = await query.exec();

    return { data: alerts.map((a) => this.toResponse(a)) };
  }

  // docs/design/api.md §4.x — POST /machines/:id/alerts/:alertId/acknowledge
  // (add-alert-lifecycle design D1/D2).
  async acknowledgeAlert(machineId: string, alertId: string) {
    const alert = await this.findAlertOrThrow(machineId, alertId);

    if (alert.status === 'RESOLVED') {
      throw new ApiError(
        HttpStatus.CONFLICT,
        'INVALID_ALERT_TRANSITION',
        `Alert ${alertId} is RESOLVED and cannot be acknowledged.`,
      );
    }
    if (alert.status === 'ACTIVE') {
      alert.status = 'ACKNOWLEDGED';
      alert.acknowledgedAt = new Date().toISOString();
      await alert.save();
    }
    // ACKNOWLEDGED -> acknowledge is an idempotent no-op (design D1).

    return this.toResponse(alert);
  }

  // docs/design/api.md §4.x — POST /machines/:id/alerts/:alertId/resolve
  // (add-alert-lifecycle design D1/D2).
  async resolveAlert(machineId: string, alertId: string) {
    const alert = await this.findAlertOrThrow(machineId, alertId);

    if (alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED') {
      alert.status = 'RESOLVED';
      alert.resolvedAt = new Date().toISOString();
      await alert.save();
    }
    // RESOLVED -> resolve is an idempotent no-op (design D1).

    return this.toResponse(alert);
  }

  // Shared lookup for both transition actions (design D2): machine existence
  // first, then alert scoped to that machine so a valid alertId under the
  // wrong machineId 404s instead of silently mutating another machine's alert.
  private async findAlertOrThrow(
    machineId: string,
    alertId: string,
  ): Promise<AlertDocument> {
    await this.machinesService.assertExists(machineId);

    const alert = await this.alertModel.findOne({ alertId, machineId }).exec();
    if (!alert) {
      throw new ApiError(
        HttpStatus.NOT_FOUND,
        'ALERT_NOT_FOUND',
        `Alert ${alertId} was not found for machine ${machineId}.`,
      );
    }
    return alert;
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
      acknowledgedAt: a.acknowledgedAt,
      resolvedAt: a.resolvedAt,
    };
  }
}
