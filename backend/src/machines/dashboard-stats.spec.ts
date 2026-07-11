import { MachinesService } from './machines.service';
import { DashboardController } from './dashboard.controller';

describe('dashboard stats', () => {
  let machineModel: { aggregate: jest.Mock };
  let service: MachinesService;

  beforeEach(() => {
    machineModel = { aggregate: jest.fn() };
    service = new MachinesService(machineModel as never);
  });

  it('aggregates mixed statuses with zero-filled counts', async () => {
    machineModel.aggregate.mockResolvedValue([
      {
        machineCount: 3,
        totalProductionCount: 145,
        averageHealthScore: 62.6666,
        statuses: ['RUNNING', 'WARNING', 'MAINTENANCE'],
      },
    ]);

    await expect(service.getDashboardStats()).resolves.toEqual({
      machineCount: 3,
      statusCounts: {
        RUNNING: 1,
        IDLE: 0,
        WARNING: 1,
        ERROR: 0,
        MAINTENANCE: 1,
      },
      totalProductionCount: 145,
      averageHealthScore: 62.7,
    });
  });

  it('returns the empty-collection shape with null average', async () => {
    machineModel.aggregate.mockResolvedValue([]);

    await expect(service.getDashboardStats()).resolves.toEqual({
      machineCount: 0,
      statusCounts: {
        RUNNING: 0,
        IDLE: 0,
        WARNING: 0,
        ERROR: 0,
        MAINTENANCE: 0,
      },
      totalProductionCount: 0,
      averageHealthScore: null,
    });
  });

  it('reflects a status change on refetch', async () => {
    machineModel.aggregate
      .mockResolvedValueOnce([
        {
          machineCount: 1,
          totalProductionCount: 0,
          averageHealthScore: 100,
          statuses: ['RUNNING'],
        },
      ])
      .mockResolvedValueOnce([
        {
          machineCount: 1,
          totalProductionCount: 0,
          averageHealthScore: 90,
          statuses: ['WARNING'],
        },
      ]);

    const before = await service.getDashboardStats();
    const after = await service.getDashboardStats();

    expect(before.statusCounts.RUNNING).toBe(1);
    expect(before.statusCounts.WARNING).toBe(0);
    expect(after.statusCounts.RUNNING).toBe(0);
    expect(after.statusCounts.WARNING).toBe(1);
  });

  it('controller delegates to the service', async () => {
    const stats = { machineCount: 0 };
    const mockService = {
      getDashboardStats: jest.fn().mockResolvedValue(stats),
    };
    const controller = new DashboardController(
      mockService as unknown as MachinesService,
    );

    await expect(controller.getStats()).resolves.toBe(stats);
    expect(mockService.getDashboardStats).toHaveBeenCalled();
  });
});
