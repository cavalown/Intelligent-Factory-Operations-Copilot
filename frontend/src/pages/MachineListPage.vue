<script setup lang="ts">
import { computed, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import {
  NCard,
  NDataTable,
  NEmpty,
  NSkeleton,
  NTag,
  NText,
  type DataTableColumns,
} from 'naive-ui';
import { listMachines } from '../api/machines';
import {
  MACHINE_STATUSES,
  type Machine,
  type MachineStatus,
} from '../api/types';
import { formatTemperature, formatTimestamp } from '../format';
import { useViewport } from '../composables/useViewport';
import MachineStatusTag from '../components/MachineStatusTag.vue';

const route = useRoute();
const router = useRouter();
const { isPhone } = useViewport();

const machinesQuery = useQuery({
  queryKey: ['machines'],
  queryFn: listMachines,
});

// Drill-down filter via URL state (dashboard-operational-metrics design D5);
// filtered client-side at MVP machine counts — the URL shape is the stable
// interface. Applies to both the table and the phone card renderings.
const statusFilter = computed<MachineStatus | null>(() => {
  const raw = route.query.status;
  return typeof raw === 'string' &&
    (MACHINE_STATUSES as readonly string[]).includes(raw)
    ? (raw as MachineStatus)
    : null;
});

const machines = computed(() => {
  const all = machinesQuery.data.value?.data ?? [];
  return statusFilter.value === null
    ? all
    : all.filter((m) => m.status === statusFilter.value);
});

function clearFilter() {
  router.replace({ name: 'machines' });
}

function goDetail(machineId: string) {
  router.push({ name: 'machine-detail', params: { id: machineId } });
}

// mvp.md Machine List: name, status, current temperature, health score,
// last updated. Cell shaping shared with the card rendering via format.ts
// (add-responsive-ui design D3 — two renderings, one source of truth).
const columns: DataTableColumns<Machine> = [
  { title: 'Machine', key: 'machineId', width: 110 },
  { title: 'Name', key: 'name' },
  {
    title: 'Status',
    key: 'status',
    width: 140,
    render: (row) => h(MachineStatusTag, { status: row.status }),
  },
  {
    title: 'Temperature',
    key: 'currentTemperature',
    width: 120,
    render: (row) => formatTemperature(row.currentTemperature),
  },
  { title: 'Health Score', key: 'healthScore', width: 120 },
  {
    title: 'Last Updated',
    key: 'lastUpdatedAt',
    width: 190,
    render: (row) => formatTimestamp(row.lastUpdatedAt),
  },
];

function rowProps(row: Machine) {
  return {
    style: 'cursor: pointer',
    onClick: () => goDetail(row.machineId),
  };
}
</script>

<template>
  <NCard title="Machines" size="small">
    <template #header-extra>
      <NTag
        v-if="statusFilter !== null"
        closable
        type="info"
        size="small"
        @close="clearFilter"
      >
        Status: {{ statusFilter }}
      </NTag>
    </template>

    <!-- Phone: touch-friendly cards (add-responsive-ui design D3). Loading
         and empty states mirror what NDataTable provides built-in on the
         table branch (review fix — a blank page is indistinguishable from a
         broken one on a slow floor connection). -->
    <NSkeleton
      v-if="isPhone && machinesQuery.isLoading.value"
      text
      :repeat="3"
    />
    <NEmpty
      v-else-if="isPhone && machines.length === 0"
      :description="
        statusFilter === null
          ? 'No machines.'
          : `No machines with status ${statusFilter}.`
      "
    />
    <div v-else-if="isPhone" class="machine-cards">
      <button
        v-for="m in machines"
        :key="m.machineId"
        class="machine-card"
        type="button"
        @click="goDetail(m.machineId)"
      >
        <div class="machine-card-head">
          <MachineStatusTag :status="m.status" />
          <strong class="machine-card-name">{{ m.name }}</strong>
          <NText depth="3" class="machine-card-id">{{ m.machineId }}</NText>
        </div>
        <div class="machine-card-metrics">
          <span>{{ formatTemperature(m.currentTemperature) }}</span>
          <span>Health {{ m.healthScore }}</span>
          <NText depth="3">{{ formatTimestamp(m.lastUpdatedAt) }}</NText>
        </div>
      </button>
    </div>

    <NDataTable
      v-else
      :columns="columns"
      :data="machines"
      :loading="machinesQuery.isLoading.value"
      :row-key="(row: Machine) => row.machineId"
      :row-props="rowProps"
      size="small"
      :bordered="false"
    />
  </NCard>
</template>

<style scoped>
.machine-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.machine-card {
  display: block;
  width: 100%;
  text-align: left;
  border: 1px solid #e5e5ea;
  border-radius: 8px;
  background: #fff;
  padding: 12px 14px;
  min-height: 64px; /* touch-sized target */
  cursor: pointer;
}
.machine-card:active {
  background: #f5f5f7;
}
.machine-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.machine-card-name {
  font-size: 15px;
}
.machine-card-id {
  margin-left: auto;
  font-size: 12px;
}
.machine-card-metrics {
  display: flex;
  gap: 14px;
  margin-top: 8px;
  font-size: 13px;
  flex-wrap: wrap;
}
</style>
