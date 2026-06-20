import { defineStore } from 'pinia'
import { ref } from 'vue'
import { get, post, put, del } from '@/utils/api'

export interface Template {
  id: number
  name: string
  category: string
  description: string
  imageUrl: string
  width: number
  height: number
  fitRegion: { x: number; y: number; width: number; height: number }
  tags: string[]
  useCount: number
  permission: string
  userId: number
  createdAt: string
  qualityScore: number
  qualityGrade: string
  reviewStatus: string
}

export interface TemplateVersion {
  id: number
  templateId: number
  versionNumber: number
  versionLabel: string
  description: string
  name: string
  category: string
  width: number
  height: number
  imageUrl: string
  fitRegion: { x: number; y: number; width: number; height: number }
  permission: string
  isStable: boolean
  userId: number
  createdAt: string
  tags?: string[]
}

export interface VersionCompareResult {
  v1: TemplateVersion
  v2: TemplateVersion
  diffs: string[]
}

interface TemplateListRes {
  items: Template[]
  total: number
}

function mapTemplate(raw: any): Template {
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    description: raw.description ?? '',
    imageUrl: raw.image_url,
    width: raw.width,
    height: raw.height,
    fitRegion: { x: raw.fit_x, y: raw.fit_y, width: raw.fit_width, height: raw.fit_height },
    tags: raw.tags,
    useCount: raw.use_count,
    permission: raw.permission,
    userId: raw.user_id,
    createdAt: raw.created_at,
    qualityScore: raw.quality_score ?? 0,
    qualityGrade: raw.quality_grade ?? 'C',
    reviewStatus: raw.review_status ?? 'auto',
  }
}

function mapVersion(raw: any): TemplateVersion {
  return {
    id: raw.id,
    templateId: raw.templateId ?? raw.template_id,
    versionNumber: raw.versionNumber ?? raw.version_number,
    versionLabel: raw.versionLabel ?? raw.version_label,
    description: raw.description ?? '',
    name: raw.name,
    category: raw.category,
    width: raw.width,
    height: raw.height,
    imageUrl: raw.imageUrl ?? raw.image_url,
    fitRegion: raw.fitRegion ?? { x: raw.fit_x, y: raw.fit_y, width: raw.fit_width, height: raw.fit_height },
    permission: raw.permission,
    isStable: raw.isStable ?? raw.is_stable === 1,
    userId: raw.userId ?? raw.user_id,
    createdAt: raw.createdAt ?? raw.created_at,
    tags: raw.tags,
  }
}

export const useTemplateStore = defineStore('template', () => {
  const templates = ref<Template[]>([])
  const currentTemplate = ref<Template | null>(null)
  const total = ref(0)
  const loading = ref(false)
  const filters = ref({
    category: '',
    keyword: '',
    tag: '',
    page: 1,
    pageSize: 12,
  })

  const versions = ref<TemplateVersion[]>([])
  const versionsLoading = ref(false)
  const activeVersion = ref<TemplateVersion | null>(null)
  const stableVersion = ref<TemplateVersion | null>(null)
  const compareResult = ref<VersionCompareResult | null>(null)

  async function fetchTemplates() {
    loading.value = true
    try {
      const params = new URLSearchParams()
      if (filters.value.category) params.set('category', filters.value.category)
      if (filters.value.keyword) params.set('keyword', filters.value.keyword)
      if (filters.value.tag) params.set('tag', filters.value.tag)
      params.set('page', String(filters.value.page))
      params.set('limit', String(filters.value.pageSize))
      const res = await get<any>(`/templates?${params.toString()}`)
      templates.value = res.items.map(mapTemplate)
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  async function fetchTemplate(id: number) {
    loading.value = true
    try {
      const res = await get<any>(`/templates/${id}`)
      currentTemplate.value = mapTemplate(res)
      return currentTemplate.value
    } finally {
      loading.value = false
    }
  }

  async function createTemplate(data: FormData) {
    const { upload } = await import('@/utils/api')
    const res = await upload<any>('/templates', data)
    const template = mapTemplate(res)
    return { ...template, qualityReport: res.qualityReport || null }
  }

  async function updateTemplate(id: number, data: Record<string, unknown>) {
    return put<Template>(`/templates/${id}`, data)
  }

  async function deleteTemplate(id: number) {
    return del(`/templates/${id}`)
  }

  async function shareTemplate(id: number) {
    return post<{ shareToken: string }>(`/templates/${id}/share`)
  }

  async function fetchVersions(templateId: number) {
    versionsLoading.value = true
    try {
      const res = await get<any>(`/templates/${templateId}/versions`)
      versions.value = res.items.map(mapVersion)
      stableVersion.value = versions.value.find(v => v.isStable) || null
      return versions.value
    } finally {
      versionsLoading.value = false
    }
  }

  async function fetchVersion(templateId: number, versionId: number) {
    const res = await get<any>(`/templates/${templateId}/versions/${versionId}`)
    activeVersion.value = mapVersion(res)
    return activeVersion.value
  }

  async function fetchStableVersion(templateId: number) {
    try {
      const res = await get<any>(`/templates/${templateId}/versions/stable`)
      stableVersion.value = mapVersion(res)
      return stableVersion.value
    } catch (e) {
      stableVersion.value = null
      return null
    }
  }

  async function createVersion(templateId: number, data: FormData) {
    const { upload } = await import('@/utils/api')
    const res = await upload<any>(`/templates/${templateId}/versions`, data)
    const newVersion = mapVersion(res)
    versions.value.unshift(newVersion)
    activeVersion.value = newVersion
    fetchTemplates()
    return newVersion
  }

  async function setStableVersion(templateId: number, versionId: number) {
    const res = await put<any>(`/templates/${templateId}/versions/${versionId}/stable`, {})
    const updated = mapVersion(res)
    versions.value = versions.value.map(v => ({
      ...v,
      isStable: v.id === versionId ? true : false,
    }))
    stableVersion.value = updated
    if (activeVersion.value?.id === versionId) {
      activeVersion.value.isStable = true
    }
    return updated
  }

  async function rollbackToVersion(templateId: number, versionId: number) {
    const res = await post<any>(`/templates/${templateId}/versions/${versionId}/rollback`, {})
    currentTemplate.value = mapTemplate(res)
    return currentTemplate.value
  }

  async function compareVersions(templateId: number, v1Id: number, v2Id: number) {
    const res = await get<any>(`/templates/${templateId}/versions/compare/${v1Id}/${v2Id}`)
    compareResult.value = {
      v1: mapVersion(res.v1),
      v2: mapVersion(res.v2),
      diffs: res.diffs,
    }
    return compareResult.value
  }

  function clearCompareResult() {
    compareResult.value = null
  }

  function resetVersionsState() {
    versions.value = []
    versionsLoading.value = false
    activeVersion.value = null
    stableVersion.value = null
    compareResult.value = null
  }

  return {
    templates, currentTemplate, total, loading, filters,
    versions, versionsLoading, activeVersion, stableVersion, compareResult,
    fetchTemplates, fetchTemplate, createTemplate, updateTemplate, deleteTemplate, shareTemplate,
    fetchVersions, fetchVersion, fetchStableVersion, createVersion,
    setStableVersion, rollbackToVersion, compareVersions, clearCompareResult, resetVersionsState,
  }
})
