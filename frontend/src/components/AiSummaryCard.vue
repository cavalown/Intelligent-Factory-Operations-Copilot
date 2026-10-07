<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NList,
  NListItem,
  NSkeleton,
  NText,
  NTooltip,
} from 'naive-ui';
import { ApiError } from '../api/client';
import { getSummary } from '../api/summaries';
import { formatTimestamp } from '../format';

// Advisory preview: stored/mock content remains readable, while generation
// stays disabled until a real LLM provider is integrated.
const props = defineProps<{ machineId?: string }>();

const queryKey = computed(() =>
  props.machineId ? ['summary', 'machine', props.machineId] : ['summary', 'factory'],
);

const summaryQuery = useQuery({
  queryKey,
  queryFn: () => getSummary(props.machineId),
  refetchInterval: false,
  retry: false,
});

const noSummaryYet = computed(
  () =>
    summaryQuery.error.value instanceof ApiError &&
    summaryQuery.error.value.code === 'SUMMARY_NOT_FOUND',
);

</script>

<template>
  <NCard title="AI Summary" size="small">
    <template #header-extra>
      <NTooltip trigger="hover">
        <template #trigger>
          <span class="disabled-action">
            <NButton size="small" type="primary" secondary disabled>
              {{ summaryQuery.data.value ? 'Regenerate' : 'Generate' }}
            </NButton>
          </span>
        </template>
        此功能尚未開放
      </NTooltip>
    </template>

    <NSkeleton v-if="summaryQuery.isLoading.value" text :repeat="3" />

    <template v-else-if="summaryQuery.data.value">
      <p>{{ summaryQuery.data.value.summary }}</p>
      <NList v-if="summaryQuery.data.value.recommendedActions.length > 0">
        <NListItem
          v-for="action in summaryQuery.data.value.recommendedActions"
          :key="action"
        >
          {{ action }}
        </NListItem>
      </NList>
      <NText depth="3" style="font-size: 12px">
        {{ summaryQuery.data.value.model }} ·
        {{ formatTimestamp(summaryQuery.data.value.createdAt) }}
      </NText>
    </template>

    <NEmpty
      v-else-if="noSummaryYet"
      description="AI summaries are coming soon."
    />

    <NAlert v-else-if="summaryQuery.error.value" type="warning" title="Could not load summary">
      {{ summaryQuery.error.value.message }}
      <NButton size="tiny" text type="primary" @click="summaryQuery.refetch()">
        Retry
      </NButton>
    </NAlert>
  </NCard>
</template>

<style scoped>
.disabled-action {
  display: inline-flex;
  cursor: not-allowed;
}
</style>
