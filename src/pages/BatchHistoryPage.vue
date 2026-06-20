<template>
  <div class="p-6 max-w-6xl mx-auto">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-lg font-semibold">批量任务历史</h2>
      <a-button type="primary" @click="goToBatch">
        <template #icon><Plus :size="16" /></template>
        新建批量任务
      </a-button>
    </div>

    <div class="filter-bar mb-4">
      <a-radio-group v-model="filterStatus" type="button" size="small" @change="fetchTasks">
        <a-radio value="">全部</a-radio>
        <a-radio value="running">运行中</a-radio>
        <a-radio value="paused">已暂停</a-radio>
        <a-radio value="completed">已完成</a-radio>
        <a-radio value="cancelled">已取消</a-radio>
        <a-radio value="failed">失败</a-radio>
      </a-radio-group>
    </div>

    <div v-if="batchTaskStore.loading" class="space-y-3">
      <a-skeleton v-for="i in 5" :key="i" animation>
        <a-skeleton-shape style="width: 100%; height: 80px; border-radius: 12px" />
      </a-skeleton>
    </div>

    <template v-else>
      <div v-if="selectedTask" class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-base font-semibold">任务详情</h3>
          <a-button size="small" type="text" @click="selectedTask = null">
            返回列表
          </a-button>
        </div>
        <TaskProgressComponent
          :progress="selectedTaskProgress"
          :show-actions="false"
          :show-recent-items="false"
        />
        
        <div v-if="selectedTaskProgress" class="mt-4">
          <div class="section-label mb-2">处理结果</div>
          <div class="filter-bar mb-3">
            <a-radio-group v-model="itemFilterStatus" type="button" size="small" @change="fetchTaskItems">
              <a-radio value="">全部</a-radio>
              <a-radio value="success">成功</a-radio>
              <a-radio value="failed">失败</a-radio>
              <a-radio value="skipped">跳过</a-radio>
            </a-radio-group>
          </div>
          <div class="task-items-grid">
            <div
              v-for="item in batchTaskStore.taskItems"
              :key="item.id"
              class="task-item-card"
            >
              <div class="item-header">
                <span class="item-name">{{ item.templateName }}</span>
                <a-tag :color="itemStatusColor(item.status)" size="small">
                  {{ itemStatusLabel(item.status) }}
                </a-tag>
              </div>
              <div v-if="item.errorMessage" class="item-error">
                <AlertCircle :size="14" />
                <span>{{ item.errorMessage }}</span>
              </div>
              <div v-if="item.resultImageUrl" class="item-actions">
                <a-button
                  size="mini"
                  type="primary"
                  @click="downloadFile(item.resultImageUrl!)"
                >
                  下载
                </a-button>
              </div>
            </div>
          </div>
          <div v-if="batchTaskStore.taskItems.length === 0" class="empty-state">
            暂无数据
          </div>
        </div>

        <div v-if="selectedTaskProgress && selectedTaskProgress.task.failedCount > 0" class="mt-4">
          <a-button
            type="primary"
            status="warning"
            @click="retryFailedItems"
            :loading="retrying"
          >
            <template #icon><RefreshCw :size="16" /></template>
            重新执行失败项 ({{ selectedTaskProgress.task.failedCount }}项)
          </a-button>
        </div>
      </div>

      <template v-else>
        <div class="task-list space-y-3">
          <div
            v-for="task in batchTaskStore.taskList"
            :key="task.id"
            class="task-card"
            @click="selectTask(task.id)"
          >
            <div class="task-card-left">
              <div class="task-info">
                <div class="task-name">{{ task.name }}</div>
                <div class="task-meta">
                  创建于 {{ formatDate(task.createdAt) }}
                  <span v-if="task.completedAt">
                    · 耗时 {{ formatDuration(task.startedAt, task.completedAt) }}
                  </span>
                </div>
              </div>
              <a-tag :color="taskStatusColor(task.status)" size="small">
                {{ taskStatusLabel(task.status) }}
              </a-tag>
            </div>
            
            <div class="task-card-right">
              <div class="task-stats">
                <span class="stat-success">{{ task.successCount }} 成功</span>
                <span class="stat-failed" v-if="task.failedCount > 0">{{ task.failedCount }} 失败</span>
                <span class="stat-total">/ {{ task.totalCount }}</span>
              </div>
              <a-progress
                :percent="Math.round(((task.successCount + task.failedCount) / task.totalCount) * 100)"
                :status="task.status === 'completed' ? 'success' : task.status === 'failed' ? 'danger' : undefined"
                :stroke-width="4"
                :show-text="false"
                style="width: 120px"
              />
              <ChevronRight :size="20" class="text-gray-400" />
            </div>
          </div>

          <div v-if="batchTaskStore.taskList.length === 0" class="empty-state">
            <Inbox :size="48" class="mb-2" />
            <p>暂无批量任务记录</p>
            <a-button type="primary" size="small" class="mt-2" @click="goToBatch">
              创建第一个批量任务
            </a-button>
          </div>
        </div>

        <div v-if="batchTaskStore.total > batchTaskStore.pageSize" class="pagination-container">
          <a-pagination
            :total="batchTaskStore.total"
            :page-size="batchTaskStore.pageSize"
            v-model:current="batchTaskStore.page"
            @change="fetchTasks"
            :show-total="true"
          />
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Plus, ChevronRight, AlertCircle, RefreshCw, Inbox } from 'lucide-vue-next'
import { useBatchTaskStore } from '@/stores/batchTask'
import { Message } from '@arco-design/web-vue'
import TaskProgressComponent from '@/components/TaskProgress.vue'
import type { TaskProgress } from '@/stores/batchTask'

