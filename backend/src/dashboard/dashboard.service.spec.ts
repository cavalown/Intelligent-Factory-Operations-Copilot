import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

describe('DashboardService', () => {
  const baseStats = {
    machineCount: 3,
    statusCounts: { RUNNING: 1, IDLE: 0, WARNING: 1, ERROR: 1, MAINTENANCE: 0 },
    totalProductionCount: 145,
    averageHealthScore: 62.7,
  };
  const utilization = {
    operatingMs: 100,
    stoppedMs: 50,
    idleMs: 25,
    approximate: false,
  };

  function makeService(overrides?: { production?: number }) {
    const machinesService = {
      getDashboardStats: jest.fn().mockResolvedValue(baseStats),
    };
    const utilizationService = {
      getFactoryUtilization: jest.fn().mockResolvedValue(utilization),
    };
    const eventsService = {
      sumProductionInWindow: jest
        .fn()
        .mockResolvedValue(overrides?.production ?? 7),
    };
    const service = new DashboardService(
      machinesService as never,
      utilizationService as never,
      eventsService as never,
    );
    return { service, eventsService };
  }

  it('merges machine stats with the rolling-24h additions', async () => {
    const { service } = makeService();

    await expect(service.getStats()).resolves.toEqual({
      ...baseStats,
      last24h: { productionCount: 7, ...utilization },
    });
  });

  it('passes a bounded [now-24h, now] window to the production sum', async () => {
    const { service, eventsService } = makeService();
    const before = Date.now();

    await service.getStats();

    const [[sinceIso, untilIso]] = eventsService.sumProductionInWindow.mock
      .calls as [[string, string]];
    const since = Date.parse(sinceIso);
    const until = Date.parse(untilIso);
    expect(until - since).toBe(24 * 3600 * 1000);
    expect(since).toBeGreaterThanOrEqual(before - 24 * 3600 * 1000 - 1000);
    expect(until).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('controller delegates to the service', async () => {
    const stats = { machineCount: 0 };
    const service = { getStats: jest.fn().mockResolvedValue(stats) };
    const controller = new DashboardController(
      service as unknown as DashboardService,
    );

    await expect(controller.getStats()).resolves.toBe(stats);
  });
});
