import { Controller, Get } from '@nestjs/common';
import { MachinesService } from './machines.service';

// docs/design/api.md — dashboard aggregate lives in the machines module
// because it reads only the machines projection (add-frontend-mvp design D4).
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly machinesService: MachinesService) {}

  @Get('stats')
  async getStats() {
    return this.machinesService.getDashboardStats();
  }
}
