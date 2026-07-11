<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { NButton, NCard } from 'naive-ui';
import { listEvents } from '../api/events';
import type { MachineEvent } from '../api/types';
import EventsTable from '../components/EventsTable.vue';

const PAGE_SIZE = 20;

// The newest page polls every 5s (QueryClient default); older pages are
// fetched once on demand via the `before` cursor (api.md §4.4) and appended.
const newestPageQuery = useQuery({
  queryKey: ['events', { page: 'newest' }],
  queryFn: () => listEvents({ limit: PAGE_SIZE }),
});

const olderEvents = ref<MachineEvent[]>([]);
const olderCursor = ref<string | null>(null);
const loadingMore = ref(false);

const events = computed(() => {
  const newest = newestPageQuery.data.value?.data ?? [];
  const newestIds = new Set(newest.map((e) => e.eventId));
  // New events shift the newest page window; drop duplicates when the pages
  // overlap after a poll.
  return [...newest, ...olderEvents.value.filter((e) => !newestIds.has(e.eventId))];
});

const hasMore = computed(() => {
  if (olderCursor.value !== null) return true;
  if (olderEvents.value.length === 0) {
    return newestPageQuery.data.value?.pagination.hasMore ?? false;
  }
  return false;
});

async function loadMore() {
  const before =
    olderCursor.value ?? newestPageQuery.data.value?.pagination.nextCursor;
  if (!before) return;
  loadingMore.value = true;
  try {
    const page = await listEvents({ limit: PAGE_SIZE, before });
    olderEvents.value = [...olderEvents.value, ...page.data];
    olderCursor.value = page.pagination.hasMore
      ? page.pagination.nextCursor
      : null;
  } finally {
    loadingMore.value = false;
  }
}
</script>

<template>
  <NCard title="Event Center" size="small">
    <EventsTable :events="events" :loading="newestPageQuery.isLoading.value" />
    <div v-if="hasMore" class="load-more">
      <NButton :loading="loadingMore" secondary @click="loadMore">
        Load more
      </NButton>
    </div>
  </NCard>
</template>

<style scoped>
.load-more {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
</style>
