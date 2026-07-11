<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { NCard, NGrid, NGridItem, NStatistic } from 'naive-ui';
import { getDashboardStats } from '../api/stats';
import { listEvents } from '../api/events';
import AiSummaryCard from '../components/AiSummaryCard.vue';
import EventsTable from '../components/EventsTable.vue';

const statsQuery = useQuery({
  queryKey: ['dashboard-stats'],
  queryFn: getDashboardStats,
});

const eventsQuery = useQuery({
  queryKey: ['events', { recent: true }],
  queryFn: () => listEvents({ limit: 10 }),
});

// mvp.md Dashboard tiles; "Critical Machines" maps to statusCounts.ERROR
// (api.md §4.11).
const tiles = computed(() => {
  const stats = statsQuery.data.value;
  return [
    { label: 'Machines', value: stats?.machineCount },
    { label: 'Running', value: stats?.statusCounts.RUNNING },
    { label: 'Warning', value: stats?.statusCounts.WARNING },
    { label: 'Critical', value: stats?.statusCounts.ERROR },
    { label: 'Production Count', value: stats?.totalProductionCount },
    { label: 'Avg Health Score', value: stats?.averageHealthScore ?? undefined },
  ];
});
</script>

<template>
  <NGrid :cols="6" :x-gap="12" :y-gap="12" item-responsive responsive="screen">
    <NGridItem v-for="tile in tiles" :key="tile.label" span="6 s:3 m:1">
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
    <AiSummaryCard class="dashboard-summary" />
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
}
.dashboard-summary {
  flex: 2;
}
</style>
