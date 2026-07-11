<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NConfigProvider,
  NMessageProvider,
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  type MenuOption,
} from 'naive-ui';

const route = useRoute();
const router = useRouter();

const menuOptions: MenuOption[] = [
  { label: 'Dashboard', key: 'dashboard' },
  { label: 'Machines', key: 'machines' },
  { label: 'Event Center', key: 'events' },
  { label: 'Simulator', key: 'simulator' },
];

const activeKey = computed(() => {
  if (route.name === 'machine-detail') return 'machines';
  return String(route.name ?? 'dashboard');
});

function onMenuSelect(key: string) {
  router.push({ name: key });
}
</script>

<template>
  <NConfigProvider>
    <NMessageProvider>
      <NLayout class="app-layout">
        <NLayoutHeader bordered class="app-header">
          <span class="app-title">IFOC</span>
          <NMenu
            mode="horizontal"
            :options="menuOptions"
            :value="activeKey"
            @update:value="onMenuSelect"
          />
        </NLayoutHeader>
        <NLayoutContent content-class="app-content">
          <RouterView />
        </NLayoutContent>
      </NLayout>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
}
.app-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 24px;
  height: 56px;
}
.app-title {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 1px;
}
</style>

<style>
.app-content {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}
</style>
