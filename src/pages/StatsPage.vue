<template>
  <div class="p-6 max-w-5xl mx-auto">
    <h2 class="text-lg font-semibold mb-6">数据统计</h2>

    <div v-if="store.loading" class="grid grid-cols-4 gap-4">
      <a-skeleton v-for="i in 4" :key="i" animation>
        <a-skeleton-shape style="width: 100%; height: 120px; border-radius: 12px" />
      </a-skeleton>
    </div>

    <template v-else>
      <div class="grid grid-cols-4 gap-4 mb-8">
        <div class="stat-card">
          <div class="stat-value">{{ store.overview.totalTemplates }}</div>
          <div class="stat-label">模板总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ store.overview.totalGenerations }}</div>
          <div class="stat-label">生成总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ store.overview.totalUsers }}</div>
          <div class="stat-label">用户总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ store.overview.todayGenerations }}</div>
          <div class="stat-label">今日生成</div>
        </div>
      </div>

      <div class="section-label">热门模板</div>
      <a-table
        :data="store.popularTemplates"
        :bordered="false"
        :pagination="false"
      >
        <template #columns>
          <a-table-column title="排名" :width="60">
            <template #cell="{ rowIndex }">{{ rowIndex + 1 }}</template>
          </a-table-column>
          <a-table-column title="名称" data-index="name" />
          <a-table-column title="分类" data-index="category" :width="100">
            <template #cell="{ record }">
              <a-tag size="small">{{ getCategoryLabel(record.category) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="使用次数" data-index="useCount" :width="120" />
        </template>
      </a-table>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useStatsStore } from '@/stores/stats'
import { getCategoryLabel } from '@/constants'

const store = useStatsStore()

onMounted(() => {
  store.fetchOverview()
  store.fetchPopularTemplates()
})
</script>

<style scoped>
.stat-card {
  background: var(--color-bg);
  border-radius: var(--radius-md);
  padding: 24px 20px;
  border: 1px solid var(--color-border);
  text-align: center;
}
.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.2;
}
.stat-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}
.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}
</style>
