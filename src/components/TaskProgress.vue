<template>
  <div v-if="progress" class="task-progress-container">
    <div class="progress-header">
      <div class="task-name">{{ progress.task.name }}</div>
      <div class="task-status-badge" :class="statusClass">
        {{ statusLabel }}
      </div>
    </div>

    <div class="progress-stats">
      <div class="stat-item">
        <div class="stat-value text-primary">{{ progress.task.totalCount }}</div>
        <div class="stat-label">总数量</div>
      </div>
      <div class="stat-item">
        <div class="stat-value text-success">{{ progress.task.successCount }}</div>
        <div class="stat-label">成功</div>
      </div>
      <div class="stat-item">
        <div class="stat-value text-danger">{{ progress.task.failedCount }}</div>
        <div class="stat-label">失败</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{{ progress.progress }}%</div>
        <div class="stat-label">完成度</div>
      </div>
    </div>

    <div class="progress-bar-container">
      <a-progress
        :percent="progress.progress"
        :status="progressBarStatus"
        :stroke-width="8"
        :show-text="false"
      />
      <div class="progress-text">
        {{ progress.task.successCount + progress.task.failedCount }} / {{ progress.task.totalCount }}
      </div>
    </div>

    <div v-if="progress.currentItem" class="current-item">
      <div class="current-item-label">
        <Loader2 v-if="progress.task.status === 'running'" class="animate-spin" :size="16" />
        <PauseCircle v-else-if="progress.task.status === 'paused'" :size="16" />
        正在处理：{{ progress.currentItem.templateName }}
      </div>
    </div>

    <div v-if="showActions && ['running', 'paused'].includes(progress.task.status)" class="progress-actions">
      <a-button
        v-if="progress.task.status === 'running'"
        size="small"
        @click="$emit('pause')"
      >
        <template #icon><PauseCircle :size="16" /></template>
        暂停
      </a-button>
      <a-button
        v-if="progress.task.status === 'paused'"
        type="primary"
        size="small"
        @click="$emit('resume')"
      >
        <template #icon><PlayCircle :size="16" /></template>
        继续
      </a-button>
      <a-button
        size="small"
        status="danger"
        @click="$emit('cancel')"
      >
        <template #icon><StopCircle :size="16" /></template>
        取消
      </a-button>
    </div>

    <div v-if="showRecentItems && progress.recentItems.length > 0" class="recent-items">
      <div class="recent-items-label">最近处理</div>
      <div class="recent-items-list">
        <div
          v-for="item in progress.recentItems"
          :key="item.id"
          class="recent-item"
        >
          <a-tag :color="itemStatusColor(item.status)" size="small">
            {{ itemStatusLabel(item.status) }}
          </a-tag>
          <span class="item-name">{{ item.templateName }}</span>
          <a-tooltip v-if="item.errorMessage" :content="item.errorMessage">
            <AlertCircle class="text-danger cursor-help" :size="16" />
          </a-tooltip>
          <a-button
            v-if="item.resultImageUrl"
            type="text"
            size="mini"
            @click="$emit('download', item.resultImageUrl)"
          >
            下载
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Loader2, PauseCircle, PlayCircle, StopCircle, AlertCircle } from 'lucide-vue-next'
import type { TaskProgress } from '@/stores/batchTask'

interface Props {
  progress: TaskProgress | null
  showActions?: boolean
  showRecentItems?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showActions: true,
  showRecentItems: true
})

defineEmits<{
  pause: []
  resume: []
  cancel: []
  download: [url: string]
}>()

const statusClass = computed(() => {
  if (!props.progress) return ''
  const map: Record<string, string> = {
    pending: 'status-pending',
    running: 'status-running',
    paused: 'status-paused',
    cancelled: 'status-cancelled',
    completed: 'status-completed',
    failed: 'status-failed'
  }
  return map[props.progress.task.status] || ''
})

const statusLabel = computed(() => {
  if (!props.progress) return ''
  const map: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    paused: '已暂停',
    cancelled: '已取消',
    completed: '已完成',
    failed: '失败'
  }
  return map[props.progress.task.status] || ''
})

const progressBarStatus = computed(() => {
  if (!props.progress) return undefined
  if (props.progress.task.status === 'completed') return 'success' as const
  if (props.progress.task.status === 'failed') return 'danger' as const
  if (props.progress.task.status === 'cancelled') return 'danger' as const
  return undefined
})

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
</script>

<style scoped>
.task-progress-container {
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  padding: 20px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.task-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.task-status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.status-running {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-paused {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.status-cancelled {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.status-completed {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-failed {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.progress-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-item {
  text-align: center;
  padding: 12px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.text-primary {
  color: #3b82f6;
}

.text-success {
  color: #10b981;
}

.text-danger {
  color: #ef4444;
}

.progress-bar-container {
  position: relative;
  margin-bottom: 16px;
}

.progress-text {
  position: absolute;
  right: 0;
  top: -24px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.current-item {
  padding: 12px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-item-label {
  font-size: 13px;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.progress-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.recent-items-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.recent-items-list {
  max-height: 200px;
  overflow-y: auto;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  margin-bottom: 4px;
  font-size: 13px;
}

.item-name {
  flex: 1;
  color: var(--color-text);
}

.cursor-help {
  cursor: help;
}
</style>
