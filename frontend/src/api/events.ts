import { api } from './client';
import type { EventsResponse } from './types';

// api.md §4.3 (per-machine) and §4.4 (cross-machine) share shape and params.
export function listEvents(query?: {
  machineId?: string;
  limit?: number;
  before?: string;
}): Promise<EventsResponse> {
  const params = new URLSearchParams();
  if (query?.limit !== undefined) params.set('limit', String(query.limit));
  if (query?.before) params.set('before', query.before);
  const qs = params.size > 0 ? `?${params.toString()}` : '';

  return query?.machineId
    ? api(`/machines/${encodeURIComponent(query.machineId)}/events${qs}`)
    : api(`/events${qs}`);
}
