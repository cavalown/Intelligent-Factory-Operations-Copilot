import { api } from './client';
import type { ListResponse, Machine, Utilization } from './types';

// api.md §4.1
export function listMachines(): Promise<ListResponse<Machine>> {
  return api('/machines');
}

// api.md §4.2
export function getMachine(machineId: string): Promise<Machine> {
  return api(`/machines/${encodeURIComponent(machineId)}`);
}

// api.md — rolling-24h time-in-status
export function getUtilization(machineId: string): Promise<Utilization> {
  return api(`/machines/${encodeURIComponent(machineId)}/utilization`);
}
