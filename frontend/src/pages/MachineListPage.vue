<script setup lang="ts">
import { h } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { NCard, NDataTable, type DataTableColumns } from 'naive-ui';
import { listMachines } from '../api/machines';
import type { Machine } from '../api/types';
import MachineStatusTag from '../components/MachineStatusTag.vue';

const router = useRouter();

const machinesQuery = useQuery({
  queryKey: ['machines'],
  queryFn: listMachines,
});

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
    <NDataTable
      :columns="columns"
      :data="machinesQuery.data.value?.data ?? []"
      :loading="machinesQuery.isLoading.value"
      :row-key="(row: Machine) => row.machineId"
      :row-props="rowProps"
      size="small"
      :bordered="false"
    />
  </NCard>
</template>
