<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { NCard, NGrid, NGridItem, NStatistic } from 'naive-ui';
import { getDashboardStats } from '../api/stats';
import { listEvents } from '../api/events';
import { formatDuration } from '../format';
import type { MachineStatus } from '../api/types';
import ActiveAlertsCard from '../components/ActiveAlertsCard.vue';
import AiSummaryCard from '../components/AiSummaryCard.vue';
import EventsTable from '../components/EventsTable.vue';

const router = useRouter();

const statsQuery = useQuery({
  queryKey: ['dashboard-stats'],
  queryFn: getDashboardStats,
});

const eventsQuery = useQuery({
  queryKey: ['events', { recent: true }],
  queryFn: () => listEvents({ limit: 10 }),
});

// mvp.md Dashboard tiles; "Critical Machines" maps to statusCounts.ERROR
// (api.md §4.11). Status tiles drill into the filtered Machine List
// (dashboard-operational-metrics design D5).
const tiles = computed(() => {
  const stats = statsQuery.data.value;
  return [
    { label: 'Machines', value: stats?.machineCount },
    { label: 'Running', value: stats?.statusCounts.RUNNING, filter: 'RUNNING' },
    { label: 'Warning', value: stats?.statusCounts.WARNING, filter: 'WARNING' },
    { label: 'Critical', value: stats?.statusCounts.ERROR, filter: 'ERROR' },
    { label: 'Production Count', value: stats?.totalProductionCount },
    { label: 'Avg Health Score', value: stats?.averageHealthScore ?? undefined },
  ] as Array<{ label: string; value?: number; filter?: MachineStatus }>;
});

const last24hTiles = computed(() => {
  const window = statsQuery.data.value?.last24h;
  // '≈' marks the bootstrap approximation (limited transition history).
  const mark = window?.approximate ? '≈' : '';
  return [
    { label: 'Production (24h)', value: window?.productionCount },
    {
      label: 'Operating (24h)',
      value: window ? `${mark}${formatDuration(window.operatingMs)}` : undefined,
    },
    {
      label: 'Stopped (24h)',
      value: window ? `${mark}${formatDuration(window.stoppedMs)}` : undefined,
    },
    {
      label: 'Idle (24h)',
      value: window ? `${mark}${formatDuration(window.idleMs)}` : undefined,
    },
  ];
});

function drillDown(filter?: MachineStatus) {
  if (!filter) return;
  router.push({ name: 'machines', query: { status: filter } });
}
</script>

<template>
  <!-- Phone: 2 tiles per row (span 3 of 6) — stacked full-width KPI tiles
       waste a whole screen; pairs read like a mobile app (design 3.4).
       Tablet: 3 per row (s:2) — deliberate, user decision 2026-07-13:
       tablets read like large phones, denser KPI rows preferred. -->
  <NGrid :cols="6" :x-gap="12" :y-gap="12" item-responsive responsive="screen">
    <NGridItem v-for="tile in tiles" :key="tile.label" span="3 s:2 m:1">
      <NCard
        size="small"
        :class="{ 'tile-clickable': tile.filter !== undefined }"
        @click="drillDown(tile.filter)"
      >
        <NStatistic :label="tile.label" :value="tile.value ?? '—'" />
      </NCard>
    </NGridItem>
  </NGrid>

  <NGrid
    :cols="4"
    :x-gap="12"
    :y-gap="12"
    item-responsive
    responsive="screen"
    style="margin-top: 12px"
  >
    <NGridItem v-for="tile in last24hTiles" :key="tile.label" span="2 s:2 m:1">
      <NCard size="small">
        <NStatistic :label="tile.label" :value="tile.value ?? '—'" />
      </NCard>
    </NGridItem>
  </NGrid>

  <div class="dashboard-row">
    <NCard title="Recent Events" size="small" class="dashboard-events">
      <EventsTable
        :events="eventsQuery.data.value?.data ?? []"
        :loading="eventsQuery.isLoading.value"
      />
    </NCard>
    <div class="dashboard-side">
      <ActiveAlertsCard />
      <AiSummaryCard />
    </div>
  </div>
</template>

<style scoped>
.dashboard-row {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  align-items: flex-start;
}
.dashboard-events {
  flex: 3;
  min-width: 0; /* let the inner table scroll instead of forcing row width */
}
.dashboard-side {
  flex: 2;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
/* Below the tablet breakpoint the side-by-side row stacks (design D5).
   Range syntax matches useViewport's complementary bands; canonical
   breakpoint values live in ai/rules/frontend-responsive.md */
@media (width < 1024px) {
  .dashboard-row {
    flex-direction: column;
    align-items: stretch;
  }
  .dashboard-events,
  .dashboard-side {
    flex: none;
    width: 100%;
  }
}
.tile-clickable {
  cursor: pointer;
}
.tile-clickable:hover {
  border-color: var(--n-color-target, #18a058);
}
</style>
