<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NAV_ITEMS, activeNavKey } from '../navigation';

// Phone navigation (add-responsive-ui design D2): fixed bottom tab bar,
// one-handed reach for the four destinations. Rendered only at phone widths
// (App.vue decides). Destinations and active-key logic come from
// navigation.ts — shared with the desktop menu so the two navs cannot drift.
const route = useRoute();
const router = useRouter();

const activeKey = computed(() => activeNavKey(route));
</script>

<template>
  <nav class="tab-bar">
    <button
      v-for="tab in NAV_ITEMS"
      :key="tab.key"
      class="tab-item"
      :class="{ 'tab-item--active': activeKey === tab.key }"
      type="button"
      @click="router.push({ name: tab.key })"
    >
      <svg
        class="tab-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path :d="tab.icon" />
      </svg>
      <span class="tab-label">{{ tab.tabLabel }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  background: #fff;
  border-top: 1px solid #e5e5ea;
  z-index: 100;
  /* Home-indicator clearance on notched phones; content clearance in
     App.vue matches this via calc(76px + env(...)) — keep in sync */
  padding-bottom: env(safe-area-inset-bottom);
}
.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: none;
  background: none;
  color: #86868b;
  font-size: 11px;
  cursor: pointer;
  /* Full-height touch target (≥56px, rule: touch-sized on phone paths) */
  padding: 0;
}
.tab-item--active {
  color: #18a058;
}
.tab-icon {
  width: 22px;
  height: 22px;
}
.tab-label {
  line-height: 1;
}
</style>
