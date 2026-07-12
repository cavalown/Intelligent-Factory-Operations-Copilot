<script setup lang="ts">
import { computed, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { NCard, NDataTable, NTag, type DataTableColumns } from 'naive-ui';
import { listMachines } from '../api/machines';
import { MACHINE_STATUSES, type Machine, type MachineStatus } from '../api/types';
import MachineStatusTag from '../components/MachineStatusTag.vue';

const route = useRoute();
const router = useRouter();

const machinesQuery = useQuery({
  queryKey: ['machines'],
  queryFn: listMachines,
});

// Drill-down filter via URL state (dashboard-operational-metrics design D5);
// filtered client-side at MVP machine counts — the URL shape is the stable
// interface.
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

// mvp.md Machine List: name, status, current temperature, health score,
// last updated.
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
    render: (row) =>
      row.currentTemperature === null ? '—' : `${row.currentTemperature} °C`,
  },
  { title: 'Health Score', key: 'healthScore', width: 120 },
  {
    title: 'Last Updated',
    key: 'lastUpdatedAt',
    width: 190,
    render: (row) =>
      row.lastUpdatedAt === null
        ? '—'
        : new Date(row.lastUpdatedAt).toLocaleString(),
  },
];

function rowProps(row: Machine) {
  return {
    style: 'cursor: pointer',
    onClick: () =>
      router.push({ name: 'machine-detail', params: { id: row.machineId } }),
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
    <NDataTable
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
