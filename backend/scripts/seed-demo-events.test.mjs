import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDemoEvents,
  REQUIRED_MACHINE_IDS,
  seedDemoEvents,
} from './seed-demo-events.mjs';

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function createFetch({
  existingIds = [],
  machineIds = REQUIRED_MACHINE_IDS,
} = {}) {
  const posts = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/machines')) {
      return jsonResponse({
        data: machineIds.map((machineId) => ({ machineId })),
      });
    }
    if (parsed.pathname.endsWith('/events')) {
      return jsonResponse({
        data: existingIds.map((eventId) => ({ eventId })),
        pagination: { limit: 100, nextCursor: null, hasMore: false },
      });
    }
    if (parsed.pathname.endsWith('/simulator/events')) {
      posts.push(JSON.parse(options.body));
      return jsonResponse(
        { eventId: posts.at(-1).eventId, status: 'PUBLISHED' },
        202,
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
  return { fetchImpl, posts };
}

test('dataset covers every machine and every MVP event type', () => {
  const events = buildDemoEvents(new Date('2026-10-07T12:00:00.000Z'));
  assert.equal(
    new Set(events.map(({ eventId }) => eventId)).size,
    events.length,
  );
  assert.deepEqual(
    new Set(events.map(({ eventType }) => eventType)),
    new Set([
      'STATUS_CHANGED',
      'TEMPERATURE_REPORTED',
      'ERROR_OCCURRED',
      'MAINTENANCE_REQUIRED',
      'PRODUCTION_COMPLETED',
    ]),
  );
  assert.deepEqual(
    new Set(events.map(({ machineId }) => machineId)),
    new Set(REQUIRED_MACHINE_IDS),
  );
});

test('publishes only events absent from history', async () => {
  const allEvents = buildDemoEvents();
  const existingIds = allEvents.slice(0, 3).map(({ eventId }) => eventId);
  const { fetchImpl, posts } = createFetch({ existingIds });
  const result = await seedDemoEvents({ fetchImpl, log: () => undefined });
  assert.deepEqual(result, {
    published: allEvents.length - existingIds.length,
    skipped: existingIds.length,
    total: allEvents.length,
  });
  assert.equal(
    posts.some(({ eventId }) => existingIds.includes(eventId)),
    false,
  );
});

test('a complete rerun publishes nothing', async () => {
  const allEvents = buildDemoEvents();
  const { fetchImpl, posts } = createFetch({
    existingIds: allEvents.map(({ eventId }) => eventId),
  });
  const result = await seedDemoEvents({ fetchImpl, log: () => undefined });
  assert.deepEqual(result, {
    published: 0,
    skipped: allEvents.length,
    total: allEvents.length,
  });
  assert.equal(posts.length, 0);
});

test('missing roster fails with a rebuild instruction', async () => {
  const { fetchImpl } = createFetch({ machineIds: ['M-001'] });
  await assert.rejects(
    seedDemoEvents({ fetchImpl, log: () => undefined }),
    /Missing demo machines:.*docker compose up -d --build backend/,
  );
});

test('unreachable backend reports the attempted URL', async () => {
  await assert.rejects(
    seedDemoEvents({
      apiBase: 'http://localhost:3999/api',
      fetchImpl: async () => {
        throw new Error('connection refused');
      },
      log: () => undefined,
    }),
    /Could not reach http:\/\/localhost:3999\/api\/machines: connection refused/,
  );
});
