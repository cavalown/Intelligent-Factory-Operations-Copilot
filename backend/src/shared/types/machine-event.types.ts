// Event envelope and payload types matching docs/design/event-schema.md.

export const MVP_EVENT_TYPES = [
  'STATUS_CHANGED',
  'TEMPERATURE_REPORTED',
  'ERROR_OCCURRED',
  'MAINTENANCE_REQUIRED',
  'PRODUCTION_COMPLETED',
] as const;

export type MvpEventType = (typeof MVP_EVENT_TYPES)[number];

export interface MachineEventEnvelope<
  TEventType extends MvpEventType = MvpEventType,
  TPayload = unknown,
> {
  eventId: string;
  eventType: TEventType;
  schemaVersion: number;
  source: string;
  machineId: string;
  occurredAt: string;
  producedAt: string;
  correlationId?: string;
  payload: TPayload;
}

// docs/design/event-schema.md §5.1
export interface StatusChangedPayload {
  previousStatus?: string;
  currentStatus: string;
  reason?: string;
}

// Rule Engine's enriched-topic classification field (add-rule-engine
// design.md D3), scoped to STATUS_CHANGED so the type system rejects
// reading/setting it on any other eventType — mirroring how `payload`
// itself is already scoped per event type. Absent on events consumed
// directly from the raw machine.events topic.
export type StatusChangedEvent = MachineEventEnvelope<
  'STATUS_CHANGED',
  StatusChangedPayload
> & { isSensorFailure?: boolean };

// docs/design/event-schema.md §5.2
export interface TemperatureReportedPayload {
  temperature: number;
  unit: string;
}

// See StatusChangedEvent's comment above — same rationale, scoped to
// TEMPERATURE_REPORTED.
export type TemperatureReportedEvent = MachineEventEnvelope<
  'TEMPERATURE_REPORTED',
  TemperatureReportedPayload
> & { temperatureExceedsThreshold?: boolean };

// docs/design/event-schema.md §5.3
export interface ErrorOccurredPayload {
  errorCode: string;
  errorMessage: string;
  recoverable?: boolean;
}

export type ErrorOccurredEvent = MachineEventEnvelope<
  'ERROR_OCCURRED',
  ErrorOccurredPayload
>;

// docs/design/event-schema.md §5.4
export interface MaintenanceRequiredPayload {
  maintenanceType: string;
  reason: string;
}

export type MaintenanceRequiredEvent = MachineEventEnvelope<
  'MAINTENANCE_REQUIRED',
  MaintenanceRequiredPayload
>;

// docs/design/event-schema.md §5.5
export interface ProductionCompletedPayload {
  quantity: number;
  batchId?: string;
}

export type ProductionCompletedEvent = MachineEventEnvelope<
  'PRODUCTION_COMPLETED',
  ProductionCompletedPayload
>;

export type MachineEvent =
  | StatusChangedEvent
  | TemperatureReportedEvent
  | ErrorOccurredEvent
  | MaintenanceRequiredEvent
  | ProductionCompletedEvent;
