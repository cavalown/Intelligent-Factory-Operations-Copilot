import { HttpStatus } from '@nestjs/common';
import { ApiError } from '../shared/errors/api-error';
import { SimulatorService } from './simulator.service';

const VALID_EVENT = {
  eventId: 'evt_ts_001',
  eventType: 'PRODUCTION_COMPLETED',
  schemaVersion: 1,
  source: 'MACHINE_SIMULATOR',
  machineId: 'M-001',
  occurredAt: '2026-07-11T10:00:00.000Z',
  producedAt: '2026-07-11T10:00:01.000Z',
  payload: { quantity: 1 },
};

describe('simulator timestamp validation (design D6)', () => {
  let machinesService: { exists: jest.Mock };
  let kafkaProducer: { publish: jest.Mock };
  let service: SimulatorService;

  beforeEach(() => {
    machinesService = { exists: jest.fn().mockResolvedValue(true) };
    kafkaProducer = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new SimulatorService(
      machinesService as never,
      kafkaProducer as never,
    );
  });

  async function expectRejected(event: Record<string, unknown>) {
    try {
      await service.ingestEvent(event);
      fail('expected ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiError = err as ApiError;
      expect(apiError.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(
        (apiError.getResponse() as { error: { code: string } }).error.code,
      ).toBe('INVALID_EVENT_ENVELOPE');
    }
    expect(kafkaProducer.publish).not.toHaveBeenCalled();
  }

  it('accepts canonical ISO-8601 UTC timestamps', async () => {
    await expect(service.ingestEvent({ ...VALID_EVENT })).resolves.toEqual({
      eventId: 'evt_ts_001',
      status: 'PUBLISHED',
    });
    expect(kafkaProducer.publish).toHaveBeenCalled();
  });

  it('rejects offset-form timestamps', async () => {
    await expectRejected({
      ...VALID_EVENT,
      occurredAt: '2026-07-11T10:00:00+00:00',
    });
  });

  it('rejects millisecond-less timestamps', async () => {
    await expectRejected({
      ...VALID_EVENT,
      producedAt: '2026-07-11T10:00:01Z',
    });
  });

  it('rejects shape-valid but impossible instants', async () => {
    await expectRejected({
      ...VALID_EVENT,
      occurredAt: '2026-13-01T00:00:00.000Z',
    });
  });

  it('rejects empty-string timestamps', async () => {
    await expectRejected({ ...VALID_EVENT, occurredAt: '' });
  });
});
