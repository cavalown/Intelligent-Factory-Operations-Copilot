import { api } from './client';
import type { Alert, ListResponse } from './types';

// api.md — cross-machine alert read (Dashboard Active Alerts widget).
export function listAlerts(query?: {
  status?: 'ACTIVE' | 'RESOLVED';
  limit?: number;
}): Promise<ListResponse<Alert>> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.limit !== undefined) params.set('limit', String(query.limit));
  const qs = params.size > 0 ? `?${params.toString()}` : '';
  return api(`/alerts${qs}`);
}
