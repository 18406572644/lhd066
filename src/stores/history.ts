import { defineStore } from 'pinia'
import { ref } from 'vue'
import { get, del } from '@/utils/api'

export interface HistoryRecord {
  id: number
  templateId: number
  templateName: string
  thumbnailUrl: string
  resultUrl: string
  designImageUrl: string
  format: string
  width: number
  createdAt: string
}

interface HistoryListRes {
  items: HistoryRecord[]
  total: number
}

export const useHistoryStore = defineStore('history', () => {
  const records = ref<HistoryRecord[]>([])
  const total = ref(0)
  const loading = ref(false)
  const page = ref(1)
  const pageSize = ref(10)

  async function fetchHistory() {
    loading.value = true
    try {
      const params = new URLSearchParams()
      params.set('page', String(page.value))
      params.set('limit', String(pageSize.value))
      const res = await get<any>(`/history?${params.toString()}`)
      records.value = res.items.map((raw: any) => ({
        id: raw.id,
        templateId: raw.template_id,
        templateName: raw.template_name,
        thumbnailUrl: raw.result_image_url,
        resultUrl: raw.result_image_url,
        designImageUrl: raw.design_image_url,
        format: raw.export_format,
        width: raw.export_width,
        createdAt: raw.created_at,
      }))
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  async function deleteHistory(id: number) {
    await del(`/history/${id}`)
    await fetchHistory()
  }

  return { records, total, loading, page, pageSize, fetchHistory, deleteHistory }
})
