import { MachineProjectionConsumerService } from './machine-projection-consumer.service';

const BASE_EVENT = {
  eventId: 'evt_t1',
  schemaVersion: 1,
  source: 'MACHINE_SIMULATOR',
  machineId: 'M-001',
  occurredAt: '2026-07-11T10:00:00.000Z',
  producedAt: '2026-07-11T10:00:01.000Z',
};

function makeMachine(status: string) {
  return {
    machineId: 'M-001',
    status,
    healthScore: 100,
    temperatureThreshold: 80,
    productionCount: 0,
    currentTemperature: null,
    lastEventId: null,
    lastUpdatedAt: null,
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function makeConsumer(machine: unknown, transitionModel: unknown) {
  const kafka = { consumer: () => ({}) };
  const machineModel = { findOne: jest.fn().mockResolvedValue(machine) };
  return new MachineProjectionConsumerService(
    kafka as never,
    machineModel as never,
    transitionModel as never,
  );
}

function asEvent(event: object) {
  return event as never;
}

describe('machine status transition recording', () => {
  let transitionModel: { create: jest.Mock };

  beforeEach(() => {
    transitionModel = { create: jest.fn().mockResolvedValue(undefined) };
  });

  it('records a transition when an event changes the projected status', async () => {
    const machine = makeMachine('RUNNING');
    const consumer = makeConsumer(machine, transitionModel);

    await consumer['handleMessage'](
      asEvent({
        ...BASE_EVENT,
        eventType: 'ERROR_OCCURRED',
        payload: { errorCode: 'E1', errorMessage: 'boom' },
      }),
    );

    expect(transitionModel.create).toHaveBeenCalledWith({
      machineId: 'M-001',
      fromStatus: 'RUNNING',
      toStatus: 'ERROR',
      at: BASE_EVENT.occurredAt,
      eventId: BASE_EVENT.eventId,
    });
    expect(machine.save).toHaveBeenCalled();
  });

  it('records nothing when the status is unchanged', async () => {
    const machine = makeMachine('RUNNING');
    const consumer = makeConsumer(machine, transitionModel);

    await consumer['handleMessage'](
      asEvent({
        ...BASE_EVENT,
        eventType: 'TEMPERATURE_REPORTED',
        payload: { temperature: 50, unit: 'C' }, // within threshold
      }),
    );

    expect(transitionModel.create).not.toHaveBeenCalled();
    expect(machine.save).toHaveBeenCalled();
  });

  it('swallows a duplicate-eventId transition and still saves the projection', async () => {
    const machine = makeMachine('RUNNING');
    transitionModel.create.mockRejectedValue({ code: 11000 });
    const consumer = makeConsumer(machine, transitionModel);

    await consumer['handleMessage'](
      asEvent({
        ...BASE_EVENT,
        eventType: 'MAINTENANCE_REQUIRED',
        payload: { maintenanceType: 'PREVENTIVE', reason: 'due' },
      }),
    );

    expect(machine.save).toHaveBeenCalled();
  });

  it('swallows non-duplicate transition failures and still saves the projection (design D7)', async () => {
    const machine = makeMachine('RUNNING');
    transitionModel.create.mockRejectedValue(new Error('validation failed'));
    const consumer = makeConsumer(machine, transitionModel);

    await consumer['handleMessage'](
      asEvent({
        ...BASE_EVENT,
        eventType: 'ERROR_OCCURRED',
        payload: { errorCode: 'E1', errorMessage: 'boom' },
      }),
    );

    // The transition is best-effort; the primary projection must still save
    // so the event's status/health update is never lost to a poison-pill
    // classification.
    expect(machine.save).toHaveBeenCalled();
  });
});
