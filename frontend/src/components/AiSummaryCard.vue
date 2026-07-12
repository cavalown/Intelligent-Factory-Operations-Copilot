<script setup lang="ts">
import { computed } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NList,
  NListItem,
  NSkeleton,
  NText,
} from 'naive-ui';
import { ApiError } from '../api/client';
import { generateSummary, getSummary } from '../api/summaries';
import { formatTimestamp } from '../format';

// Advisory feature, three states (add-frontend-mvp design D6):
// loaded summary / 404 → generate CTA / 502 → inline error + retry.
// Never polls — regeneration is an explicit operator action.
const props = defineProps<{ machineId?: string }>();

const queryClient = useQueryClient();
const queryKey = computed(() =>
  props.machineId ? ['summary', 'machine', props.machineId] : ['summary', 'factory'],
);

const summaryQuery = useQuery({
  queryKey,
  queryFn: () => getSummary(props.machineId),
  refetchInterval: false,
  retry: false,
});

const generateMutation = useMutation({
  mutationFn: () => generateSummary(props.machineId),
  onSuccess: (summary) => {
    queryClient.setQueryData(queryKey.value, summary);
  },
});

const noSummaryYet = computed(
  () =>
    summaryQuery.error.value instanceof ApiError &&
    summaryQuery.error.value.code === 'SUMMARY_NOT_FOUND',
);

const generateError = computed(() =>
  generateMutation.error.value instanceof ApiError
    ? generateMutation.error.value
    : null,
);
</script>

<template>
  <NCard title="AI Summary" size="small">
    <template #header-extra>
      <NButton
        size="small"
        type="primary"
        secondary
        :loading="generateMutation.isPending.value"
        @click="generateMutation.mutate()"
      >
        {{ summaryQuery.data.value ? 'Regenerate' : 'Generate' }}
      </NButton>
    </template>

    <!-- 502 (or any generate failure) stays inside this card; the rest of
         the page keeps rendering (architecture.md §16). -->
    <NAlert
      v-if="generateError"
      type="error"
      :title="generateError.code"
      closable
      style="margin-bottom: 12px"
      @close="generateMutation.reset()"
    >
      {{ generateError.message }}
    </NAlert>

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
      description="No summary yet — generate one from recent events."
    />

    <NAlert v-else-if="summaryQuery.error.value" type="warning" title="Could not load summary">
      {{ summaryQuery.error.value.message }}
      <NButton size="tiny" text type="primary" @click="summaryQuery.refetch()">
        Retry
      </NButton>
    </NAlert>
  </NCard>
</template>
