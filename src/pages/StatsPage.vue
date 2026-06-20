<template>
  <div class="p-6 max-w-6xl mx-auto">
    <h2 class="text-lg font-semibold mb-6">数据统计</h2>

    <div v-if="store.loading && !analyticsStore.summary" class="grid grid-cols-4 gap-4">
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

      <div v-if="analyticsData" class="mb-8">
        <div class="section-header">
          <div class="section-label mb-0">设计师数据概览</div>
          <a-radio-group v-model="period" type="button" size="mini" @change="handlePeriodChange">
            <a-radio value="week">周</a-radio>
            <a-radio value="month">月</a-radio>
            <a-radio value="quarter">季</a-radio>
          </a-radio-group>
        </div>

        <div class="grid grid-cols-5 gap-4 mb-6">
          <div class="stat-card-sm">
            <div class="stat-icon-sm" style="background:#eff6ff;color:#3b82f6"><Layers :size="16" /></div>
            <div class="stat-value-sm">{{ analyticsData.summary.totalTemplates }}</div>
            <div class="stat-label-sm">我的模板</div>
          </div>
          <div class="stat-card-sm">
            <div class="stat-icon-sm" style="background:#f0fdf4;color:#22c55e"><MousePointerClick :size="16" /></div>
            <div class="stat-value-sm">{{ analyticsData.summary.totalUses }}</div>
            <div class="stat-label-sm">使用次数</div>
          </div>
          <div class="stat-card-sm">
            <div class="stat-icon-sm" style="background:#fefce8;color:#eab308"><Star :size="16" /></div>
            <div class="stat-value-sm">{{ analyticsData.summary.avgRating }}</div>
            <div class="stat-label-sm">平均评分</div>
          </div>
          <div class="stat-card-sm">
            <div class="stat-icon-sm" style="background:#fef2f2;color:#ef4444"><Heart :size="16" /></div>
            <div class="stat-value-sm">{{ analyticsData.summary.totalFavorites }}</div>
            <div class="stat-label-sm">收藏总数</div>
          </div>
          <div class="stat-card-sm">
            <div class="stat-icon-sm" style="background:#faf5ff;color:#a855f7"><DollarSign :size="16" /></div>
            <div class="stat-value-sm">¥{{ analyticsData.summary.totalRevenue.toFixed(2) }}</div>
            <div class="stat-label-sm">总收入</div>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="mini-panel">
            <div class="mini-panel-title">分类偏好</div>
            <div v-if="analyticsData.categoryPreferences.length === 0" class="empty-text">暂无数据</div>
            <div v-else class="mini-bar-list">
              <div v-for="cat in analyticsData.categoryPreferences" :key="cat.category" class="mini-bar-row">
                <span class="mini-bar-label">{{ getCategoryLabel(cat.category) }}</span>
                <div class="mini-bar-track">
                  <div class="mini-bar-fill" :class="`bar-${cat.category}`" :style="{ width: cat.percentage + '%' }" />
                </div>
                <span class="mini-bar-val">{{ cat.percentage }}%</span>
              </div>
            </div>
          </div>

          <div class="mini-panel">
            <div class="mini-panel-title">用户地域 Top5</div>
            <div v-if="analyticsData.userGeography.length === 0" class="empty-text">暂无数据</div>
            <div v-else class="geo-list">
              <div v-for="(r, i) in analyticsData.userGeography.slice(0, 5)" :key="i" class="geo-row">
                <span class="geo-rank">{{ i + 1 }}</span>
                <span class="geo-name">{{ r.region || '未知' }}</span>
                <span class="geo-count">{{ r.count }}人</span>
                <span class="geo-pct">{{ r.percentage }}%</span>
              </div>
            </div>
          </div>

          <div class="mini-panel">
            <div class="mini-panel-title">优化建议</div>
            <div v-if="analyticsData.suggestions.length === 0" class="empty-text">暂无建议</div>
            <div v-else class="suggestion-mini-list">
              <div
                v-for="(s, i) in analyticsData.suggestions.slice(0, 3)"
                :key="i"
                class="suggestion-mini"
                :class="`sug-${s.priority}`"
              >
                <span class="sug-priority" :class="`p-${s.priority}`">{{ priorityLabel(s.priority) }}</span>
                <span class="sug-text">{{ s.title }}</span>
              </div>
            </div>
            <a-button type="text" size="mini" style="margin-top:8px" @click="$router.push('/analytics')">
              查看完整报告 →
            </a-button>
          </div>
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

      <div style="margin-top:24px;text-align:center">
        <a-space>
          <a-button type="outline" @click="$router.push('/export')">
            <template #icon><Download :size="14" /></template>
            导出数据
          </a-button>
          <a-button type="primary" @click="$router.push('/analytics')">
            <template #icon><TrendingUp :size="14" /></template>
            查看分析报告
          </a-button>
        </a-space>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useStatsStore } from '@/stores/stats'
import { useAnalyticsStore } from '@/stores/analytics'
import { getCategoryLabel } from '@/constants'
import { Layers, Star, Heart, DollarSign, Download, TrendingUp, MousePointerClick } from 'lucide-vue-next'

const store = useStatsStore()
const analyticsStore = useAnalyticsStore()
const period = ref<'week' | 'month' | 'quarter'>('month')

const analyticsData = computed(() => analyticsStore.summary)

onMounted(() => {
  store.fetchOverview()
  store.fetchPopularTemplates()
  analyticsStore.fetchSummary(period.value)
})

function handlePeriodChange(val: string | number | boolean) {
  analyticsStore.fetchSummary(val as 'week' | 'month' | 'quarter')
}

function priorityLabel(priority: string) {
  const map: Record<string, string> = { high: '高', medium: '中', low: '低' }
  return map[priority] || priority
}
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
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.stat-card-sm {
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  padding: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.stat-icon-sm {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stat-value-sm {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
}
.stat-label-sm {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.mini-panel {
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  padding: 16px;
}
.mini-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 10px;
}
.empty-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: center;
  padding: 12px 0;
}

.mini-bar-list { display: flex; flex-direction: column; gap: 6px; }
.mini-bar-row { display: flex; align-items: center; gap: 6px; }
.mini-bar-label { width: 32px; font-size: 12px; color: var(--color-text); flex-shrink: 0; }
.mini-bar-track { flex: 1; height: 16px; background: var(--color-bg-secondary); border-radius: 4px; overflow: hidden; }
.mini-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
.mini-bar-val { width: 36px; font-size: 11px; color: var(--color-text-secondary); text-align: right; }
.bar-poster { background: #3b82f6; }
.bar-phone { background: #22c55e; }
.bar-computer { background: #eab308; }
.bar-packaging { background: #a855f7; }

.geo-list { display: flex; flex-direction: column; gap: 4px; }
.geo-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.geo-rank { width: 16px; color: var(--color-text-secondary); }
.geo-name { flex: 1; color: var(--color-text); }
.geo-count { color: var(--color-text-secondary); }
.geo-pct { width: 40px; text-align: right; color: var(--color-primary); font-weight: 500; }

.suggestion-mini-list { display: flex; flex-direction: column; gap: 6px; }
.suggestion-mini { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-radius: 6px; }
.sug-high { background: #fef2f2; }
.sug-medium { background: #fefce8; }
.sug-low { background: #f0fdf4; }
.sug-priority { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 3px; }
.p-high { background: #fecaca; color: #dc2626; }
.p-medium { background: #fef08a; color: #a16207; }
.p-low { background: #bbf7d0; color: #16a34a; }
.sug-text { font-size: 12px; color: var(--color-text); }
</style>
