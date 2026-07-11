import { api } from './client';
import type { AiSummary } from './types';

// api.md §4.6 / §4.9 — GET never triggers an LLM call.
export function getSummary(machineId?: string): Promise<AiSummary> {
  return machineId
    ? api(`/machines/${encodeURIComponent(machineId)}/summary`)
    : api('/summary');
}

// api.md §4.7 / §4.10 — synchronous LLM call; may take seconds and may 502.
export function generateSummary(machineId?: string): Promise<AiSummary> {
  const path = machineId
    ? `/machines/${encodeURIComponent(machineId)}/summary`
    : '/summary';
  return api(path, { method: 'POST' });
}
