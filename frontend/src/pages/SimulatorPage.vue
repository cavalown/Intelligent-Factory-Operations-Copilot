<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMutation } from '@tanstack/vue-query';
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  useMessage,
} from 'naive-ui';
import { useQuery } from '@tanstack/vue-query';
import { ApiError } from '../api/client';
import { listMachines } from '../api/machines';
import { publishSimulatorEvent } from '../api/simulator';
import { EVENT_TYPES, MACHINE_STATUSES, type EventType } from '../api/types';

// One config entry per event type drives the payload form (add-frontend-mvp
// design D5); field names match the backend validator
// (backend/src/simulator/simulator.service.ts).
interface FieldDef {
  key: string;
  label: string;
  kind: 'text' | 'number' | 'status';
  placeholder?: string;
}

const PAYLOAD_FIELDS: Record<EventType, FieldDef[]> = {
  STATUS_CHANGED: [
    { key: 'currentStatus', label: 'Current Status', kind: 'status' },
    { key: 'reason', label: 'Reason', kind: 'text', placeholder: 'optional' },
  ],
  TEMPERATURE_REPORTED: [
    { key: 'temperature', label: 'Temperature (°C)', kind: 'number' },
    { key: 'unit', label: 'Unit', kind: 'text', placeholder: 'C' },
  ],
  ERROR_OCCURRED: [
    { key: 'errorCode', label: 'Error Code', kind: 'text', placeholder: 'E42' },
    { key: 'errorMessage', label: 'Error Message', kind: 'text' },
  ],
  MAINTENANCE_REQUIRED: [
    { key: 'maintenanceType', label: 'Maintenance Type', kind: 'text', placeholder: 'PREVENTIVE' },
    { key: 'reason', label: 'Reason', kind: 'text' },
  ],
  PRODUCTION_COMPLETED: [
    { key: 'quantity', label: 'Quantity', kind: 'number' },
  ],
};

const message = useMessage();

const machinesQuery = useQuery({
  queryKey: ['machines'],
  queryFn: listMachines,
});

const machineOptions = computed(
  () =>
    machinesQuery.data.value?.data.map((m) => ({
      label: `${m.machineId} — ${m.name}`,
      value: m.machineId,
    })) ?? [],
);

const eventTypeOptions = EVENT_TYPES.map((t) => ({ label: t, value: t }));
const statusOptions = MACHINE_STATUSES.map((s) => ({ label: s, value: s }));

const machineId = ref<string | null>(null);
const eventType = ref<EventType>('TEMPERATURE_REPORTED');
const payload = ref<Record<string, unknown>>({ unit: 'C' });

const fields = computed(() => PAYLOAD_FIELDS[eventType.value]);

watch(eventType, (type) => {
  // Reset payload to the new type's shape; defaults keep the demo fast.
  payload.value = type === 'TEMPERATURE_REPORTED' ? { unit: 'C' } : {};
});

const publishMutation = useMutation({
  mutationFn: () =>
    publishSimulatorEvent({
      machineId: machineId.value as string,
      eventType: eventType.value,
      // Drop empty-string fields so optional inputs stay omitted.
      payload: Object.fromEntries(
        Object.entries(payload.value).filter(
          ([, v]) => v !== '' && v !== null && v !== undefined,
        ),
      ),
    }),
  onSuccess: (accepted) => {
    // 202: consumers process asynchronously (api.md §4.8); form state stays
    // so the operator can fire variations quickly.
    message.success(`Published ${accepted.eventId}`);
  },
  onError: (err) => {
    if (err instanceof ApiError) {
      message.error(`${err.code}: ${err.message}`, { duration: 6000 });
    } else {
      message.error(String(err));
    }
  },
});

const canSubmit = computed(() => machineId.value !== null);
</script>

<template>
  <NCard title="Simulator" size="small" class="simulator-card">
    <NForm label-placement="top">
      <NFormItem label="Machine">
        <NSelect
          v-model:value="machineId"
          :options="machineOptions"
          :loading="machinesQuery.isLoading.value"
          placeholder="Select a machine"
        />
      </NFormItem>

      <NFormItem label="Event Type">
        <NSelect v-model:value="eventType" :options="eventTypeOptions" />
      </NFormItem>

      <NFormItem v-for="field in fields" :key="field.key" :label="field.label">
        <NInputNumber
          v-if="field.kind === 'number'"
          :value="(payload[field.key] as number | null) ?? null"
          style="width: 100%"
          @update:value="(v) => (payload[field.key] = v)"
        />
        <NSelect
          v-else-if="field.kind === 'status'"
          :value="(payload[field.key] as string | null) ?? null"
          :options="statusOptions"
          @update:value="(v) => (payload[field.key] = v)"
        />
        <NInput
          v-else
          :value="(payload[field.key] as string | null) ?? null"
          :placeholder="field.placeholder ?? ''"
          @update:value="(v) => (payload[field.key] = v)"
        />
      </NFormItem>

      <NButton
        type="primary"
        :disabled="!canSubmit"
        :loading="publishMutation.isPending.value"
        @click="publishMutation.mutate()"
      >
        Publish Event
      </NButton>
    </NForm>
  </NCard>
</template>

<style scoped>
.simulator-card {
  max-width: 560px;
}
</style>
