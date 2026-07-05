// Event envelope and payload types matching docs/design/event-schema.md.
// This change implements TEMPERATURE_REPORTED only; the other MVP event types
// are added by a follow-up change (see ai/skills/add-mvp-event-type.md).

export const MVP_EVENT_TYPES = [
  'STATUS_CHANGED',
  'TEMPERATURE_REPORTED',
  'ERROR_OCCURRED',
  'MAINTENANCE_REQUIRED',
  'PRODUCTION_COMPLETED',
] as const;

export type MvpEventType = (typeof MVP_EVENT_TYPES)[number];

// The subset of event types this change actually validates and processes.
export const IMPLEMENTED_EVENT_TYPES = ['TEMPERATURE_REPORTED'] as const;
export type ImplementedEventType = (typeof IMPLEMENTED_EVENT_TYPES)[number];

export interface MachineEventEnvelope<TPayload = unknown> {
  eventId: string;
  eventType: MvpEventType;
  schemaVersion: number;
  source: string;
  machineId: string;
  occurredAt: string;
  producedAt: string;
  correlationId?: string;
  payload: TPayload;
}

// docs/design/event-schema.md §5.2
export interface TemperatureReportedPayload {
  temperature: number;
  unit: string;
}

export type TemperatureReportedEvent =
  MachineEventEnvelope<TemperatureReportedPayload>;
