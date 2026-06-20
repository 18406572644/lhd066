<template>
  <div class="p-6 max-w-6xl mx-auto analytics-page">
    <div class="page-header">
      <h2 class="text-lg font-semibold">数据分析报告</h2>
      <div class="header-actions">
        <a-radio-group v-model="period" type="button" size="small" @change="handlePeriodChange">
          <a-radio value="week">周报</a-radio>
          <a-radio value="month">月报</a-radio>
          <a-radio value="quarter">季报</a-radio>
        </a-radio-group>
        <a-button type="primary" size="small" :loading="pdfLoading" @click="handleDownloadPdf">
          <template #icon><FileDown :size="14" /></template>
          下载 PDF 报告
        </a-button>
      </div>
    </div>

    <a-spin :loading="store.loading" style="width: 100%">
      <template v-if="store.summary">

        <div class="grid grid-cols-5 gap-4 mb-6">
          <div class="stat-card">
            <div class="stat-icon" style="background:#eff6ff;color:#3b82f6"><Layers :size="18" /></div>
            <div class="stat-info">
              <div class="stat-value">{{ store.summary.summary.totalTemplates }}</div>
              <div class="stat-label">模板总数</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#f0fdf4;color:#22c55e"><MousePointerClick :size="18" /></div>
            <div class="stat-info">
              <div class="stat-value">{{ store.summary.summary.totalUses }}</div>
              <div class="stat-label">总使用次数</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#fefce8;color:#eab308"><Star :size="18" /></div>
            <div class="stat-info">
              <div class="stat-value">{{ store.summary.summary.avgRating }}</div>
              <div class="stat-label">平均评分</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#fef2f2;color:#ef4444"><Heart :size="18" /></div>
            <div class="stat-info">
              <div class="stat-value">{{ store.summary.summary.totalFavorites }}</div>
              <div class="stat-label">总收藏数</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background:#faf5ff;color:#a855f7"><DollarSign :size="18" /></div>
            <div class="stat-info">
              <div class="stat-value">¥{{ store.summary.summary.totalRevenue.toFixed(2) }}</div>
              <div class="stat-label">总收入</div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-6 mb-6">
          <div class="panel-card">
            <div class="panel-title">模板表现排行</div>
            <a-table
              :data="store.summary.templatePerformance.slice(0, 8)"
              :bordered="false"
              :pagination="false"
              size="small"
            >
              <template #columns>
                <a-table-column title="#" :width="40">
                  <template #cell="{ rowIndex }">
                    <span
                      class="rank-badge"
                      :class="rowIndex < 3 ? `rank-${rowIndex + 1}` : ''"
                    >{{ rowIndex + 1 }}</span>
                  </template>
                </a-table-column>
                <a-table-column title="名称" data-index="name" ellipsis />
                <a-table-column title="分类" :width="70">
                  <template #cell="{ record }">
                    <a-tag size="small">{{ getCategoryLabel(record.category) }}</a-tag>
                  </template>
                </a-table-column>
                <a-table-column title="使用" data-index="useCount" :width="60" />
                <a-table-column title="评分" :width="70">
                  <template #cell="{ record }">
                    <span :class="ratingClass(record.avgRating)">★ {{ record.avgRating }}</span>
                  </template>
                </a-table-column>
                <a-table-column title="收藏" data-index="favoriteCount" :width="60" />
              </template>
            </a-table>
          </div>

          <div class="panel-card">
            <div class="panel-title">分类偏好</div>
            <div v-if="store.summary.categoryPreferences.length === 0" class="empty-hint">暂无数据</div>
            <div v-else class="bar-chart">
              <div
                v-for="cat in store.summary.categoryPreferences"
                :key="cat.category"
                class="bar-row"
              >
                <div class="bar-label">{{ getCategoryLabel(cat.category) }}</div>
                <div class="bar-track">
                  <div
                    class="bar-fill"
                    :style="{ width: cat.percentage + '%' }"
                    :class="`bar-${cat.category}`"
                  >
                    <span class="bar-text">{{ cat.count }}次 ({{ cat.percentage }}%)</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="panel-title" style="margin-top:24px">用户地域分布</div>
            <div v-if="store.summary.userGeography.length === 0" class="empty-hint">暂无数据</div>
            <div v-else class="geo-grid">
              <div
                v-for="(region, i) in store.summary.userGeography.slice(0, 6)"
                :key="i"
                class="geo-card"
                :class="`geo-color-${i % 6}`"
              >
                <div class="geo-region">{{ region.region || '未知' }}</div>
                <div class="geo-count">{{ region.count }}人</div>
                <div class="geo-percent">{{ region.percentage }}%</div>
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-6 mb-6">
          <div class="panel-card">
            <div class="panel-title">收入趋势</div>
            <div v-if="store.summary.revenueTrend.length === 0" class="empty-hint">暂无收入数据</div>
            <div v-else class="revenue-chart">
              <div
                v-for="item in store.summary.revenueTrend"
                :key="item.date"
                class="revenue-bar-row"
              >
                <div class="revenue-date">{{ item.date }}</div>
                <div class="revenue-track">
                  <div
                    class="revenue-fill"
                    :style="{ width: revenuePercent(item.amount) + '%' }"
                  >
                    <span class="revenue-text">¥{{ item.amount.toFixed(2) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="panel-card">
            <div class="panel-title">Top 收入模板</div>
            <div v-if="store.summary.topRevenueTemplates.length === 0" class="empty-hint">暂无收入数据</div>
            <a-table
              v-else
              :data="store.summary.topRevenueTemplates.slice(0, 5)"
              :bordered="false"
              :pagination="false"
              size="small"
            >
              <template #columns>
                <a-table-column title="#" :width="40">
                  <template #cell="{ rowIndex }">{{ rowIndex + 1 }}</template>
                </a-table-column>
                <a-table-column title="名称" data-index="name" ellipsis />
                <a-table-column title="分类" :width="70">
                  <template #cell="{ record }">
                    <a-tag size="small">{{ getCategoryLabel(record.category) }}</a-tag>
                  </template>
                </a-table-column>
                <a-table-column title="销售额" :width="90">
                  <template #cell="{ record }">
                    <span style="color:#22c55e;font-weight:600">¥{{ record.revenue.toFixed(2) }}</span>
                  </template>
                </a-table-column>
                <a-table-column title="销量" data-index="salesCount" :width="60" />
              </template>
            </a-table>
          </div>
        </div>

        <div class="panel-card mb-6">
          <div class="panel-title">智能优化建议</div>
          <div v-if="store.summary.suggestions.length === 0" class="empty-hint">暂无优化建议，您的表现非常棒！</div>
          <div v-else class="suggestion-list">
            <div
              v-for="(s, i) in store.summary.suggestions"
              :key="i"
              class="suggestion-card"
              :class="`suggestion-${s.priority}`"
            >
              <div class="suggestion-priority" :class="`priority-${s.priority}`">
                {{ priorityLabel(s.priority) }}
              </div>
              <div class="suggestion-body">
                <div class="suggestion-title">{{ s.title }}</div>
                <div class="suggestion-desc">{{ s.description }}</div>
              </div>
            </div>
          </div>
        </div>

      </template>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  Layers, Star, Heart, DollarSign, FileDown, MousePointerClick
} from 'lucide-vue-next'
import { useAnalyticsStore } from '@/stores/analytics'
import { getCategoryLabel } from '@/constants'
import { Message } from '@arco-design/web-vue'

const store = useAnalyticsStore()
const period = ref<'week' | 'month' | 'quarter'>('month')
const pdfLoading = ref(false)

onMounted(() => {
  store.fetchSummary(period.value)
})

function handlePeriodChange(val: string | number | boolean) {
  const p = val as 'week' | 'month' | 'quarter'
  store.setPeriod(p)
  store.fetchSummary(p)
}

async function handleDownloadPdf() {
  pdfLoading.value = true
  try {
    await store.downloadAnalyticsReport(period.value)
    Message.success('PDF 报告下载成功')
  } catch (e: any) {
    Message.error(e.message || '下载失败')
  } finally {
    pdfLoading.value = false
  }
}

function ratingClass(rating: number) {
  if (rating >= 4) return 'rating-high'
  if (rating >= 3) return 'rating-mid'
  return 'rating-low'
}

function revenuePercent(amount: number) {
  const maxRevenue = Math.max(...(store.summary?.revenueTrend || []).map(r => r.amount), 1)
  return Math.max((amount / maxRevenue) * 100, 5)
}

function priorityLabel(priority: string) {
  const map: Record<string, string> = { high: '高优先级', medium: '中优先级', low: '低优先级' }
  return map[priority] || priority
}
</script>

<style scoped>
.analytics-page { min-height: 100%; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
.stat-card {
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  padding: 16px;
  display: flex;
  gap: 12px;
  align-items: center;
}
.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-info { flex: 1; }
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.2;
}
.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}
.panel-card {
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  padding: 20px;
}
.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}
.empty-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  padding: 20px 0;
}
.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  background: #f3f4f6;
  color: #6b7280;
}
.rank-1 { background: #fbbf24; color: #fff; }
.rank-2 { background: #9ca3af; color: #fff; }
.rank-3 { background: #d97706; color: #fff; }
.rating-high { color: #22c55e; font-weight: 600; }
.rating-mid { color: #eab308; }
.rating-low { color: #ef4444; }

.bar-chart { display: flex; flex-direction: column; gap: 8px; }
.bar-row { display: flex; align-items: center; gap: 8px; }
.bar-label { width: 40px; font-size: 13px; color: var(--color-text); flex-shrink: 0; }
.bar-track { flex: 1; height: 24px; background: var(--color-bg-secondary); border-radius: 6px; overflow: hidden; }
.bar-fill {
  height: 100%;
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  min-width: 40px;
  transition: width 0.3s ease;
}
.bar-text { font-size: 11px; color: #fff; white-space: nowrap; }
.bar-poster { background: #3b82f6; }
.bar-phone { background: #22c55e; }
.bar-computer { background: #eab308; }
.bar-packaging { background: #a855f7; }

.geo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.geo-card {
  border-radius: 8px;
  padding: 10px;
  text-align: center;
  color: #fff;
}
.geo-color-0 { background: #3b82f6; }
.geo-color-1 { background: #22c55e; }
.geo-color-2 { background: #eab308; }
.geo-color-3 { background: #ef4444; }
.geo-color-4 { background: #a855f7; }
.geo-color-5 { background: #ec4899; }
.geo-region { font-size: 11px; opacity: 0.9; }
.geo-count { font-size: 16px; font-weight: 700; margin: 2px 0; }
.geo-percent { font-size: 11px; opacity: 0.8; }

.revenue-chart { display: flex; flex-direction: column; gap: 6px; }
.revenue-bar-row { display: flex; align-items: center; gap: 8px; }
.revenue-date { width: 70px; font-size: 12px; color: var(--color-text-secondary); flex-shrink: 0; }
.revenue-track { flex: 1; height: 22px; background: var(--color-bg-secondary); border-radius: 6px; overflow: hidden; }
.revenue-fill {
  height: 100%;
  border-radius: 6px;
  background: linear-gradient(90deg, #22c55e, #16a34a);
  display: flex;
  align-items: center;
  padding: 0 8px;
  min-width: 30px;
}
.revenue-text { font-size: 11px; color: #fff; white-space: nowrap; }

.suggestion-list { display: flex; flex-direction: column; gap: 10px; }
.suggestion-card {
  display: flex;
  gap: 12px;
  padding: 14px;
  border-radius: 8px;
  align-items: flex-start;
}
.suggestion-high { background: #fef2f2; }
.suggestion-medium { background: #fefce8; }
.suggestion-low { background: #f0fdf4; }
.suggestion-priority {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}
.priority-high { background: #fecaca; color: #dc2626; }
.priority-medium { background: #fef08a; color: #a16207; }
.priority-low { background: #bbf7d0; color: #16a34a; }
.suggestion-body { flex: 1; }
.suggestion-title { font-size: 14px; font-weight: 600; color: var(--color-text); margin-bottom: 4px; }
.suggestion-desc { font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; }
</style>
