import { EventsService } from './events.service';

describe('EventsService.sumProductionInWindow', () => {
  function makeService(rows: unknown[]) {
    const machineEventModel = {
      aggregate: jest.fn().mockResolvedValue(rows),
    };
    const machinesService = {};
    const service = new EventsService(
      machinesService as never,
      machineEventModel as never,
    );
    return { service, machineEventModel };
  }

  it('bounds the match to the [since, until] window on both sides', async () => {
    const { service, machineEventModel } = makeService([{ total: 7 }]);

    await expect(
      service.sumProductionInWindow(
        '2026-07-10T12:00:00.000Z',
        '2026-07-11T12:00:00.000Z',
      ),
    ).resolves.toBe(7);

    const [[pipeline]] = machineEventModel.aggregate.mock.calls as [
      [Array<Record<string, unknown>>],
    ];
    // The upper bound keeps future-dated events out of the count so it
    // honors the same window the utilization durations use.
    expect(pipeline[0]).toEqual({
      $match: {
        eventType: 'PRODUCTION_COMPLETED',
        occurredAt: {
          $gte: '2026-07-10T12:00:00.000Z',
          $lte: '2026-07-11T12:00:00.000Z',
        },
      },
    });
  });

  it('returns 0 when no production occurred in the window', async () => {
    const { service } = makeService([]);
    await expect(
      service.sumProductionInWindow(
        '2026-07-10T12:00:00.000Z',
        '2026-07-11T12:00:00.000Z',
      ),
    ).resolves.toBe(0);
  });
});
