import { api } from './client';
import type { Alert, ListResponse } from './types';

type AlertStatus = Alert['status'];

// api.md — cross-machine alert read (Dashboard Active Alerts widget).
// `status` accepts one value or several (joined with a comma, api.md §4.13's
// multi-status filter, add-alert-lifecycle design D3).
export function listAlerts(query?: {
  status?: AlertStatus | AlertStatus[];
  limit?: number;
}): Promise<ListResponse<Alert>> {
  const params = new URLSearchParams();
  if (query?.status) {
    const status = Array.isArray(query.status)
      ? query.status.join(',')
      : query.status;
    params.set('status', status);
  }
  if (query?.limit !== undefined) params.set('limit', String(query.limit));
  const qs = params.size > 0 ? `?${params.toString()}` : '';
  return api(`/alerts${qs}`);
}

// api.md §4.14 (add-alert-lifecycle)
export function acknowledgeAlert(
  machineId: string,
  alertId: string,
): Promise<Alert> {
  return api(`/machines/${machineId}/alerts/${alertId}/acknowledge`, {
    method: 'POST',
  });
}

// api.md §4.15 (add-alert-lifecycle)
export function resolveAlert(
  machineId: string,
  alertId: string,
): Promise<Alert> {
  return api(`/machines/${machineId}/alerts/${alertId}/resolve`, {
    method: 'POST',
  });
}
