import { api } from './client';
import type { DashboardStats } from './types';

// api.md §4.11
export function getDashboardStats(): Promise<DashboardStats> {
  return api('/dashboard/stats');
}
