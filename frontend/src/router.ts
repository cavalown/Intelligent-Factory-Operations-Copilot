import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: () => import('./pages/DashboardPage.vue') },
    { path: '/machines', name: 'machines', component: () => import('./pages/MachineListPage.vue') },
    { path: '/machines/:id', name: 'machine-detail', component: () => import('./pages/MachineDetailPage.vue') },
    { path: '/events', name: 'events', component: () => import('./pages/EventCenterPage.vue') },
    { path: '/simulator', name: 'simulator', component: () => import('./pages/SimulatorPage.vue') },
  ],
});
