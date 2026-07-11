// Contract types hand-copied from docs/design/api.md (add-frontend-mvp
// design D3). Each type notes its api.md section — when the contract
// changes there, grep the section number here.

// api.md §5.1 Machine
export const MACHINE_STATUSES = [
  'RUNNING',
  'IDLE',
  'WARNING',
  'ERROR',
  'MAINTENANCE',
] as const;
export type MachineStatus = (typeof MACHINE_STATUSES)[number];

export interface Machine {
  machineId: string;
  name: string;
  temperatureThreshold: number;
  status: MachineStatus;
  healthScore: number;
  currentTemperature: number | null;
  productionCount: number;
  lastEventId: string | null;
  lastUpdatedAt: string | null;
}

// api.md §5.2 / docs/design/event-schema.md §3 envelope
export const EVENT_TYPES = [
  'STATUS_CHANGED',
  'TEMPERATURE_REPORTED',
  'ERROR_OCCURRED',
  'MAINTENANCE_REQUIRED',
  'PRODUCTION_COMPLETED',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface MachineEvent {
  eventId: string;
  eventType: EventType;
  schemaVersion: number;
  source: string;
  machineId: string;
  occurredAt: string;
  producedAt: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}

// api.md §2.4 response envelopes
export interface ListResponse<T> {
  data: T[];
}

export interface EventsResponse extends ListResponse<MachineEvent> {
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

// api.md §5.4 AI Summary (machineId present only for MACHINE scope)
export type SummaryScope = 'MACHINE' | 'FACTORY';

export interface AiSummary {
  summaryId: string;
  machineId?: string;
  scope: SummaryScope;
  inputEventIds: string[];
  summary: string;
  recommendedActions: string[];
  model: string;
  createdAt: string;
}

// api.md §4.11 GET /dashboard/stats
export interface DashboardStats {
  machineCount: number;
  statusCounts: Record<MachineStatus, number>;
  totalProductionCount: number;
  averageHealthScore: number | null;
}

// api.md §4.8 POST /simulator/events response
export interface SimulatorAccepted {
  eventId: string;
  status: 'PUBLISHED';
}
