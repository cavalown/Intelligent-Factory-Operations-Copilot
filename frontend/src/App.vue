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
import BottomTabBar from './components/BottomTabBar.vue';
import { useViewport } from './composables/useViewport';
import { NAV_ITEMS, activeNavKey } from './navigation';

const route = useRoute();
const router = useRouter();
const { isPhone } = useViewport();

// Destinations and active-key logic shared with the phone tab bar via
// navigation.ts (review fix: the two navs previously drifted).
const menuOptions: MenuOption[] = NAV_ITEMS.map((item) => ({
  label: item.label,
  key: item.key,
}));

const activeKey = computed(() => activeNavKey(route));

function onMenuSelect(key: string) {
  router.push({ name: key });
}

// Phone keeps a slim brand header; the menu moves to the bottom tab bar
// (add-responsive-ui design D2) and content reserves clearance above it.
const contentClass = computed(() =>
  isPhone.value ? 'app-content app-content--phone' : 'app-content',
);
</script>

<template>
  <NConfigProvider>
    <NMessageProvider>
      <NLayout class="app-layout">
        <NLayoutHeader bordered class="app-header">
          <span class="app-title">IFOC</span>
          <NMenu
            v-if="!isPhone"
            mode="horizontal"
            :options="menuOptions"
            :value="activeKey"
            @update:value="onMenuSelect"
          />
        </NLayoutHeader>
        <NLayoutContent :content-class="contentClass">
          <RouterView />
        </NLayoutContent>
        <BottomTabBar v-if="isPhone" />
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
/* Narrower gutters on phones. Range syntax matches useViewport's
   complementary bands exactly (no fractional gap at 639.x); canonical
   breakpoint values live in ai/rules/frontend-responsive.md */
@media (width < 640px) {
  .app-content {
    padding: 12px;
  }
}
/* Clearance above the fixed tab bar: its 56px height + the same safe-area
   inset it reserves for notched phones, plus breathing room (review fix —
   a fixed 76px hid the last content row behind the bar when the inset > 20px) */
.app-content--phone {
  padding-bottom: calc(76px + env(safe-area-inset-bottom));
}
</style>
