import { Controller, Get, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// docs/design/api.md — cross-machine alert read backing the Dashboard's
// Active Alerts widget (dashboard-operational-metrics design D4). Mirrors the
// events module's per-machine/cross-machine controller pair.
@Controller('alerts')
export class AlertsListController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async getAlerts(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit !== undefined ? Number(limit) : DEFAULT_LIMIT;
    const bounded = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    return this.alertsService.listAlerts({ status, limit: bounded });
  }
}
