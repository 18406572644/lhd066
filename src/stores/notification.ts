import { defineStore } from 'pinia'
import { ref } from 'vue'
import { get, post, del } from '@/utils/api'

export interface Notification {
  id: number
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  content?: string
  taskId?: number
  isRead: boolean
  createdAt: string
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const pollingTimer = ref<number | null>(null)
  const page = ref(1)
  const pageSize = ref(20)
  const total = ref(0)

  async function fetchNotifications(unreadOnly: boolean = false) {
    loading.value = true
    try {
      const params = new URLSearchParams()
      params.set('page', String(page.value))
      params.set('limit', String(pageSize.value))
      if (unreadOnly) {
        params.set('unread', 'true')
      }
      const res = await get<any>(`/notifications?${params.toString()}`)
      notifications.value = res.notifications
      unreadCount.value = res.unreadCount
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  async function fetchUnreadCount() {
    try {
      const params = new URLSearchParams()
      params.set('limit', '1')
      const res = await get<any>(`/notifications?${params.toString()}`)
      unreadCount.value = res.unreadCount
    } catch {
      // ignore
    }
  }

  function startPolling(interval: number = 10000) {
    stopPolling()
    fetchUnreadCount()
    pollingTimer.value = window.setInterval(() => {
      fetchUnreadCount()
    }, interval)
  }

  function stopPolling() {
    if (pollingTimer.value) {
      clearInterval(pollingTimer.value)
      pollingTimer.value = null
    }
  }

  async function markAsRead(id: number) {
    await post(`/notifications/${id}/read`)
    const notification = notifications.value.find(n => n.id === id)
    if (notification) {
      notification.isRead = true
    }
    if (unreadCount.value > 0) {
      unreadCount.value--
    }
  }

  async function markAllAsRead() {
    await post('/notifications/read-all')
    notifications.value.forEach(n => n.isRead = true)
    unreadCount.value = 0
  }

  async function deleteNotification(id: number) {
    await del(`/notifications/${id}`)
    const index = notifications.value.findIndex(n => n.id === id)
    if (index >= 0) {
      notifications.value.splice(index, 1)
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    page,
    pageSize,
    total,
    fetchNotifications,
    fetchUnreadCount,
    startPolling,
    stopPolling,
    markAsRead,
    markAllAsRead,
    deleteNotification
  }
})
