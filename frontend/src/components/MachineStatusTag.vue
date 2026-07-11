<script setup lang="ts">
import { computed } from 'vue';
import { NTag } from 'naive-ui';
import type { MachineStatus } from '../api/types';

const props = defineProps<{ status: MachineStatus }>();

const TAG_TYPES = {
  RUNNING: 'success',
  IDLE: 'default',
  WARNING: 'warning',
  ERROR: 'error',
  MAINTENANCE: 'info',
} as const;

const tagType = computed(() => TAG_TYPES[props.status] ?? 'default');
</script>

<template>
  <NTag :type="tagType" size="small" round>{{ props.status }}</NTag>
</template>
