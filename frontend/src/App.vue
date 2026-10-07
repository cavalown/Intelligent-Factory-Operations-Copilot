<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NConfigProvider,
  NMessageProvider,
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NButton,
  NDrawer,
  NDrawerContent,
  type MenuOption,
} from 'naive-ui';
import BottomTabBar from './components/BottomTabBar.vue';
import SimulatorPanel from './components/SimulatorPanel.vue';
import { useViewport } from './composables/useViewport';
import { NAV_ITEMS, activeNavKey } from './navigation';

const route = useRoute();
const router = useRouter();
const { isPhone, isDesktop } = useViewport();
const simulatorOpen = ref(false);

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
          <NButton
            v-if="!isDesktop"
            class="simulator-trigger"
            type="primary"
            @click="simulatorOpen = true"
          >
            Simulator
          </NButton>
        </NLayoutHeader>
        <div class="app-shell">
          <NLayoutContent :content-class="contentClass" class="app-main">
            <RouterView />
          </NLayoutContent>
          <aside v-if="isDesktop" class="simulator-rail">
            <SimulatorPanel />
          </aside>
        </div>
        <NDrawer v-model:show="simulatorOpen" placement="right" :width="360">
          <NDrawerContent title="Run a simulation" closable>
            <SimulatorPanel />
          </NDrawerContent>
        </NDrawer>
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
.simulator-trigger {
  margin-left: auto;
  min-height: 40px;
}
.app-shell {
  display: flex;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  align-items: flex-start;
}
.app-main {
  min-width: 0;
  flex: 1;
}
.simulator-rail {
  width: 340px;
  flex: 0 0 340px;
  position: sticky;
  top: 56px;
  padding: 24px 24px 24px 0;
  max-height: calc(100vh - 56px);
  overflow-y: auto;
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
