import { Controller, Get, Param, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('machines/:id/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async getAlerts(@Param('id') id: string, @Query('status') status?: string) {
    return this.alertsService.listAlertsForMachine(id, status);
  }
}
