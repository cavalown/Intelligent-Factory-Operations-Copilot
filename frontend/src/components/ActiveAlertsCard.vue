<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { NCard, NEmpty, NList, NListItem, NTag, NText } from 'naive-ui';
import { RouterLink } from 'vue-router';
import { listAlerts } from '../api/alerts';
import { formatRelativeTime } from '../format';

// Dashboard Active Alerts widget (dashboard-operational-metrics design D5):
// the actionable "what needs attention now" view, polling on the default
// interval. ACK lifecycle is Phase 2 — read-only until then.
const alertsQuery = useQuery({
  queryKey: ['alerts', { status: 'ACTIVE' }],
  queryFn: () => listAlerts({ status: 'ACTIVE', limit: 8 }),
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
