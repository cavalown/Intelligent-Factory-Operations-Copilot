import { RuleEngineConsumerService } from './rule-engine-consumer.service';

const BASE_EVENT = {
  eventId: 'evt_t1',
  schemaVersion: 1,
  source: 'MACHINE_SIMULATOR',
  machineId: 'M-001',
  occurredAt: '2026-07-11T10:00:00.000Z',
  producedAt: '2026-07-11T10:00:01.000Z',
};

function makeMachine(temperatureThreshold: number) {
  return { machineId: 'M-001', temperatureThreshold };
}

function makeConsumer(machine: unknown) {
  const kafka = { consumer: () => ({}) };
  const machinesService = { findRaw: jest.fn().mockResolvedValue(machine) };
  const kafkaProducerService = {
    publish: jest.fn().mockResolvedValue(undefined),
  };
  const consumer = new RuleEngineConsumerService(
    kafka as never,
    machinesService as never,
    kafkaProducerService as never,
  );
  return { consumer, machinesService, kafkaProducerService };
}

function asEvent(event: object) {
  return event as never;
}

describe('RuleEngineConsumerService classification', () => {
  it('classifies temperature above threshold as true and republishes with eventId/key preserved', async () => {
    const { consumer, kafkaProducerService } = makeConsumer(makeMachine(80));

    const processed = await consumer['handleMessage'](
      asEvent({
        ...BASE_EVENT,
        eventType: 'TEMPERATURE_REPORTED',
        payload: { temperature: 88, unit: 'C' },
      }),
    );

    expect(processed).toBe(true);
    expect(kafkaProducerService.publish).toHaveBeenCalledWith(
      'machine.events.enriched',
      'M-001',
      expect.objectContaining({
        eventId: 'evt_t1',
        temperatureExceedsThreshold: true,
      }),
    );
  });

  it('classifies temperature at or below threshold as false', async () => {
    const { consumer, kafkaProducerService } = makeConsumer(makeMachine(80));

    const processed = await consumer['handleMessage'](
      asEvent({
        ...BASE_EVENT,
        eventType: 'TEMPERATURE_REPORTED',
        payload: { temperature: 50, unit: 'C' },
      }),
    );

    expect(processed).toBe(true);
    expect(kafkaProducerService.publish).toHaveBeenCalledWith(
      'machine.events.enriched',
      'M-001',
      expect.objectContaining({ temperatureExceedsThreshold: false }),
    );
  });

  it('republishes an unknown machine unclassified and returns false', async () => {
    const { consumer, kafkaProducerService } = makeConsumer(null);

    const processed = await consumer['handleMessage'](
      asEvent({
        ...BASE_EVENT,
        eventType: 'TEMPERATURE_REPORTED',
        payload: { temperature: 88, unit: 'C' },
      }),
    );

    expect(processed).toBe(false);
    const [, , published] = kafkaProducerService.publish.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(published).not.toHaveProperty('temperatureExceedsThreshold');
  });

  it('republishes a non-finite temperature unclassified, skips the machine lookup, and returns false', async () => {
    const { consumer, kafkaProducerService, machinesService } = makeConsumer(
      makeMachine(80),
    );

    const processed = await consumer['handleMessage'](
      asEvent({
        ...BASE_EVENT,
        eventType: 'TEMPERATURE_REPORTED',
        payload: { temperature: NaN, unit: 'C' },
      }),
    );

    expect(processed).toBe(false);
    expect(machinesService.findRaw).not.toHaveBeenCalled();
    const [, , published] = kafkaProducerService.publish.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(published).not.toHaveProperty('temperatureExceedsThreshold');
  });

  it('classifies STATUS_CHANGED to WARNING as a sensor failure', async () => {
    const { consumer, kafkaProducerService } = makeConsumer(makeMachine(80));

    const processed = await consumer['handleMessage'](
      asEvent({
        ...BASE_EVENT,
        eventType: 'STATUS_CHANGED',
        payload: { currentStatus: 'WARNING' },
      }),
    );

    expect(processed).toBe(true);
    expect(kafkaProducerService.publish).toHaveBeenCalledWith(
      'machine.events.enriched',
      'M-001',
      expect.objectContaining({ isSensorFailure: true }),
    );
  });

  it('classifies STATUS_CHANGED to a non-WARNING status as not a sensor failure', async () => {
    const { consumer, kafkaProducerService } = makeConsumer(makeMachine(80));

    const processed = await consumer['handleMessage'](
      asEvent({
        ...BASE_EVENT,
        eventType: 'STATUS_CHANGED',
        payload: { currentStatus: 'RUNNING' },
      }),
    );

    expect(processed).toBe(true);
    expect(kafkaProducerService.publish).toHaveBeenCalledWith(
      'machine.events.enriched',
      'M-001',
      expect.objectContaining({ isSensorFailure: false }),
    );
  });

  it('republishes an unrelated event type with neither classification field, and returns true', async () => {
    const { consumer, kafkaProducerService } = makeConsumer(makeMachine(80));

    const processed = await consumer['handleMessage'](
      asEvent({
        ...BASE_EVENT,
        eventType: 'PRODUCTION_COMPLETED',
        payload: { quantity: 5 },
      }),
    );

    expect(processed).toBe(true);
    const [, , published] = kafkaProducerService.publish.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(published).not.toHaveProperty('temperatureExceedsThreshold');
    expect(published).not.toHaveProperty('isSensorFailure');
  });
});
