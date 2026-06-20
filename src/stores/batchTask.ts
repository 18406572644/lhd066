import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { get, post } from '@/utils/api'

export interface BatchTask {
  id: number
  name: string
  status: 'pending' | 'running' | 'paused' | 'cancelled' | 'completed' | 'failed'
  totalCount: number
  successCount: number
  failedCount: number
  currentIndex: number
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export interface TaskItem {
  id: number
  templateId: number
  templateName: string
  designImageUrl: string
  status: 'pending' | 'processing' | 'success' | 'failed' | 'skipped'
  resultImageUrl?: string
  errorMessage?: string
  historyId?: number
  createdAt: string
  completedAt?: string
}

export interface TaskProgress {
  task: BatchTask
  currentItem: TaskItem | null
  recentItems: TaskItem[]
  progress: number
}

export const useBatchTaskStore = defineStore('batchTask', () => {
  const currentTaskId = ref<number | null>(null)
  const currentProgress = ref<TaskProgress | null>(null)
  const taskList = ref<BatchTask[]>([])
  const taskItems = ref<TaskItem[]>([])
  const pollingTimer = ref<number | null>(null)
  const loading = ref(false)
  const page = ref(1)
  const pageSize = ref(20)
  const total = ref(0)

  const isTaskRunning = computed(() => {
    return currentProgress.value?.task.status === 'running' || 
           currentProgress.value?.task.status === 'paused'
  })

  async function createTask(items: any[], name?: string): Promise<number> {
    const res = await post<{ taskId: number }>('/batch-tasks', { items, name })
    return res.taskId
  }

  async function fetchTaskProgress(taskId: number): Promise<TaskProgress | null> {
    try {
      const res = await get<TaskProgress>(`/batch-tasks/${taskId}`)
      if (res && res.task) {
        currentProgress.value = {
          ...res,
          task: {
            ...res.task,
            status: res.task.status as any
          }
        }
      }
      return currentProgress.value
    } catch {
      return null
    }
  }

  function startPolling(taskId: number, interval: number = 2000) {
    stopPolling()
    currentTaskId.value = taskId
    
    fetchTaskProgress(taskId)
    
    pollingTimer.value = window.setInterval(async () => {
      const progress = await fetchTaskProgress(taskId)
      if (progress && !['running', 'paused', 'pending'].includes(progress.task.status)) {
        stopPolling()
      }
    }, interval)
  }

  function stopPolling() {
    if (pollingTimer.value) {
      clearInterval(pollingTimer.value)
      pollingTimer.value = null
    }
  }

  async function pauseTask(taskId: number) {
    await post(`/batch-tasks/${taskId}/pause`)
    if (currentTaskId.value === taskId) {
      await fetchTaskProgress(taskId)
    }
  }

  async function resumeTask(taskId: number) {
    await post(`/batch-tasks/${taskId}/resume`)
    if (currentTaskId.value === taskId) {
      await fetchTaskProgress(taskId)
    }
  }

  async function cancelTask(taskId: number) {
    await post(`/batch-tasks/${taskId}/cancel`)
    stopPolling()
    if (currentTaskId.value === taskId) {
      currentTaskId.value = null
      currentProgress.value = null
    }
  }

  async function retryFailedItems(taskId: number): Promise<number> {
    const res = await post<{ newTaskId: number; retryCount: number }>(`/batch-tasks/${taskId}/retry`)
    return res.newTaskId
  }

  async function fetchTaskList(status?: string) {
    loading.value = true
    try {
      const params = new URLSearchParams()
      params.set('page', String(page.value))
      params.set('limit', String(pageSize.value))
      if (status) {
        params.set('status', status)
      }
      const res = await get<any>(`/batch-tasks?${params.toString()}`)
      taskList.value = res.tasks
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  async function fetchTaskItems(taskId: number, status?: string) {
    loading.value = true
    try {
      const params = new URLSearchParams()
      params.set('limit', '200')
      if (status) {
        params.set('status', status)
      }
      const res = await get<any>(`/batch-tasks/${taskId}/items?${params.toString()}`)
      taskItems.value = res.items
    } finally {
      loading.value = false
    }
  }

  function resetCurrentTask() {
    stopPolling()
    currentTaskId.value = null
    currentProgress.value = null
  }

  return {
    currentTaskId,
    currentProgress,
    taskList,
    taskItems,
    loading,
    page,
    pageSize,
    total,
    isTaskRunning,
    createTask,
    fetchTaskProgress,
    startPolling,
    stopPolling,
    pauseTask,
    resumeTask,
    cancelTask,
    retryFailedItems,
    fetchTaskList,
    fetchTaskItems,
    resetCurrentTask
  }
})
