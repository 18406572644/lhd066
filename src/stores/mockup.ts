import { defineStore } from 'pinia'
import { ref } from 'vue'
import { post, upload } from '@/utils/api'
import type { Template } from './template'

interface ExportSettings {
  width: number
  format: string
}

interface FitRegion {
  x: number
  y: number
  width: number
  height: number
}

export const useMockupStore = defineStore('mockup', () => {
  const currentTemplate = ref<Template | null>(null)
  const designImage = ref<string | null>(null)
  const designFile = ref<File | null>(null)
  const offset = ref({ x: 0, y: 0 })
  const scale = ref({ x: 1, y: 1 })
  const exportSettings = ref<ExportSettings>({ width: 2, format: 'png' })
  const generating = ref(false)
  const resultUrl = ref<string | null>(null)
  const batchItems = ref<number[]>([])
  const batchResults = ref<{ templateId: number; status: string; resultUrl?: string }[]>([])

  async function generateMockup() {
    if (!currentTemplate.value || !designFile.value) return
    generating.value = true
    try {
      const fd = new FormData()
      fd.append('image', designFile.value)
      const uploadRes = await upload<{ url: string; width: number; height: number }>('/upload/design-image', fd)
      const res = await post<{ resultUrl: string }>('/mockup/generate', {
        templateId: currentTemplate.value.id,
        designImageUrl: uploadRes.url,
        exportWidth: currentTemplate.value.width * exportSettings.value.width,
        exportHeight: currentTemplate.value.height * exportSettings.value.width,
        exportFormat: exportSettings.value.format,
        offsetX: offset.value.x,
        offsetY: offset.value.y,
        scaleX: scale.value.x,
        scaleY: scale.value.y,
      })
      resultUrl.value = res.resultUrl
    } finally {
      generating.value = false
    }
  }

  async function batchGenerate(files: File[]) {
    generating.value = true
    batchResults.value = batchItems.value.map(id => ({ templateId: id, status: 'pending' }))
    try {
      const uploadedUrls: string[] = []
      for (const file of files) {
        const fd = new FormData()
        fd.append('image', file)
        const uploadRes = await upload<{ url: string; width: number; height: number }>('/upload/design-image', fd)
        uploadedUrls.push(uploadRes.url)
      }
      const { useTemplateStore } = await import('./template')
      const templateStore = useTemplateStore()
      const items = batchItems.value.map((templateId, i) => {
        const tpl = templateStore.templates.find(t => t.id === templateId)
        return {
          templateId,
          designImageUrl: uploadedUrls[i % uploadedUrls.length],
          exportWidth: (tpl?.width ?? 1000) * exportSettings.value.width,
          exportHeight: (tpl?.height ?? 1000) * exportSettings.value.width,
          exportFormat: exportSettings.value.format,
          offsetX: offset.value.x,
          offsetY: offset.value.y,
          scaleX: scale.value.x,
          scaleY: scale.value.y,
        }
      })
      const res = await post<{ results: { templateId: number; status: string; resultUrl?: string }[] }>('/mockup/batch', { items })
      batchResults.value = res.results
    } finally {
      generating.value = false
    }
  }

  function resetGenerator() {
    currentTemplate.value = null
    designImage.value = null
    designFile.value = null
    offset.value = { x: 0, y: 0 }
    scale.value = { x: 1, y: 1 }
    exportSettings.value = { width: 2, format: 'png' }
    generating.value = false
    resultUrl.value = null
  }

  return {
    currentTemplate, designImage, designFile, offset, scale, exportSettings,
    generating, resultUrl, batchItems, batchResults,
    generateMockup, batchGenerate, resetGenerator,
  }
})
