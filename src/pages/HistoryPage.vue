<template>
  <div class="p-6 max-w-5xl mx-auto">
    <h2 class="text-lg font-semibold mb-4">历史记录</h2>

    <a-table
      v-if="store.records.length > 0"
      :data="store.records"
      :loading="store.loading"
      :pagination="{
        current: store.page,
        pageSize: store.pageSize,
        total: store.total,
        showTotal: true,
      }"
      @page-change="onPageChange"
      :bordered="false"
      row-class="history-row"
    >
      <template #columns>
        <a-table-column title="预览" :width="80">
          <template #cell="{ record }">
            <img :src="record.thumbnailUrl" class="history-thumb" />
          </template>
        </a-table-column>
        <a-table-column title="模板" data-index="templateName" />
        <a-table-column title="日期" data-index="createdAt" :width="180" />
        <a-table-column title="格式" data-index="format" :width="80">
          <template #cell="{ record }">
            <a-tag size="small">{{ record.format?.toUpperCase() }}</a-tag>
          </template>
        </a-table-column>
        <a-table-column title="分辨率" :width="80">
          <template #cell="{ record }">
            {{ record.width }}px
          </template>
        </a-table-column>
        <a-table-column title="操作" :width="140" align="center">
          <template #cell="{ record }">
            <a-button type="text" size="mini" @click="onDownload(record)">下载</a-button>
            <a-button type="text" size="mini" status="danger" @click="onDelete(record.id)">删除</a-button>
          </template>
        </a-table-column>
      </template>
    </a-table>

    <div v-if="!store.loading && store.records.length === 0" class="py-20">
      <a-empty description="暂无历史记录" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useHistoryStore } from '@/stores/history'
import { Message, Modal } from '@arco-design/web-vue'
import type { HistoryRecord } from '@/stores/history'

const store = useHistoryStore()

onMounted(() => {
  store.fetchHistory()
})

function onPageChange(page: number) {
  store.page = page
  store.fetchHistory()
}

function onDownload(record: HistoryRecord) {
  const a = document.createElement('a')
  a.href = record.resultUrl
  a.download = `mockup-${record.templateName}-${Date.now()}.${record.format}`
  a.click()
}

function onDelete(id: number) {
  Modal.warning({
    title: '确认删除',
    content: '确定要删除这条记录吗？',
    hideCancel: false,
    onOk: async () => {
      await store.deleteHistory(id)
      Message.success('已删除')
    },
  })
}
</script>

<style scoped>
.history-thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}
</style>
