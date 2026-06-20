import { defineStore } from 'pinia'
import { ref } from 'vue'
import { get, post, downloadFile } from '@/utils/api'
import { getCategoryLabel } from '@/constants'

export interface TemplatePerformance {
  id: number
  name: string
  category: string
  useCount: number
  avgRating: number
  ratingCount: number
  favoriteCount: number
  createdAt: string
}

export interface TrendDataPoint {
  date: string
  value: number
}

export interface UserProfileInsight {
  region: string
  country: string
  count: number
  percentage: number
}

export interface CategoryPreference {
  category: string
  count: number
  percentage: number
}

export interface RevenueData {
  date: string
  amount: number
  templateCount: number
}

export interface TopTemplate {
  id: number
  name: string
  category: string
  revenue: number
  salesCount: number
}

export interface OptimizationSuggestion {
  type: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  icon: string
}

export interface AnalyticsSummary {
  totalTemplates: number
  totalUses: number
  avgRating: number
  totalFavorites: number
  totalRevenue: number
}

export interface AnalyticsReport {
  period: string
  dateRange: { start: string; end: string }
  summary: AnalyticsSummary
  templatePerformance: TemplatePerformance[]
  usageTrends: Record<number, TrendDataPoint[]>
  favoriteTrends: Record<number, TrendDataPoint[]>
  userGeography: UserProfileInsight[]
  categoryPreferences: CategoryPreference[]
  revenueTrend: RevenueData[]
  topRevenueTemplates: TopTemplate[]
  suggestions: OptimizationSuggestion[]
}

export interface ExportRecord {
  id: number
  userId: number
  type: string
  format: string
  filePath: string | null
  status: string
  parameters: string | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

function mapPerformance(raw: any): TemplatePerformance {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    useCount: raw.use_count,
    avgRating: raw.avg_rating,
    ratingCount: raw.rating_count,
    favoriteCount: raw.favorite_count,
    createdAt: raw.created_at,
  }
}

function mapSuggestion(raw: any): OptimizationSuggestion {
  return {
    type: raw.type,
    title: raw.title,
    description: raw.description,
    priority: raw.priority,
    icon: raw.icon,
  }
}

