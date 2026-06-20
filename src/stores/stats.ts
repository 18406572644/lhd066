import { defineStore } from 'pinia'
import { ref } from 'vue'
import { get } from '@/utils/api'

interface Overview {
  totalTemplates: number
  totalGenerations: number
  totalUsers: number
  todayGenerations: number
}

interface PopularTemplate {
  id: number
  name: string
  category: string
  useCount: number
}

export const useStatsStore = defineStore('stats', () => {
  const overview = ref<Overview>({
    totalTemplates: 0,
    totalGenerations: 0,
    totalUsers: 0,
    todayGenerations: 0,
  })
  const popularTemplates = ref<PopularTemplate[]>([])
  const loading = ref(false)

  async function fetchOverview() {
    loading.value = true
    try {
      const res = await get<Overview>('/stats/overview')
      overview.value = res
    } finally {
      loading.value = false
    }
  }

  async function fetchPopularTemplates() {
    loading.value = true
    try {
      const res = await get<any[]>('/stats/popular-templates')
      popularTemplates.value = res.map((item: any) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        useCount: item.use_count,
      }))
    } finally {
      loading.value = false
    }
  }

  return { overview, popularTemplates, loading, fetchOverview, fetchPopularTemplates }
})
