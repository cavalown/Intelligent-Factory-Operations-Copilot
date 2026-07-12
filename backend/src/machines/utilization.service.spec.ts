import {
  UtilizationService,
  UTILIZATION_WINDOW_MS,
} from './utilization.service';

const NOW = Date.parse('2026-07-11T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function isoAt(msBeforeNow: number) {
  return new Date(NOW - msBeforeNow).toISOString();
}

function queryChain(result: unknown) {
  return {
    sort: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(result),
        }),
      }),
    }),
  };
}

describe('UtilizationService', () => {
  let machinesService: { getMachine: jest.Mock; listMachines: jest.Mock };
  let transitionModel: { find: jest.Mock; findOne: jest.Mock };
  let service: UtilizationService;

  function mockTransitions(inWindow: unknown[], beforeWindow: unknown = null) {
    transitionModel.find.mockReturnValue(queryChain(inWindow));
    transitionModel.findOne.mockReturnValue(queryChain(beforeWindow));
  }

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    machinesService = {
      getMachine: jest
        .fn()
        .mockResolvedValue({ machineId: 'M-001', status: 'RUNNING' }),
      listMachines: jest.fn(),
    };
    transitionModel = { find: jest.fn(), findOne: jest.fn() };
    service = new UtilizationService(
      machinesService as never,
      transitionModel as never,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('splits the window along the transition timeline and sums to 24h', async () => {
    mockTransitions([
      { fromStatus: 'RUNNING', toStatus: 'ERROR', at: isoAt(6 * HOUR) },
    ]);

    const result = await service.getMachineUtilization('M-001');

    expect(result.operatingMs).toBe(18 * HOUR);
    expect(result.stoppedMs).toBe(6 * HOUR);
    expect(result.idleMs).toBe(0);
    expect(result.approximate).toBe(false);
    expect(result.operatingMs + result.stoppedMs + result.idleMs).toBe(
      UTILIZATION_WINDOW_MS,
    );
    // In-window transitions supply the window-start status — no pre-window
    // query is issued (design D10).
    expect(transitionModel.findOne).not.toHaveBeenCalled();
  });

  it('falls back to the pre-window transition only when the window is empty', async () => {
    mockTransitions([], {
      fromStatus: 'IDLE',
      toStatus: 'MAINTENANCE',
      at: isoAt(30 * HOUR),
    });

    const result = await service.getMachineUtilization('M-001');

    expect(result.stoppedMs).toBe(UTILIZATION_WINDOW_MS);
    expect(result.approximate).toBe(false); // real history, not bootstrap
    expect(transitionModel.findOne).toHaveBeenCalled();
  });

  it('flags the bootstrap approximation when no transitions exist at all', async () => {
    machinesService.getMachine.mockResolvedValue({
      machineId: 'M-001',
      status: 'ERROR',
    });
    mockTransitions([], null);

    const result = await service.getMachineUtilization('M-001');

    expect(result.stoppedMs).toBe(UTILIZATION_WINDOW_MS);
    expect(result.approximate).toBe(true);
  });

  it('skips unparseable transition timestamps without poisoning the buckets', async () => {
    mockTransitions([
      { fromStatus: 'RUNNING', toStatus: 'IDLE', at: '2026-07-11T99:99Z' },
      { fromStatus: 'RUNNING', toStatus: 'ERROR', at: isoAt(6 * HOUR) },
    ]);

    const result = await service.getMachineUtilization('M-001');

    expect(Number.isFinite(result.operatingMs)).toBe(true);
    expect(result.operatingMs).toBe(18 * HOUR);
    expect(result.stoppedMs).toBe(6 * HOUR);
  });

  it('re-sorts transitions numerically so ordering never depends on string sort', async () => {
    // Deliberately out of order as returned by the store.
    mockTransitions([
      { fromStatus: 'ERROR', toStatus: 'RUNNING', at: isoAt(2 * HOUR) },
      { fromStatus: 'RUNNING', toStatus: 'ERROR', at: isoAt(6 * HOUR) },
    ]);

    const result = await service.getMachineUtilization('M-001');

    expect(result.operatingMs).toBe(20 * HOUR); // 18h head + 2h tail
    expect(result.stoppedMs).toBe(4 * HOUR);
    expect(result.operatingMs + result.stoppedMs + result.idleMs).toBe(
      UTILIZATION_WINDOW_MS,
    );
  });

  it('sums per-machine buckets and ORs the approximate flag for the factory view', async () => {
    machinesService.listMachines.mockResolvedValue({
      data: [
        { machineId: 'M-001', status: 'RUNNING' },
        { machineId: 'M-002', status: 'IDLE' },
      ],
    });
    mockTransitions([], null); // both machines: bootstrap approximation

    const result = await service.getFactoryUtilization();

    expect(result.operatingMs).toBe(UTILIZATION_WINDOW_MS);
    expect(result.idleMs).toBe(UTILIZATION_WINDOW_MS);
    expect(result.stoppedMs).toBe(0);
    expect(result.approximate).toBe(true);
  });
});
