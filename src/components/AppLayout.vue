<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-top">
        <SidebarIcon :icon="LogoIcon" label="MockupStudio" to="/" :is-logo="true" />
        <div class="w-8 h-px bg-white/10 my-2" />
        <SidebarIcon :icon="LayoutGrid" label="模板库" to="/" :active="isActive('/')" exclude-exact />
        <SidebarIcon :icon="Plus" label="上传模板" to="/upload" :active="isActive('/upload')" />
        <SidebarIcon :icon="Wand2" label="样机生成" to="/generator" :active="isActive('/generator')" />
        <SidebarIcon :icon="Layers" label="批量生成" to="/batch" :active="isActive('/batch')" />
        <SidebarIcon :icon="Clock" label="历史记录" to="/history" :active="isActive('/history')" />
        <SidebarIcon :icon="BarChart3" label="数据统计" to="/stats" :active="isActive('/stats')" />
        <SidebarIcon :icon="Download" label="数据导出" to="/export" :active="isActive('/export')" />
        <SidebarIcon :icon="TrendingUp" label="分析报告" to="/analytics" :active="isActive('/analytics')" />
      </div>
      <div class="sidebar-bottom">
        <SidebarIcon :icon="Settings" label="设置" to="/settings" :active="isActive('/settings')" />
        <a-tooltip content="个人中心" position="right" mini>
          <div
            class="sidebar-icon-btn"
            :class="{ 'sidebar-icon-btn-active': isActive('/settings') }"
            @click="handleUserClick"
          >
            <User :size="20" />
          </div>
        </a-tooltip>
      </div>
    </aside>
    <div class="main-content">
      <div class="toolbar">
        <a-breadcrumb class="text-sm">
          <a-breadcrumb-item v-for="(item, i) in breadcrumbs" :key="i">{{ item }}</a-breadcrumb-item>
        </a-breadcrumb>
        <div class="flex-1" />
        <NotificationCenter />
        <slot name="toolbar-actions" />
      </div>
      <div class="canvas-area">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LayoutGrid, Plus, Wand2, Layers, Clock, BarChart3, Settings, User, Download, TrendingUp } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import SidebarIcon from './SidebarIcon.vue'
import NotificationCenter from './NotificationCenter.vue'

const LogoIcon = () => h('span', { style: 'font-weight:700;font-size:18px;color:#007AFF;' }, 'M')

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const breadcrumbs = computed(() => {
  const map: Record<string, string[]> = {
    home: ['模板库'],
    upload: ['模板库', '上传模板'],
    generator: ['样机生成'],
    'generator-with-template': ['样机生成'],
    batch: ['批量生成'],
    'batch-history': ['批量生成', '任务历史'],
    history: ['历史记录'],
    stats: ['数据统计'],
    'data-export': ['数据导出'],
    'analytics-report': ['分析报告'],
    settings: ['账户设置'],
  }
  return map[route.name as string] || ['MockupStudio']
})

function isActive(path: string) {
  if (path === '/' && route.path === '/') return true
  if (path !== '/' && route.path.startsWith(path)) return true
  return false
}

function handleUserClick() {
  if (auth.isAuthenticated) {
    router.push('/settings')
  } else {
    router.push('/login')
  }
}
</script>

<style scoped>
.sidebar-icon-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.15s ease;
}
.sidebar-icon-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}
.sidebar-icon-btn-active {
  color: #007AFF;
  background: rgba(0, 122, 255, 0.1);
}
</style>
