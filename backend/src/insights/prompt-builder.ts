// Compact prompt construction (add-insights-module design D1). Kept as a pure
// function so the prompt shape is unit-testable without any service wiring.

export interface SummaryContextMachine {
  machineId: string;
  name: string;
  status: string;
  healthScore: number;
  currentTemperature: number | null;
  productionCount: number;
}

export interface SummaryContextEvent {
  eventId: string;
  eventType: string;
  machineId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface SummaryContextAlert {
  machineId: string;
  severity: string;
  status: string;
  message: string;
  createdAt: string;
}

export interface SummaryContext {
  scope: 'MACHINE' | 'FACTORY';
  machines: SummaryContextMachine[];
  events: SummaryContextEvent[];
  alerts: SummaryContextAlert[];
}

export function buildSummaryPrompt(context: SummaryContext): string {
  const lines: string[] = [
    'You are an operations assistant for a smart factory.',
    context.scope === 'MACHINE'
      ? 'Summarize the recent operational condition of the machine below.'
      : 'Summarize the recent operational condition of the whole factory.',
    '',
    '## Machine state',
    ...context.machines.map(
      (m) =>
        `- ${m.machineId} (${m.name}): status=${m.status}, ` +
        `healthScore=${m.healthScore}, ` +
        `temperature=${m.currentTemperature ?? 'n/a'}, ` +
        `productionCount=${m.productionCount}`,
    ),
    '',
    '## Active alerts',
    ...(context.alerts.length > 0
      ? context.alerts.map(
          (a) =>
            `- [${a.severity}] ${a.machineId} at ${a.createdAt}: ${a.message}`,
        )
      : ['- none']),
    '',
    '## Recent events (most recent first)',
    ...(context.events.length > 0
      ? context.events.map(
          (e) =>
            `- ${e.occurredAt} ${e.machineId} ${e.eventType} ` +
            `${JSON.stringify(e.payload)}`,
        )
      : ['- none']),
    '',
    'Respond with JSON: {"summary": string, "recommendedActions": string[]}.',
    'Keep the summary under 120 words and actions concrete and operational.',
  ];

  return lines.join('\n');
}