export const useAnalyticsStore = defineStore('analytics', () => {
  const summary = ref<AnalyticsReport | null>(null)
  const templatePerformance = ref<TemplatePerformance[]>([])
  const suggestions = ref<OptimizationSuggestion[]>([])
  const userGeography = ref<UserProfileInsight[]>([])
  const categoryPreferences = ref<CategoryPreference[]>([])
  const revenueTrend = ref<RevenueData[]>([])
  const topRevenueTemplates = ref<TopTemplate[]>([])
  const exportRecords = ref<ExportRecord[]>([])
  const loading = ref(false)
  const currentPeriod = ref<'week' | 'month' | 'quarter'>('month')

  async function fetchSummary(period?: 'week' | 'month' | 'quarter') {
    loading.value = true
    try {
      const p = period || currentPeriod.value
      const res = await get<any>(`/analytics/summary?period=${p}`)
      summary.value = {
        period: res.period,
        dateRange: res.dateRange,
        summary: {
          totalTemplates: res.summary.totalTemplates,
          totalUses: res.summary.totalUses,
          avgRating: res.summary.avgRating,
          totalFavorites: res.summary.totalFavorites,
          totalRevenue: res.summary.totalRevenue,
        },
        templatePerformance: (res.templatePerformance || []).map(mapPerformance),
        usageTrends: res.usageTrends || {},
        favoriteTrends: res.favoriteTrends || {},
        userGeography: (res.userGeography || []).map((r: any) => ({
          region: r.region,
          country: r.country,
          count: r.count,
          percentage: r.percentage,
        })),
        categoryPreferences: (res.categoryPreferences || []).map((c: any) => ({
          category: c.category,
          count: c.count,
          percentage: c.percentage,
        })),
        revenueTrend: (res.revenueTrend || []).map((r: any) => ({
          date: r.date,
          amount: r.amount,
          templateCount: r.template_count,
        })),
        topRevenueTemplates: (res.topRevenueTemplates || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          revenue: t.revenue,
          salesCount: t.sales_count,
        })),
        suggestions: (res.suggestions || []).map(mapSuggestion),
      }
    } finally {
      loading.value = false
    }
  }

  async function fetchTemplatePerformance(period?: 'week' | 'month' | 'quarter') {
    loading.value = true
    try {
      const p = period || currentPeriod.value
      const res = await get<any[]>(`/analytics/templates/performance?period=${p}`)
      templatePerformance.value = res.map(mapPerformance)
    } finally {
      loading.value = false
    }
  }

  async function fetchSuggestions(period?: 'week' | 'month' | 'quarter') {
    try {
      const p = period || currentPeriod.value
      const res = await get<any[]>(`/analytics/suggestions?period=${p}`)
      suggestions.value = res.map(mapSuggestion)
    } catch {
      suggestions.value = []
    }
  }

  async function fetchUserGeography(period?: 'week' | 'month' | 'quarter') {
    try {
      const p = period || currentPeriod.value
      const res = await get<any[]>(`/analytics/users/geography?period=${p}`)
      userGeography.value = res.map((r: any) => ({
        region: r.region,
        country: r.country,
        count: r.count,
        percentage: r.percentage,
      }))
    } catch {
      userGeography.value = []
    }
  }

  async function fetchCategoryPreferences(period?: 'week' | 'month' | 'quarter') {
    try {
      const p = period || currentPeriod.value
      const res = await get<any[]>(`/analytics/users/category-preferences?period=${p}`)
      categoryPreferences.value = res.map((c: any) => ({
        category: c.category,
        count: c.count,
        percentage: c.percentage,
      }))
    } catch {
      categoryPreferences.value = []
    }
  }

  async function fetchRevenueTrend(period?: 'week' | 'month' | 'quarter') {
    try {
      const p = period || currentPeriod.value
      const res = await get<any[]>(`/analytics/revenue/trend?period=${p}`)
      revenueTrend.value = res.map((r: any) => ({
        date: r.date,
        amount: r.amount,
        templateCount: r.template_count,
      }))
    } catch {
      revenueTrend.value = []
    }
  }

  async function fetchTopRevenueTemplates(period?: 'week' | 'month' | 'quarter') {
    try {
      const p = period || currentPeriod.value
      const res = await get<any[]>(`/analytics/revenue/top-templates?period=${p}`)
      topRevenueTemplates.value = res.map((t: any) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        revenue: t.revenue,
        salesCount: t.sales_count,
      }))
    } catch {
      topRevenueTemplates.value = []
    }
  }

  async function fetchExportHistory(page = 1, limit = 20) {
    try {
      const res = await get<any>(`/export/history?page=${page}&limit=${limit}`)
      exportRecords.value = (res.items || []).map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        type: r.type,
        format: r.format,
        filePath: r.file_path,
        status: r.status,
        parameters: r.parameters,
        errorMessage: r.error_message,
        createdAt: r.created_at,
        completedAt: r.completed_at,
      }))
      return res
    } catch {
      exportRecords.value = []
      return { items: [], total: 0 }
    }
  }

  async function exportPersonalData(format: 'json' | 'csv') {
    await downloadFile(`/export/personal?format=${format}`, `personal-data.${format === 'csv' ? 'zip' : 'json'}`)
  }

  async function downloadAnalyticsReport(period?: 'week' | 'month' | 'quarter') {
    const p = period || currentPeriod.value
    await downloadFile(`/analytics/report/pdf?period=${p}`, `analytics-report-${p}.pdf`)
  }

  async function rateTemplate(templateId: number, rating: number, comment?: string) {
    await post(`/analytics/templates/${templateId}/rate`, { rating, comment })
  }

  async function toggleFavorite(templateId: number) {
    const res = await post<{ isFavorite: boolean }>(`/analytics/templates/${templateId}/favorite`)
    return res.isFavorite
  }

  function setPeriod(period: 'week' | 'month' | 'quarter') {
    currentPeriod.value = period
  }

  return {
    summary,
    templatePerformance,
    suggestions,
    userGeography,
    categoryPreferences,
    revenueTrend,
    topRevenueTemplates,
    exportRecords,
    loading,
    currentPeriod,
    fetchSummary,
    fetchTemplatePerformance,
    fetchSuggestions,
    fetchUserGeography,
    fetchCategoryPreferences,
    fetchRevenueTrend,
    fetchTopRevenueTemplates,
    fetchExportHistory,
    exportPersonalData,
    downloadAnalyticsReport,
    rateTemplate,
    toggleFavorite,
    setPeriod,
  }
})
