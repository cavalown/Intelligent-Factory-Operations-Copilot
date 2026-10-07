import { DEMO_MACHINES, MachineSeedService } from './machine-seed.service';

describe('MachineSeedService', () => {
  it('defines at least eight unique demo machines with valid profiles', () => {
    expect(DEMO_MACHINES).toHaveLength(8);
    expect(new Set(DEMO_MACHINES.map(({ machineId }) => machineId)).size).toBe(
      DEMO_MACHINES.length,
    );

    for (const machine of DEMO_MACHINES) {
      expect(machine.machineId).toMatch(/^M-\d{3}$/);
      expect(machine.name).not.toHaveLength(0);
      expect(machine.temperatureThreshold).toBeGreaterThan(0);
    }
  });

  it('uses setOnInsert so restarting never resets projection state', async () => {
    const updateOne = jest.fn().mockResolvedValue({ acknowledged: true });
    const service = new MachineSeedService({ updateOne } as never);

    await service.onModuleInit();

    expect(updateOne).toHaveBeenCalledTimes(DEMO_MACHINES.length);
    for (const call of updateOne.mock.calls) {
      const [, update, options] = call as [
        unknown,
        Record<string, unknown>,
        Record<string, unknown>,
      ];
      expect(update).toHaveProperty('$setOnInsert');
      expect(update).not.toHaveProperty('$set');
      expect(options).toEqual({ upsert: true });
    }
  });
});
