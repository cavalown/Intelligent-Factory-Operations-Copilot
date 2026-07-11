import { createApp } from 'vue';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import App from './App.vue';
import { router } from './router';
import './style.css';

// 5s polling is the MVP's "real-time" (add-frontend-mvp design D2; WebSocket
// is Phase 2). Individual queries opt out (AI summaries never poll).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 5000,
      retry: 1,
    },
  },
});

createApp(App).use(router).use(VueQueryPlugin, { queryClient }).mount('#app');
