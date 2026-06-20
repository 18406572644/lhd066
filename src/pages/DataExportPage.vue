<template>
  <div class="p-6 max-w-5xl mx-auto">
    <h2 class="text-lg font-semibold mb-6">数据导出</h2>

    <div class="grid grid-cols-2 gap-6 mb-8">
      <div class="export-card">
        <div class="export-card-header">
          <div class="export-icon json-icon">{ }</div>
          <div>
            <div class="export-card-title">JSON 格式导出</div>
            <div class="export-card-desc">导出完整的个人数据为 JSON 文件，包含所有生成历史、模板和收藏记录</div>
          </div>
        </div>
        <div class="export-card-body">
          <div class="export-tag">包含：个人资料 · 生成历史 · 模板列表 · 收藏记录</div>
        </div>
        <a-button
          type="primary"
          long
          :loading="exportingJson"
          @click="handleExportJson"
        >
          <template #icon><Download :size="16" /></template>
          导出 JSON
        </a-button>
      </div>

      <div class="export-card">
        <div class="export-card-header">
          <div class="export-icon csv-icon">CSV</div>
          <div>
            <div class="export-card-title">CSV 格式导出</div>
            <div class="export-card-desc">导出个人数据为 CSV 文件（打包为 ZIP），方便用 Excel 等工具打开</div>
          </div>
        </div>
        <div class="export-card-body">
          <div class="export-tag">包含：profile.csv · history.csv · templates.csv · favorites.csv</div>
        </div>
        <a-button
          type="primary"
          long
          :loading="exportingCsv"
          @click="handleExportCsv"
        >
          <template #icon><Download :size="16" /></template>
          导出 CSV (ZIP)
        </a-button>
      </div>
    </div>

    <div class="section-header">
      <h3 class="text-base font-semibold">导出历史</h3>
      <a-button size="small" @click="refreshHistory">
        <template #icon><RefreshCw :size="14" /></template>
        刷新
      </a-button>
    </div>

    <a-table
      :data="store.exportRecords"
      :bordered="false"
      :pagination="{ pageSize: 10 }"
      :loading="historyLoading"
    >
      <template #columns>
        <a-table-column title="类型" :width="120">
          <template #cell="{ record }">
            <a-tag :color="record.type === 'personal_data' ? 'blue' : 'green'" size="small">
              {{ record.type === 'personal_data' ? '个人数据' : '分析报告' }}
            </a-tag>
          </template>
        </a-table-column>
        <a-table-column title="格式" data-index="format" :width="80">
          <template #cell="{ record }">
            <span class="uppercase font-medium">{{ record.format }}</span>
          </template>
        </a-table-column>
        <a-table-column title="状态" :width="100">
          <template #cell="{ record }">
            <a-tag
              :color="statusColor(record.status)"
              size="small"
            >{{ statusLabel(record.status) }}</a-tag>
          </template>
        </a-table-column>
        <a-table-column title="创建时间" data-index="createdAt" :width="180" />
        <a-table-column title="操作" :width="100">
          <template #cell="{ record }">
            <a-button
              v-if="record.status === 'completed'"
              type="text"
              size="mini"
              @click="handleDownload(record)"
            >
              <template #icon><Download :size="14" /></template>
              下载
            </a-button>
            <span v-else class="text-gray-400 text-xs">-</span>
          </template>
        </a-table-column>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Download, RefreshCw } from 'lucide-vue-next'
import { useAnalyticsStore } from '@/stores/analytics'
import { downloadFile } from '@/utils/api'
import { Message } from '@arco-design/web-vue'

const store = useAnalyticsStore()
const exportingJson = ref(false)
const exportingCsv = ref(false)
const historyLoading = ref(false)

onMounted(() => {
  refreshHistory()
})

async function handleExportJson() {
  exportingJson.value = true
  try {
    await store.exportPersonalData('json')
    Message.success('JSON 导出成功')
    refreshHistory()
  } catch (e: any) {
    Message.error(e.message || '导出失败')
  } finally {
    exportingJson.value = false
  }
}

async function handleExportCsv() {
  exportingCsv.value = true
  try {
    await store.exportPersonalData('csv')
    Message.success('CSV 导出成功')
    refreshHistory()
  } catch (e: any) {
    Message.error(e.message || '导出失败')
  } finally {
    exportingCsv.value = false
  }
}

async function refreshHistory() {
  historyLoading.value = true
  try {
    await store.fetchExportHistory()
  } finally {
    historyLoading.value = false
  }
}

async function handleDownload(record: any) {
  try {
    await downloadFile(`/export/${record.id}/download`)
    Message.success('下载成功')
  } catch (e: any) {
    Message.error(e.message || '下载失败')
  }
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    completed: 'green',
    processing: 'blue',
    pending: 'orange',
    failed: 'red',
  }
  return map[status] || 'gray'
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    completed: '已完成',
    processing: '处理中',
    pending: '等待中',
    failed: '失败',
  }
  return map[status] || status
}
</script>

<style scoped>
.export-card {
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.export-card-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.export-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}
.json-icon {
  background: #eff6ff;
  color: #3b82f6;
}
.csv-icon {
  background: #f0fdf4;
  color: #22c55e;
}
.export-card-title {
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text);
  margin-bottom: 4px;
}
.export-card-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.export-card-body {
  flex: 1;
}
.export-tag {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  padding: 6px 10px;
  border-radius: 6px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
</style>
