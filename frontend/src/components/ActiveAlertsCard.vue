<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { NButton, NCard, NEmpty, NList, NListItem, NTag, NText } from 'naive-ui';
import { RouterLink } from 'vue-router';
import { acknowledgeAlert, listAlerts, resolveAlert } from '../api/alerts';
import { formatRelativeTime } from '../format';

// Dashboard Active Alerts widget (dashboard-operational-metrics design D5):
// the actionable "what needs attention now" view, polling on the default
// interval. Queries ACTIVE + ACKNOWLEDGED — an acknowledged alert still
// needs attention until resolved (add-alert-lifecycle design D3).
const queryKey = ['alerts', { status: 'ACTIVE,ACKNOWLEDGED' }];
const alertsQuery = useQuery({
  queryKey,
  queryFn: () => listAlerts({ status: ['ACTIVE', 'ACKNOWLEDGED'], limit: 8 }),
});

const queryClient = useQueryClient();
const invalidate = () => queryClient.invalidateQueries({ queryKey: ['alerts'] });

const acknowledgeMutation = useMutation({
  mutationFn: (alert: { machineId: string; alertId: string }) =>
    acknowledgeAlert(alert.machineId, alert.alertId),
  onSuccess: invalidate,
});

const resolveMutation = useMutation({
  mutationFn: (alert: { machineId: string; alertId: string }) =>
    resolveAlert(alert.machineId, alert.alertId),
  onSuccess: invalidate,
});
</script>

<template>
  <NCard title="Active Alerts" size="small">
    <NEmpty
      v-if="alertsQuery.data.value?.data.length === 0"
      description="No active alerts — all quiet."
    />
    <NList v-else :show-divider="true">
      <NListItem
        v-for="alert in alertsQuery.data.value?.data ?? []"
        :key="alert.alertId"
      >
        <div class="alert-row">
          <NTag
            :type="alert.severity === 'CRITICAL' ? 'error' : 'warning'"
            size="small"
          >
            {{ alert.severity }}
          </NTag>
          <NTag v-if="alert.status === 'ACKNOWLEDGED'" type="default" size="small">
            ACKNOWLEDGED
          </NTag>
          <RouterLink
            :to="{ name: 'machine-detail', params: { id: alert.machineId } }"
            class="alert-machine"
          >
            {{ alert.machineId }}
          </RouterLink>
          <span class="alert-message">{{ alert.message }}</span>
          <NText depth="3" class="alert-time">
            {{ formatRelativeTime(alert.createdAt) }}
          </NText>
          <NButton
            v-if="alert.status === 'ACTIVE'"
            size="tiny"
            :loading="
              acknowledgeMutation.isPending.value &&
              acknowledgeMutation.variables.value?.alertId === alert.alertId
            "
            @click="
              acknowledgeMutation.mutate({
                machineId: alert.machineId,
                alertId: alert.alertId,
              })
            "
          >
            Acknowledge
          </NButton>
          <NButton
            size="tiny"
            type="primary"
            secondary
            :loading="
              resolveMutation.isPending.value &&
              resolveMutation.variables.value?.alertId === alert.alertId
            "
            @click="
              resolveMutation.mutate({
                machineId: alert.machineId,
                alertId: alert.alertId,
              })
            "
          >
            Resolve
          </NButton>
        </div>
      </NListItem>
    </NList>
  </NCard>
</template>

<style scoped>
.alert-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.alert-machine {
  flex-shrink: 0;
}
.alert-message {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.alert-time {
  flex-shrink: 0;
  font-size: 12px;
}
</style>
