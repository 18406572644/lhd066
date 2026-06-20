import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/pages/RegisterPage.vue'),
  },
  {
    path: '/share/:token',
    name: 'share',
    component: () => import('@/pages/SharePage.vue'),
  },
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/pages/TemplateLibrary.vue'),
      },
      {
        path: 'upload',
        name: 'upload',
        component: () => import('@/pages/TemplateUploadPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'generator',
        name: 'generator',
        component: () => import('@/pages/MockupGeneratorPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'generator/:id',
        name: 'generator-with-template',
        component: () => import('@/pages/MockupGeneratorPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'batch',
        name: 'batch',
        component: () => import('@/pages/BatchGeneratePage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'batch/history',
        name: 'batch-history',
        component: () => import('@/pages/BatchHistoryPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'history',
        name: 'history',
        component: () => import('@/pages/HistoryPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'stats',
        name: 'stats',
        component: () => import('@/pages/StatsPage.vue'),
        meta: { requiresAuth: true },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  if (to.meta.requiresAuth) {
    const token = localStorage.getItem('token')
    if (!token) {
      next({ name: 'login', query: { redirect: to.fullPath } })
      return
    }
  }
  next()
})

export default router
