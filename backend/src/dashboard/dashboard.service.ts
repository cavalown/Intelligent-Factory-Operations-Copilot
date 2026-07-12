import { Injectable } from '@nestjs/common';
import { MachinesService } from '../machines/machines.service';
import {
  UtilizationService,
  UTILIZATION_WINDOW_MS,
} from '../machines/utilization.service';
import { EventsService } from '../events/events.service';

// Composition layer over domain-module reads (architecture.md §7.7: the API
// layer aggregates; it owns no data). Lives in its own module because the
// stats now span machines + events — importing EventsModule from
// MachinesModule would be circular (dashboard-operational-metrics design D3).
@Injectable()
export class DashboardService {
  constructor(
    private readonly machinesService: MachinesService,
    private readonly utilizationService: UtilizationService,
    private readonly eventsService: EventsService,
  ) {}

  // docs/design/api.md §4.11 — machine aggregate plus rolling-24h additions.
  async getStats() {
    const now = Date.now();
    const sinceIso = new Date(now - UTILIZATION_WINDOW_MS).toISOString();
    const untilIso = new Date(now).toISOString();

    const [stats, productionCount, utilization] = await Promise.all([
      this.machinesService.getDashboardStats(),
      this.eventsService.sumProductionInWindow(sinceIso, untilIso),
      this.utilizationService.getFactoryUtilization(),
    ]);

    return { ...stats, last24h: { productionCount, ...utilization } };
  }
}
