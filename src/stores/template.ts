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
    description: raw.description,
    imageUrl: raw.image_url,
    width: raw.width,
    height: raw.height,
    fitRegion: { x: raw.fit_x, y: raw.fit_y, width: raw.fit_width, height: raw.fit_height },
    tags: raw.tags,
    useCount: raw.use_count,
    permission: raw.permission,
    userId: raw.user_id,
    createdAt: raw.created_at,
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
    return mapTemplate(res)
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

  return {
    templates, currentTemplate, total, loading, filters,
    fetchTemplates, fetchTemplate, createTemplate, updateTemplate, deleteTemplate, shareTemplate,
  }
})
