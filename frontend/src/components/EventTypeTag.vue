<script setup lang="ts">
import { computed } from 'vue';
import { NTag } from 'naive-ui';
import type { EventType } from '../api/types';

// Color derives from eventType ONLY — never a computed severity
// (docs/product/mvp.md "Why There Is No Severity Column";
// add-frontend-mvp design D7).
const props = defineProps<{ eventType: EventType }>();

const TAG_TYPES = {
  STATUS_CHANGED: 'info',
  TEMPERATURE_REPORTED: 'default',
  ERROR_OCCURRED: 'error',
  MAINTENANCE_REQUIRED: 'warning',
  PRODUCTION_COMPLETED: 'success',
} as const;

const tagType = computed(() => TAG_TYPES[props.eventType] ?? 'default');
</script>

<template>
  <NTag :type="tagType" size="small">{{ props.eventType }}</NTag>
</template>
