<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import {
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NResult,
  NSkeleton,
} from 'naive-ui';
import { ApiError } from '../api/client';
import { getMachine, getUtilization } from '../api/machines';
import { listEvents } from '../api/events';
import { formatDuration, formatTimestamp } from '../format';
import { useViewport } from '../composables/useViewport';
import AiSummaryCard from '../components/AiSummaryCard.vue';
import EventsTable from '../components/EventsTable.vue';
import MachineStatusTag from '../components/MachineStatusTag.vue';

const route = useRoute();
const machineId = computed(() => String(route.params.id));
const { isPhone, isTablet } = useViewport();

// 1 / 2 / 3 description columns by band (add-responsive-ui design D5)
const descriptionColumns = computed(() =>
  isPhone.value ? 1 : isTablet.value ? 2 : 3,
);

const machineQuery = useQuery({
  queryKey: computed(() => ['machine', machineId.value]),
  queryFn: () => getMachine(machineId.value),
  retry: false,
});

const eventsQuery = useQuery({
  queryKey: computed(() => ['events', { machineId: machineId.value }]),
  queryFn: () => listEvents({ machineId: machineId.value, limit: 20 }),
  enabled: computed(() => machineQuery.isSuccess.value),
});

const utilizationQuery = useQuery({
  queryKey: computed(() => ['utilization', machineId.value]),
  queryFn: () => getUtilization(machineId.value),
  enabled: computed(() => machineQuery.isSuccess.value),
});

const notFound = computed(
  () =>
    machineQuery.error.value instanceof ApiError &&
    machineQuery.error.value.code === 'MACHINE_NOT_FOUND',
);
</script>

<template>
  <NResult
    v-if="notFound"
    status="404"
    title="Machine not found"
    :description="`No machine with id ${machineId} exists.`"
  >
    <template #footer>
      <NButton @click="$router.push({ name: 'machines' })">
        Back to Machine List
      </NButton>
    </template>
  </NResult>

  <template v-else>
    <NCard :title="machineQuery.data.value?.name ?? machineId" size="small">
      <NSkeleton v-if="machineQuery.isLoading.value" text :repeat="3" />
      <NDescriptions
        v-else-if="machineQuery.data.value"
        :column="descriptionColumns"
        size="small"
      >
        <NDescriptionsItem label="Status">
          <MachineStatusTag :status="machineQuery.data.value.status" />
        </NDescriptionsItem>
        <NDescriptionsItem label="Health Score">
          {{ machineQuery.data.value.healthScore }}
        </NDescriptionsItem>
        <NDescriptionsItem label="Temperature">
          {{
            machineQuery.data.value.currentTemperature === null
              ? '—'
              : `${machineQuery.data.value.currentTemperature} °C (threshold ${machineQuery.data.value.temperatureThreshold})`
          }}
        </NDescriptionsItem>
        <NDescriptionsItem label="Production Count">
          {{ machineQuery.data.value.productionCount }}
        </NDescriptionsItem>
        <NDescriptionsItem label="Machine ID">
          {{ machineQuery.data.value.machineId }}
        </NDescriptionsItem>
        <NDescriptionsItem label="Last Updated">
          {{ formatTimestamp(machineQuery.data.value.lastUpdatedAt) }}
        </NDescriptionsItem>
      </NDescriptions>
      <div v-if="utilizationQuery.data.value" class="utilization-strip">
        Last 24h{{ utilizationQuery.data.value.approximate ? ' (estimated — limited history)' : '' }}:
        <strong>Operating {{ formatDuration(utilizationQuery.data.value.operatingMs) }}</strong>
        · Stopped {{ formatDuration(utilizationQuery.data.value.stoppedMs) }}
        · Idle {{ formatDuration(utilizationQuery.data.value.idleMs) }}
      </div>
    </NCard>

    <div class="detail-row">
      <NCard title="Recent Events" size="small" class="detail-events">
        <EventsTable
          :events="eventsQuery.data.value?.data ?? []"
          :loading="eventsQuery.isLoading.value"
          :show-machine="false"
        />
      </NCard>
      <AiSummaryCard :machine-id="machineId" class="detail-summary" />
    </div>
  </template>
</template>

<style scoped>
.detail-row {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  align-items: flex-start;
}
.detail-events {
  flex: 3;
  min-width: 0; /* let the inner table scroll instead of forcing row width */
}
.detail-summary {
  flex: 2;
}
.utilization-strip {
  margin-top: 12px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
}
/* Below the tablet breakpoint the side-by-side row stacks (design D5).
   Range syntax matches useViewport's complementary bands; canonical
   breakpoint values live in ai/rules/frontend-responsive.md */
@media (width < 1024px) {
  .detail-row {
    flex-direction: column;
    align-items: stretch;
  }
  .detail-events,
  .detail-summary {
    flex: none;
    width: 100%;
  }
}
</style>
