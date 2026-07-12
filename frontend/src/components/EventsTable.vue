<script setup lang="ts">
import { computed, h } from 'vue';
import { NDataTable, type DataTableColumns } from 'naive-ui';
import { RouterLink } from 'vue-router';
import type { MachineEvent } from '../api/types';
import { formatTimestamp } from '../format';
import { useViewport } from '../composables/useViewport';
import EventTypeTag from './EventTypeTag.vue';

// Presentational only — pages own the fetching. One table serves Event
// Center, the Dashboard widget, and Machine Detail; on phones it drops the
// payload column and scrolls inside its own container (add-responsive-ui
// design D4 — lookup pages tolerate scrolling, whole-page overflow never).
const props = withDefaults(
  defineProps<{
    events: MachineEvent[];
    loading?: boolean;
    showMachine?: boolean;
  }>(),
  { loading: false, showMachine: true },
);

const { isPhone } = useViewport();

const columns = computed<DataTableColumns<MachineEvent>>(() => [
  {
    title: 'Time',
    key: 'occurredAt',
    width: isPhone.value ? 150 : 190,
    render: (row) => formatTimestamp(row.occurredAt),
  },
  ...(props.showMachine
    ? [
        {
          title: 'Machine',
          key: 'machineId',
          width: isPhone.value ? 90 : 120,
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
    width: isPhone.value ? 170 : 220,
    render: (row) => h(EventTypeTag, { eventType: row.eventType }),
  },
  // Payload is one tap away on the detail page; truncated JSON on a phone
  // informs nobody (design D4).
  ...(isPhone.value
    ? []
    : [
        {
          title: 'Payload',
          key: 'payload',
          ellipsis: true,
          render: (row: MachineEvent) => JSON.stringify(row.payload),
        },
      ]),
]);
</script>

<template>
  <div class="events-table-scroll">
    <NDataTable
      :columns="columns"
      :data="props.events"
      :loading="props.loading"
      :row-key="(row: MachineEvent) => row.eventId"
      size="small"
      :bordered="false"
    />
  </div>
</template>

<style scoped>
/* Any residual width overflows inside this container, never the page body */
.events-table-scroll {
  overflow-x: auto;
}
</style>
