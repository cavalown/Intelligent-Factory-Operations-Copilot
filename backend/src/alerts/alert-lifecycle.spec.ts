import { HttpStatus } from '@nestjs/common';
import { ApiError } from '../shared/errors/api-error';
import { AlertsService } from './alerts.service';

// add-alert-lifecycle design D1: the allowed-transition table for
// acknowledge/resolve, including the idempotent no-op and rejected-backward
// cases.
describe('alert lifecycle transitions', () => {
  function makeAlert(status: string) {
    return {
      alertId: 'alert_001',
      machineId: 'M-001',
      status,
      acknowledgedAt: null as string | null,
      resolvedAt: null as string | null,
      save: jest.fn().mockResolvedValue(undefined),
    };
  }

  function makeService(alert: ReturnType<typeof makeAlert> | null) {
    const machinesService = {
      assertExists: jest.fn().mockResolvedValue(undefined),
    };
    const alertModel = {
      findOne: jest
        .fn()
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(alert) }),
    };
    const service = new AlertsService(
      machinesService as never,
      alertModel as never,
    );
    return { service, machinesService, alertModel };
  }

  describe('acknowledge', () => {
    it('ACTIVE -> ACKNOWLEDGED, sets acknowledgedAt', async () => {
      const alert = makeAlert('ACTIVE');
      const { service } = makeService(alert);

      const result = await service.acknowledgeAlert('M-001', 'alert_001');

      expect(alert.status).toBe('ACKNOWLEDGED');
      expect(alert.acknowledgedAt).not.toBeNull();
      expect(alert.save).toHaveBeenCalled();
      expect(result.status).toBe('ACKNOWLEDGED');
    });

    it('ACKNOWLEDGED -> acknowledge is an idempotent no-op', async () => {
      const alert = makeAlert('ACKNOWLEDGED');
      alert.acknowledgedAt = '2026-07-01T00:00:00.000Z';
      const { service } = makeService(alert);

      const result = await service.acknowledgeAlert('M-001', 'alert_001');

      expect(alert.save).not.toHaveBeenCalled();
      expect(result.acknowledgedAt).toBe('2026-07-01T00:00:00.000Z');
    });

    it('RESOLVED -> acknowledge is rejected with 409 INVALID_ALERT_TRANSITION', async () => {
      const alert = makeAlert('RESOLVED');
      const { service } = makeService(alert);

      await expect(
        service.acknowledgeAlert('M-001', 'alert_001'),
      ).rejects.toMatchObject({
        response: { error: { code: 'INVALID_ALERT_TRANSITION' } },
      });
      expect(alert.save).not.toHaveBeenCalled();
      expect(alert.status).toBe('RESOLVED');
    });
  });

  describe('resolve', () => {
    it('ACTIVE -> RESOLVED directly, acknowledgedAt stays null', async () => {
      const alert = makeAlert('ACTIVE');
      const { service } = makeService(alert);

      const result = await service.resolveAlert('M-001', 'alert_001');

      expect(alert.status).toBe('RESOLVED');
      expect(alert.resolvedAt).not.toBeNull();
      expect(result.acknowledgedAt).toBeNull();
    });

    it('ACKNOWLEDGED -> RESOLVED, preserves acknowledgedAt', async () => {
      const alert = makeAlert('ACKNOWLEDGED');
      alert.acknowledgedAt = '2026-07-01T00:00:00.000Z';
      const { service } = makeService(alert);

      const result = await service.resolveAlert('M-001', 'alert_001');

      expect(result.status).toBe('RESOLVED');
      expect(result.acknowledgedAt).toBe('2026-07-01T00:00:00.000Z');
      expect(result.resolvedAt).not.toBeNull();
    });

    it('RESOLVED -> resolve is an idempotent no-op', async () => {
      const alert = makeAlert('RESOLVED');
      alert.resolvedAt = '2026-07-01T00:00:00.000Z';
      const { service } = makeService(alert);

      const result = await service.resolveAlert('M-001', 'alert_001');

      expect(alert.save).not.toHaveBeenCalled();
      expect(result.resolvedAt).toBe('2026-07-01T00:00:00.000Z');
    });
  });

  describe('lookup failures', () => {
    it('unknown machineId -> 404 MACHINE_NOT_FOUND, alert never queried', async () => {
      const machinesService = {
        assertExists: jest
          .fn()
          .mockRejectedValue(
            new ApiError(HttpStatus.NOT_FOUND, 'MACHINE_NOT_FOUND', 'nope'),
          ),
      };
      const alertModel = { findOne: jest.fn() };
      const service = new AlertsService(
        machinesService as never,
        alertModel as never,
      );

      await expect(
        service.acknowledgeAlert('M-999', 'alert_001'),
      ).rejects.toMatchObject({
        response: { error: { code: 'MACHINE_NOT_FOUND' } },
      });
      expect(alertModel.findOne).not.toHaveBeenCalled();
    });

    it('alertId not found for that machine -> 404 ALERT_NOT_FOUND', async () => {
      const { service } = makeService(null);

      await expect(
        service.resolveAlert('M-001', 'alert_999'),
      ).rejects.toMatchObject({
        response: { error: { code: 'ALERT_NOT_FOUND' } },
      });
    });
  });
});
