<script setup lang="ts">
import { h } from 'vue';
import { NDataTable, type DataTableColumns } from 'naive-ui';
import { RouterLink } from 'vue-router';
import type { MachineEvent } from '../api/types';
import EventTypeTag from './EventTypeTag.vue';

// Presentational only — pages own the fetching (add-frontend-mvp design
// Open Question 1 resolved: one table for Event Center, Dashboard widget,
// and Machine Detail).
const props = withDefaults(
  defineProps<{
    events: MachineEvent[];
    loading?: boolean;
    showMachine?: boolean;
  }>(),
  { loading: false, showMachine: true },
);

const columns: DataTableColumns<MachineEvent> = [
  {
    title: 'Time',
    key: 'occurredAt',
    width: 190,
    render: (row) => new Date(row.occurredAt).toLocaleString(),
  },
  ...(props.showMachine
    ? [
        {
          title: 'Machine',
          key: 'machineId',
          width: 120,
          render: (row: MachineEvent) =>
            h(
              RouterLink,
              {
                to: { name: 'machine-detail', params: { id: row.machineId } },
              },
              { default: () => row.machineId },
            ),
        },
      ]
    : []),
  {
    title: 'Event Type',
    key: 'eventType',
    width: 220,
    render: (row) => h(EventTypeTag, { eventType: row.eventType }),
  },
  {
    title: 'Payload',
    key: 'payload',
    ellipsis: true,
    render: (row) => JSON.stringify(row.payload),
  },
];
</script>

<template>
  <NDataTable
    :columns="columns"
    :data="props.events"
    :loading="props.loading"
    :row-key="(row: MachineEvent) => row.eventId"
    size="small"
    :bordered="false"
  />
</template>
