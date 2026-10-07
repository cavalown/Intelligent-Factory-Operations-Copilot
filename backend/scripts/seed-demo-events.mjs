import { pathToFileURL } from 'node:url';

export const REQUIRED_MACHINE_IDS = [
  'M-001',
  'M-002',
  'M-003',
  'M-004',
  'M-005',
  'M-006',
  'M-007',
  'M-008',
];

const EVENT_DEFINITIONS = [
  [
    'evt_demo_001',
    -20,
    'M-001',
    'STATUS_CHANGED',
    {
      previousStatus: 'IDLE',
      currentStatus: 'RUNNING',
      reason: 'Morning production shift started.',
    },
  ],
  [
    'evt_demo_002',
    -19,
    'M-002',
    'STATUS_CHANGED',
    {
      previousStatus: 'IDLE',
      currentStatus: 'RUNNING',
      reason: 'Scheduled milling job started.',
    },
  ],
  [
    'evt_demo_003',
    -18,
    'M-001',
    'PRODUCTION_COMPLETED',
    { quantity: 120, batchId: 'BATCH-DEMO-CNC-01' },
  ],
  [
    'evt_demo_004',
    -17,
    'M-002',
    'PRODUCTION_COMPLETED',
    { quantity: 80, batchId: 'BATCH-DEMO-CNC-02' },
  ],
  [
    'evt_demo_005',
    -16,
    'M-003',
    'STATUS_CHANGED',
    {
      previousStatus: 'IDLE',
      currentStatus: 'RUNNING',
      reason: 'Molding cycle started.',
    },
  ],
  [
    'evt_demo_006',
    -15,
    'M-004',
    'STATUS_CHANGED',
    {
      previousStatus: 'IDLE',
      currentStatus: 'RUNNING',
      reason: 'Cutting queue released.',
    },
  ],
  [
    'evt_demo_007',
    -14,
    'M-005',
    'STATUS_CHANGED',
    {
      previousStatus: 'IDLE',
      currentStatus: 'RUNNING',
      reason: 'Assembly cell enabled.',
    },
  ],
  [
    'evt_demo_008',
    -13,
    'M-006',
    'STATUS_CHANGED',
    {
      previousStatus: 'IDLE',
      currentStatus: 'RUNNING',
      reason: 'Packaging line enabled.',
    },
  ],
  [
    'evt_demo_009',
    -12,
    'M-005',
    'PRODUCTION_COMPLETED',
    { quantity: 60, batchId: 'BATCH-DEMO-ASSEMBLY-01' },
  ],
  [
    'evt_demo_010',
    -11,
    'M-008',
    'STATUS_CHANGED',
    {
      previousStatus: 'IDLE',
      currentStatus: 'RUNNING',
      reason: 'Heat treatment cycle started.',
    },
  ],
  [
    'evt_demo_011',
    -10,
    'M-006',
    'PRODUCTION_COMPLETED',
    { quantity: 200, batchId: 'BATCH-DEMO-PACK-01' },
  ],
  [
    'evt_demo_012',
    -8,
    'M-008',
    'PRODUCTION_COMPLETED',
    { quantity: 45, batchId: 'BATCH-DEMO-OVEN-01' },
  ],
  [
    'evt_demo_013',
    -5,
    'M-007',
    'STATUS_CHANGED',
    {
      previousStatus: 'IDLE',
      currentStatus: 'WARNING',
      reason: 'Pressure sensor reading is unstable.',
    },
  ],
  [
    'evt_demo_014',
    -4,
    'M-004',
    'MAINTENANCE_REQUIRED',
    {
      maintenanceType: 'OPTICS_INSPECTION',
      reason: 'Laser lens cleaning interval reached.',
    },
  ],
  [
    'evt_demo_015',
    -3,
    'M-003',
    'ERROR_OCCURRED',
    {
      errorCode: 'MOLD_PRESSURE_HIGH',
      errorMessage: 'Injection pressure exceeded the safe operating range.',
      recoverable: true,
    },
  ],
  [
    'evt_demo_016',
    -2,
    'M-002',
    'TEMPERATURE_REPORTED',
    { temperature: 88, unit: 'C' },
  ],
  [
    'evt_demo_017',
    -1.5,
    'M-005',
    'STATUS_CHANGED',
    {
      previousStatus: 'RUNNING',
      currentStatus: 'IDLE',
      reason: 'Assembly batch completed.',
    },
  ],
  [
    'evt_demo_018',
    -1,
    'M-001',
    'TEMPERATURE_REPORTED',
    { temperature: 68, unit: 'C' },
  ],
  [
    'evt_demo_019',
    -0.75,
    'M-006',
    'TEMPERATURE_REPORTED',
    { temperature: 58, unit: 'C' },
  ],
  [
    'evt_demo_020',
    -0.5,
    'M-008',
    'TEMPERATURE_REPORTED',
    { temperature: 162, unit: 'C' },
  ],
];

