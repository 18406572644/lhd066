import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
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

export interface Guide {
  id: string
  type: 'horizontal' | 'vertical'
  position: number
}

interface SnapResult {
  snapped: boolean
  snapX: number
  snapY: number
  guides: { type: 'horizontal' | 'vertical'; position: number }[]
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

  const guides = ref<Guide[]>([])
  const guidesLocked = ref(false)
  const snapEnabled = ref(true)
  const snapThreshold = ref(5)
  const activeSnapGuides = ref<{ type: 'horizontal' | 'vertical'; position: number }[]>([])

  function addGuide(type: 'horizontal' | 'vertical', position: number) {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    guides.value.push({ id, type, position })
    saveGuides()
  }

  function removeGuide(id: string) {
    guides.value = guides.value.filter(g => g.id !== id)
    saveGuides()
  }

  function updateGuidePosition(id: string, position: number) {
    const guide = guides.value.find(g => g.id === id)
    if (guide) {
      guide.position = position
      saveGuides()
    }
  }

  function clearGuides() {
    guides.value = []
    saveGuides()
  }

  function toggleGuidesLocked() {
    guidesLocked.value = !guidesLocked.value
  }

  function toggleSnapEnabled() {
    snapEnabled.value = !snapEnabled.value
  }

  function saveGuides() {
    if (currentTemplate.value) {
      const key = `mockup-guides-${currentTemplate.value.id}`
      localStorage.setItem(key, JSON.stringify(guides.value))
    }
  }

  function loadGuides() {
    if (currentTemplate.value) {
      const key = `mockup-guides-${currentTemplate.value.id}`
      const saved = localStorage.getItem(key)
      if (saved) {
        try {
          guides.value = JSON.parse(saved)
        } catch (e) {
          guides.value = []
        }
      } else {
        guides.value = []
      }
    }
  }

  function calculateSnap(
    designX: number,
    designY: number,
    designWidth: number,
    designHeight: number,
    fitRegion: FitRegion
  ): SnapResult {
    if (!snapEnabled.value) {
      return { snapped: false, snapX: designX, snapY: designY, guides: [] }
    }

    let snappedX = designX
    let snappedY = designY
    const snapGuides: { type: 'horizontal' | 'vertical'; position: number }[] = []

    const designLeft = designX
    const designRight = designX + designWidth
    const designCenterX = designX + designWidth / 2
    const designTop = designY
    const designBottom = designY + designHeight
    const designCenterY = designY + designHeight / 2

    const fitLeft = fitRegion.x
    const fitRight = fitRegion.x + fitRegion.width
    const fitCenterX = fitRegion.x + fitRegion.width / 2
    const fitTop = fitRegion.y
    const fitBottom = fitRegion.y + fitRegion.height
    const fitCenterY = fitRegion.y + fitRegion.height / 2

    const threshold = snapThreshold.value

    const verticalTargets = [fitLeft, fitCenterX, fitRight]
    const horizontalTargets = [fitTop, fitCenterY, fitBottom]

    for (const guide of guides.value) {
      if (guide.type === 'vertical') {
        verticalTargets.push(guide.position)
      } else {
        horizontalTargets.push(guide.position)
      }
    }

    let minXDiff = Infinity
    let snappedXTarget: number | null = null
    for (const target of verticalTargets) {
      const diffs = [
        { pos: designLeft - target, offset: target - designLeft },
        { pos: designCenterX - target, offset: target - designCenterX },
        { pos: designRight - target, offset: target - designRight },
      ]
      for (const diff of diffs) {
        if (Math.abs(diff.pos) <= threshold && Math.abs(diff.pos) < minXDiff) {
          minXDiff = Math.abs(diff.pos)
          snappedX = designX + diff.offset
          snappedXTarget = target
        }
      }
    }
    if (snappedXTarget !== null) {
      snapGuides.push({ type: 'vertical', position: snappedXTarget })
    }

    let minYDiff = Infinity
    let snappedYTarget: number | null = null
    for (const target of horizontalTargets) {
      const diffs = [
        { pos: designTop - target, offset: target - designTop },
        { pos: designCenterY - target, offset: target - designCenterY },
        { pos: designBottom - target, offset: target - designBottom },
      ]
      for (const diff of diffs) {
        if (Math.abs(diff.pos) <= threshold && Math.abs(diff.pos) < minYDiff) {
          minYDiff = Math.abs(diff.pos)
          snappedY = designY + diff.offset
          snappedYTarget = target
        }
      }
    }
    if (snappedYTarget !== null) {
      snapGuides.push({ type: 'horizontal', position: snappedYTarget })
    }

    const uniqueGuides = snapGuides.filter((guide, index, self) =>
      index === self.findIndex(g => g.type === guide.type && g.position === guide.position)
    )

    return {
      snapped: snappedX !== designX || snappedY !== designY,
      snapX: snappedX,
      snapY: snappedY,
      guides: uniqueGuides,
    }
  }

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
    guides, guidesLocked, snapEnabled, snapThreshold, activeSnapGuides,
    addGuide, removeGuide, updateGuidePosition, clearGuides,
    toggleGuidesLocked, toggleSnapEnabled, saveGuides, loadGuides, calculateSnap,
    generateMockup, batchGenerate, resetGenerator,
  }
})
