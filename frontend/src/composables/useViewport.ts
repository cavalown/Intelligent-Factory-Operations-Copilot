import { computed, ref, type ComputedRef } from 'vue';

// Single breakpoint source of truth (add-responsive-ui design D1;
// ai/rules/frontend-responsive.md — canonical bands 640/1024). Components
// consume the named booleans, never raw widths or duplicated literals.
//
// Implemented on matchMedia (not Naive UI's internal hook — that lives in the
// transitive dependency `vooks`, which is not a public API surface).
// min-width-only queries make the three bands complementary BY CONSTRUCTION:
// there is no fractional-width gap at 639.x/1023.x where no band matches
// (review fix — the previous max-width/min-width pair left (639, 640) open).
//
// Lazy-initialized on first use so importing this module never touches
// `window` (test environments without matchMedia stay safe), and HMR disposal
// removes the listeners so dev reloads don't accumulate them (review fix).
interface ViewportState {
  isPhone: ComputedRef<boolean>;
  isTablet: ComputedRef<boolean>;
  isDesktop: ComputedRef<boolean>;
}

let state: ViewportState | null = null;
let removeListeners: (() => void) | null = null;

function createState(): ViewportState {
  const tabletUp = window.matchMedia('(min-width: 640px)');
  const desktopUp = window.matchMedia('(min-width: 1024px)');

  const isTabletUp = ref(tabletUp.matches);
  const isDesktopUp = ref(desktopUp.matches);

  const onTabletUp = (e: MediaQueryListEvent) => (isTabletUp.value = e.matches);
  const onDesktopUp = (e: MediaQueryListEvent) =>
    (isDesktopUp.value = e.matches);
  tabletUp.addEventListener('change', onTabletUp);
  desktopUp.addEventListener('change', onDesktopUp);
  removeListeners = () => {
    tabletUp.removeEventListener('change', onTabletUp);
    desktopUp.removeEventListener('change', onDesktopUp);
  };

  return {
    isPhone: computed(() => !isTabletUp.value),
    isTablet: computed(() => isTabletUp.value && !isDesktopUp.value),
    isDesktop: computed(() => isDesktopUp.value),
  };
}

export function useViewport(): ViewportState {
  if (state === null) {
    state = createState();
  }
  return state;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    removeListeners?.();
    state = null;
  });
}