export function buildDemoEvents(now = new Date()) {
  return EVENT_DEFINITIONS.map(
    ([eventId, hoursAgo, machineId, eventType, payload]) => {
      const occurredAt = new Date(
        now.getTime() + Number(hoursAgo) * 60 * 60 * 1000,
      );
      const producedAt = new Date(occurredAt.getTime() + 1000);
      return {
        eventId,
        eventType,
        schemaVersion: 1,
        source: 'MACHINE_SIMULATOR',
        machineId,
        occurredAt: occurredAt.toISOString(),
        producedAt: producedAt.toISOString(),
        correlationId: `corr_${eventId}`,
        payload,
      };
    },
  );
}

function normalizeApiBase(value) {
  return value.replace(/\/+$/, '');
}

async function requestJson(fetchImpl, url, options) {
  let response;
  try {
    response = await fetchImpl(url, options);
  } catch (error) {
    throw new Error(`Could not reach ${url}: ${error.message}`);
  }

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const apiMessage = body?.error?.message ?? body?.message ?? text;
    throw new Error(
      `Request failed (${response.status}) ${url}${apiMessage ? `: ${apiMessage}` : ''}`,
    );
  }
  return body;
}

async function findExistingDemoEventIds(fetchImpl, apiBase, targetIds) {
  const found = new Set();
  let before = null;
  do {
    const query = new URLSearchParams({ limit: '100' });
    if (before) query.set('before', before);
    const page = await requestJson(
      fetchImpl,
      `${apiBase}/events?${query.toString()}`,
    );
    for (const event of page.data ?? []) {
      if (targetIds.has(event.eventId)) found.add(event.eventId);
    }
    if (found.size === targetIds.size || !page.pagination?.hasMore) break;
    before = page.pagination.nextCursor;
  } while (before);
  return found;
}

export async function seedDemoEvents({
  apiBase = process.env.IFOC_API_BASE_URL ?? 'http://localhost:3000/api',
  fetchImpl = globalThis.fetch,
  now = new Date(),
  log = console.log,
} = {}) {
  const base = normalizeApiBase(apiBase);
  const machinesResponse = await requestJson(fetchImpl, `${base}/machines`);
  const actualMachineIds = new Set(
    (machinesResponse.data ?? []).map(({ machineId }) => machineId),
  );
  const missingMachines = REQUIRED_MACHINE_IDS.filter(
    (machineId) => !actualMachineIds.has(machineId),
  );
  if (missingMachines.length > 0) {
    throw new Error(
      `Missing demo machines: ${missingMachines.join(', ')}. Rebuild and restart the backend first: docker compose up -d --build backend`,
    );
  }

  const events = buildDemoEvents(now);
  const targetIds = new Set(events.map(({ eventId }) => eventId));
  const existingIds = await findExistingDemoEventIds(
    fetchImpl,
    base,
    targetIds,
  );
  let published = 0;
  let skipped = 0;
  for (const event of events) {
    if (existingIds.has(event.eventId)) {
      skipped += 1;
      continue;
    }
    await requestJson(fetchImpl, `${base}/simulator/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
    });
    published += 1;
    log(`Published ${event.eventId} (${event.eventType}, ${event.machineId})`);
  }

  log(
    `Demo seed complete: ${published} published, ${skipped} already present. ` +
      'Kafka consumers may need a few seconds to update the dashboard.',
  );
  return { published, skipped, total: events.length };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  seedDemoEvents().catch((error) => {
    console.error(`Demo seed failed: ${error.message}`);
    process.exitCode = 1;
  });
}
