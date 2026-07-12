import { AlertsListController } from './alerts-list.controller';
import { AlertsService } from './alerts.service';

describe('AlertsListController', () => {
  let alertsService: { listAlerts: jest.Mock };
  let controller: AlertsListController;

  beforeEach(() => {
    alertsService = { listAlerts: jest.fn().mockResolvedValue({ data: [] }) };
    controller = new AlertsListController(
      alertsService as unknown as AlertsService,
    );
  });

  it('passes the status filter through with the default limit', async () => {
    await controller.getAlerts('ACTIVE', undefined);
    expect(alertsService.listAlerts).toHaveBeenCalledWith({
      status: 'ACTIVE',
      limit: 20,
    });
  });

  it('caps the limit at the server maximum', async () => {
    await controller.getAlerts(undefined, '5000');
    expect(alertsService.listAlerts).toHaveBeenCalledWith({
      status: undefined,
      limit: 100,
    });
  });

  it('falls back to the default on a non-numeric limit', async () => {
    await controller.getAlerts(undefined, 'abc');
    expect(alertsService.listAlerts).toHaveBeenCalledWith({
      status: undefined,
      limit: 20,
    });
  });
});
