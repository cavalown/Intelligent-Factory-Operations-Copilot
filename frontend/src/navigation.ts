import type { RouteLocationNormalizedLoaded } from 'vue-router';

// Single source of truth for the app's navigation destinations, consumed by
// BOTH the desktop top menu (App.vue) and the phone bottom tab bar
// (BottomTabBar.vue) — review fix: the two navs previously declared their own
// lists and had already drifted ("Event Center" vs "Events"). A page added
// here appears in both navs; a page added anywhere else appears in neither.
export interface NavItem {
  key: string; // must equal the route name in router.ts
  label: string; // desktop menu label
  tabLabel: string; // phone tab label (shorter; divergence is explicit here)
  icon: string; // SVG path data (24x24 viewBox, stroked)
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    tabLabel: 'Dashboard',
    icon: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z',
  },
  {
    key: 'machines',
    label: 'Machines',
    tabLabel: 'Machines',
    icon: 'M4 7h16v13H4zM8 7V4h8v3M9 12h6M9 16h6',
  },
  {
    key: 'events',
    label: 'Event Center',
    tabLabel: 'Events',
    icon: 'M12 3a9 9 0 1 0 9 9M12 7v5l3 3M21 3v5h-5',
  },
  {
    key: 'simulator',
    label: 'Simulator',
    tabLabel: 'Simulator',
    icon: 'M5 4l14 8-14 8V4z',
  },
];

// Which nav item a route highlights. Detail-style routes declare
// `meta.navKey` in router.ts (review fix: this mapping previously lived as
// duplicated `route.name === 'machine-detail'` conditionals in both navs).
export function activeNavKey(route: RouteLocationNormalizedLoaded): string {
  return String(route.meta.navKey ?? route.name ?? 'dashboard');
}
