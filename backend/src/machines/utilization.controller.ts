import { Controller, Get, Param } from '@nestjs/common';
import { UtilizationService } from './utilization.service';

// docs/design/api.md — rolling-24h time-in-status per machine
// (dashboard-operational-metrics design D2).
@Controller('machines/:id/utilization')
export class UtilizationController {
  constructor(private readonly utilizationService: UtilizationService) {}

  @Get()
  async getUtilization(@Param('id') id: string) {
    return this.utilizationService.getMachineUtilization(id);
  }
}
