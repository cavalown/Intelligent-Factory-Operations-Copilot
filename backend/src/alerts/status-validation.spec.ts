import { HttpStatus } from '@nestjs/common';
import { ApiError } from '../shared/errors/api-error';
import { AlertsService } from './alerts.service';

describe('alert status query validation (design D8)', () => {
  let alertModel: { find: jest.Mock };
  let service: AlertsService;

  beforeEach(() => {
    alertModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
          exec: jest.fn().mockResolvedValue([]),
        }),
      }),
    };
    service = new AlertsService({} as never, alertModel as never);
  });

  async function expectInvalid(status: string) {
    try {
      await service.listAlerts({ status });
      fail('expected ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiError = err as ApiError;
      expect(apiError.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(
        (apiError.getResponse() as { error: { code: string } }).error.code,
      ).toBe('INVALID_QUERY_PARAMETER');
    }
    expect(alertModel.find).not.toHaveBeenCalled();
  }

  it('rejects an out-of-domain status', async () => {
    await expectInvalid('foo');
  });

  it('rejects wrong-case status values', async () => {
    await expectInvalid('active');
  });

  it('accepts valid statuses and no status', async () => {
    await expect(service.listAlerts({ status: 'ACTIVE' })).resolves.toEqual({
      data: [],
    });
    await expect(service.listAlerts({})).resolves.toEqual({ data: [] });
  });

  // add-alert-lifecycle design D3: status accepts a comma-separated list.
  it('rejects a multi-value status with any invalid segment', async () => {
    await expectInvalid('ACTIVE,foo');
  });

  it('accepts a valid multi-value status and queries with $in', async () => {
    await expect(
      service.listAlerts({ status: 'ACTIVE,ACKNOWLEDGED' }),
    ).resolves.toEqual({ data: [] });
    expect(alertModel.find).toHaveBeenCalledWith({
      status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] },
    });
  });

  it('queries a single value directly, not wrapped in $in', async () => {
    await service.listAlerts({ status: 'ACTIVE' });
    expect(alertModel.find).toHaveBeenCalledWith({ status: 'ACTIVE' });
  });
});
