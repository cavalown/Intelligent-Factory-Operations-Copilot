import { api } from './client';
import type { EventType, SimulatorAccepted } from './types';

// api.md §4.8 — the simulator owns envelope construction (add-frontend-mvp
// design D5): complete envelope built client-side, backend only validates.
export function publishSimulatorEvent(input: {
  machineId: string;
  eventType: EventType;
  payload: Record<string, unknown>;
}): Promise<SimulatorAccepted> {
  const now = new Date().toISOString();
  return api('/simulator/events', {
    method: 'POST',
    body: JSON.stringify({
      eventId: `evt_${crypto.randomUUID()}`,
      eventType: input.eventType,
      schemaVersion: 1,
      source: 'MACHINE_SIMULATOR',
      machineId: input.machineId,
      occurredAt: now,
      producedAt: now,
      correlationId: `corr_${crypto.randomUUID()}`,
      payload: input.payload,
    }),
  });
}
