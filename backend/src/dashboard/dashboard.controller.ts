import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

// docs/design/api.md §4.11. Moved out of the machines module when the stats
// grew a rolling-24h production component that reads machine_events —
// composition across domain modules belongs to a thin API-layer module
// (dashboard-operational-metrics design D3).
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats() {
    return this.dashboardService.getStats();
  }
}
