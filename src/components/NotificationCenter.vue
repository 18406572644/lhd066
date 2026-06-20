<template>
  <div class="notification-center">
    <a-dropdown @visible-change="onDropdownVisibleChange">
      <div class="notification-icon-btn" @click="toggleDropdown">
        <Bell :size="20" />
        <a-badge
          v-if="notificationStore.unreadCount > 0"
          :count="notificationStore.unreadCount"
          :dot="false"
          :overflow-count="99"
        />
      </div>
      <template #content>
        <div class="notification-dropdown">
          <div class="notification-header">
            <span class="notification-title">通知</span>
            <a-button
              type="text"
              size="mini"
              :disabled="notificationStore.unreadCount === 0"
              @click="markAllAsRead"
            >
              全部已读
            </a-button>
          </div>
          <div class="notification-list" v-if="!notificationStore.loading">
            <div
              v-for="notification in notificationStore.notifications"
              :key="notification.id"
              class="notification-item"
              :class="{ unread: !notification.isRead }"
              @click="handleNotificationClick(notification)"
            >
              <div class="notification-icon" :class="`icon-${notification.type}`">
                <CheckCircle v-if="notification.type === 'success'" :size="18" />
                <AlertCircle v-else-if="notification.type === 'error'" :size="18" />
                <AlertTriangle v-else-if="notification.type === 'warning'" :size="18" />
                <Info v-else :size="18" />
              </div>
              <div class="notification-content">
                <div class="notification-item-title">{{ notification.title }}</div>
                <div v-if="notification.content" class="notification-item-content">
                  {{ notification.content }}
                </div>
                <div class="notification-item-time">{{ formatTime(notification.createdAt) }}</div>
              </div>
              <div v-if="!notification.isRead" class="unread-dot" />
            </div>
            <div v-if="notificationStore.notifications.length === 0" class="empty-state">
              <Inbox :size="40" />
              <span>暂无通知</span>
            </div>
          </div>
          <div v-else class="notification-loading">
            <a-spin :size="16" />
          </div>
        </div>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, CheckCircle, AlertCircle, AlertTriangle, Info, Inbox } from 'lucide-vue-next'
import { useNotificationStore } from '@/stores/notification'
import type { Notification } from '@/stores/notification'

const router = useRouter()
const notificationStore = useNotificationStore()
const dropdownVisible = ref(false)

function toggleDropdown() {
  if (!dropdownVisible.value) {
    notificationStore.fetchNotifications()
  }
}

function onDropdownVisibleChange(visible: boolean) {
  dropdownVisible.value = visible
}

async function markAllAsRead() {
  await notificationStore.markAllAsRead()
}

async function handleNotificationClick(notification: Notification) {
  if (!notification.isRead) {
    await notificationStore.markAsRead(notification.id)
  }
  if (notification.taskId) {
    router.push({ name: 'batch-history', query: { taskId: String(notification.taskId) } })
  }
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  
  return date.toLocaleDateString()
}

onMounted(() => {
  notificationStore.startPolling()
})

onUnmounted(() => {
  notificationStore.stopPolling()
})
</script>

<style scoped>
.notification-center {
  position: relative;
}

.notification-icon-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s ease;
}

.notification-icon-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.notification-dropdown {
  width: 360px;
  max-height: 480px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.notification-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.notification-list {
  flex: 1;
  overflow-y: auto;
  max-height: 400px;
}

.notification-item {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-bottom: 1px solid var(--color-border-light);
  position: relative;
}

.notification-item:hover {
  background: var(--color-bg-secondary);
}

.notification-item.unread {
  background: rgba(59, 130, 246, 0.05);
}

.notification-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-success {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.icon-error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.icon-warning {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.icon-info {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 2px;
}

.notification-item-content {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-item-time {
  font-size: 11px;
  color: var(--color-text-muted);
}

.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3b82f6;
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--color-text-secondary);
  gap: 8px;
  font-size: 13px;
}

.notification-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
</style>