const route = useRoute()
const router = useRouter()
const batchTaskStore = useBatchTaskStore()

const filterStatus = ref('')
const itemFilterStatus = ref('')
const selectedTask = ref<number | null>(null)
const selectedTaskProgress = ref<TaskProgress | null>(null)
const retrying = ref(false)

onMounted(() => {
  const taskId = route.query.taskId
  if (taskId) {
    selectTask(parseInt(taskId as string))
  } else {
    fetchTasks()
  }
})

async function fetchTasks() {
  await batchTaskStore.fetchTaskList(filterStatus.value || undefined)
}

async function selectTask(taskId: number) {
  selectedTask.value = taskId
  const progress = await batchTaskStore.fetchTaskProgress(taskId)
  selectedTaskProgress.value = progress
  await fetchTaskItems()
}

async function fetchTaskItems() {
  if (!selectedTask.value) return
  await batchTaskStore.fetchTaskItems(selectedTask.value, itemFilterStatus.value || undefined)
}

async function retryFailedItems() {
  if (!selectedTask.value) return
  
  retrying.value = true
  try {
    const newTaskId = await batchTaskStore.retryFailedItems(selectedTask.value)
    Message.success(`已创建重试任务，共 ${selectedTaskProgress.value?.task.failedCount} 项`)
    batchTaskStore.startPolling(newTaskId)
    router.push({ name: 'batch', query: { taskId: String(newTaskId) } })
  } catch (e: any) {
    Message.error(e.message || '重试失败')
  } finally {
    retrying.value = false
  }
}

function goToBatch() {
  router.push({ name: 'batch' })
}

function downloadFile(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = `mockup-${Date.now()}.png`
  a.click()
}

function taskStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'gray',
    running: 'blue',
    paused: 'orange',
    cancelled: 'gray',
    completed: 'green',
    failed: 'red'
  }
  return map[status] || 'gray'
}

function taskStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    paused: '已暂停',
    cancelled: '已取消',
    completed: '已完成',
    failed: '失败'
  }
  return map[status] || status
}

function itemStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'gray',
    processing: 'blue',
    success: 'green',
    failed: 'red',
    skipped: 'orange'
  }
  return map[status] || 'gray'
}

function itemStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '等待',
    processing: '处理中',
    success: '成功',
    failed: '失败',
    skipped: '跳过'
  }
  return map[status] || status
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return ''
  const diff = new Date(end).getTime() - new Date(start).getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`
  }
  return `${seconds}秒`
}
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 12px;
  align-items: center;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.task-list {
  min-height: 400px;
}

.task-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.15s ease;
}

.task-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.task-card-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.task-info {
  flex: 1;
}

.task-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.task-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.task-card-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.task-stats {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.stat-success {
  color: #10b981;
}

.stat-failed {
  color: #ef4444;
}

.stat-total {
  color: var(--color-text-secondary);
}

.task-items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.task-item-card {
  padding: 12px;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.item-error {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 12px;
  color: #ef4444;
  margin-bottom: 8px;
  line-height: 1.4;
}

.item-actions {
  display: flex;
  justify-content: flex-end;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>
