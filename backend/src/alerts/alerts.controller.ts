import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('machines/:id/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async getAlerts(@Param('id') id: string, @Query('status') status?: string) {
    return this.alertsService.listAlertsForMachine(id, status);
  }

  // docs/design/api.md §4.x (add-alert-lifecycle)
  @Post(':alertId/acknowledge')
  @HttpCode(HttpStatus.OK)
  async acknowledge(
    @Param('id') id: string,
    @Param('alertId') alertId: string,
  ) {
    return this.alertsService.acknowledgeAlert(id, alertId);
  }

  // docs/design/api.md §4.x (add-alert-lifecycle)
  @Post(':alertId/resolve')
  @HttpCode(HttpStatus.OK)
  async resolve(@Param('id') id: string, @Param('alertId') alertId: string) {
    return this.alertsService.resolveAlert(id, alertId);
  }
}
