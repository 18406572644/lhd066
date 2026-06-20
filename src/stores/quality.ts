import { defineStore } from 'pinia'
import { ref } from 'vue'
import { get, post, put } from '@/utils/api'

export interface QualityIssue {
  dimension: string
  severity: 'critical' | 'warning' | 'info'
  message: string
}

export interface QualitySuggestion {
  dimension: string
  message: string
}

export interface QualityReportData {
  id: number
  templateId: number
  fitRegionScore: number
  imageQualityScore: number
  metadataScore: number
  accessibilityScore: number
  totalScore: number
  grade: 'S' | 'A' | 'B' | 'C'
  issues: QualityIssue[]
  suggestions: QualitySuggestion[]
  autoTags: string[]
  reviewStatus: 'auto' | 'pending' | 'approved' | 'rejected'
  reviewedBy: number | null
  reviewedAt: string | null
  createdAt: string
}

export interface PendingReviewItem {
  id: number
  templateId: number
  templateName: string
  imageUrl: string
  category: string
  uploaderName: string
  totalScore: number
  grade: string
  issues: QualityIssue[]
  reviewStatus: string
  createdAt: string
}

export const useQualityStore = defineStore('quality', () => {
  const currentReport = ref<QualityReportData | null>(null)
  const loading = ref(false)
  const pendingReviews = ref<PendingReviewItem[]>([])
  const pendingTotal = ref(0)

  async function inspectTemplate(templateId: number): Promise<QualityReportData> {
    loading.value = true
    try {
      const res = await post<QualityReportData>(`/quality/inspect/${templateId}`)
      currentReport.value = res
      return res
    } finally {
      loading.value = false
    }
  }

  async function fetchReport(templateId: number): Promise<QualityReportData> {
    loading.value = true
    try {
      const res = await get<QualityReportData>(`/quality/report/${templateId}`)
      currentReport.value = res
      return res
    } finally {
      loading.value = false
    }
  }

  async function autoTag(templateId: number): Promise<{ autoTags: string[] }> {
    const res = await post<{ autoTags: string[] }>(`/quality/auto-tag/${templateId}`)
    return res
  }

  async function fetchPendingReviews(page = 1, limit = 20) {
    loading.value = true
    try {
      const res = await get<any>(`/quality/pending-reviews?page=${page}&limit=${limit}`)
      pendingReviews.value = res.items
      pendingTotal.value = res.total
      return res
    } finally {
      loading.value = false
    }
  }

  async function reviewTemplate(templateId: number, action: 'approve' | 'reject'): Promise<QualityReportData> {
    const res = await put<QualityReportData>(`/quality/review/${templateId}`, { action })
    return res
  }

  function clearReport() {
    currentReport.value = null
  }

  return {
    currentReport, loading, pendingReviews, pendingTotal,
    inspectTemplate, fetchReport, autoTag, fetchPendingReviews, reviewTemplate, clearReport,
  }
})
