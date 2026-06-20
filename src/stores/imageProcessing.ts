import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { post, upload } from '@/utils/api'

export interface BrushStroke {
  x: number
  y: number
  radius: number
  mode: 'keep' | 'erase'
}

export interface FeatherParams {
  radius: number
}

export interface ThresholdParams {
  value: number
  softness: number
}

export interface LightingAdjustParams {
  brightness: number
  contrast: number
  saturation: number
  lightDirection: { x: number; y: number }
  shadowIntensity: number
}

export interface BackgroundReplaceParams {
  type: 'solid' | 'gradient' | 'image'
  solidColor?: { r: number; g: number; b: number; a?: number }
  gradient?: {
    type: 'linear' | 'radial'
    colors: Array<{ offset: number; r: number; g: number; b: number; a?: number }>
    angle?: number
    startX?: number
    startY?: number
    endX?: number
    endY?: number
  }
  imagePath?: string
  imageFit?: 'cover' | 'contain' | 'fill' | 'stretch'
  imageOpacity?: number
}

export interface BackgroundImageItem {
  filename: string
  url: string
}

export const useImageProcessingStore = defineStore('imageProcessing', () => {
  const originalImageUrl = ref<string | null>(null)
  const processedImageUrl = ref<string | null>(null)

  const maskOriginalUrl = ref<string | null>(null)
  const maskCurrentUrl = ref<string | null>(null)

  const isRemovingBackground = ref(false)
  const isApplyingMask = ref(false)
  const isProcessingMask = ref(false)
  const isAnalyzingLighting = ref(false)
  const isMatchingLighting = ref(false)
  const isReplacingBackground = ref(false)
  const isGenerating = ref(false)

  const lightingEnabled = ref(true)
  const lightingParams = ref<LightingAdjustParams | null>(null)
  const customLightingParams = ref<Partial<LightingAdjustParams> | null>(null)

  const templateLightingStats = ref<{
    avgBrightness: number
    avgContrast: number
    dominantLightDirection: { x: number; y: number }
  } | null>(null)

  const designLightingStats = ref<{
    avgBrightness: number
    avgContrast: number
    dominantLightDirection: { x: number; y: number }
  } | null>(null)

  const backgroundParams = ref<BackgroundReplaceParams | null>(null)
  const backgroundImages = ref<BackgroundImageItem[]>([])
  const backgroundReplaceEnabled = ref(false)

  const brushSettings = ref({
    radius: 20,
    mode: 'keep' as 'keep' | 'erase',
  })

  const thresholdSettings = ref<ThresholdParams>({
    value: 0.5,
    softness: 0.1,
  })

  const featherRadius = ref(3)

  const isMaskEditorOpen = ref(false)

  const hasBackground = computed(() => backgroundReplaceEnabled.value && backgroundParams.value !== null)
  const hasMask = computed(() => maskCurrentUrl.value !== null)

  function setOriginalImage(url: string) {
    originalImageUrl.value = url
    processedImageUrl.value = null
    maskOriginalUrl.value = null
    maskCurrentUrl.value = null
  }

  function resetAll() {
    originalImageUrl.value = null
    processedImageUrl.value = null
    maskOriginalUrl.value = null
    maskCurrentUrl.value = null
    lightingParams.value = null
    customLightingParams.value = null
    backgroundParams.value = null
    backgroundReplaceEnabled.value = false
    lightingEnabled.value = true
    designLightingStats.value = null
  }

  function resetTemplateStats() {
    templateLightingStats.value = null
  }

  async function removeBackground(imageUrl: string) {
    isRemovingBackground.value = true
    try {
      const result = await post<{
        processedImageUrl: string
        maskImageUrl: string
      }>('/image-processing/remove-background', { imageUrl })

      processedImageUrl.value = result.processedImageUrl
      maskOriginalUrl.value = result.maskImageUrl
      maskCurrentUrl.value = result.maskImageUrl
      return result
    } finally {
      isRemovingBackground.value = false
    }
  }

  async function applyBrushStrokes(strokes: BrushStroke[], width: number, height: number) {
    if (!maskCurrentUrl.value) return
    isProcessingMask.value = true
    try {
      const result = await post<{ maskImageUrl: string }>('/image-processing/mask/brush', {
        maskUrl: maskCurrentUrl.value,
        width,
        height,
        strokes,
      })
      maskCurrentUrl.value = result.maskImageUrl
      return result
    } finally {
      isProcessingMask.value = false
    }
  }

  async function applyFeather(radius: number) {
    if (!maskCurrentUrl.value) return
    isProcessingMask.value = true
    try {
      const result = await post<{ maskImageUrl: string }>('/image-processing/mask/feather', {
        maskUrl: maskCurrentUrl.value,
        radius,
      })
      maskCurrentUrl.value = result.maskImageUrl
      return result
    } finally {
      isProcessingMask.value = false
    }
  }

  async function applyThreshold(params: ThresholdParams) {
    if (!maskCurrentUrl.value) return
    isProcessingMask.value = true
    try {
      const result = await post<{ maskImageUrl: string }>('/image-processing/mask/threshold', {
        maskUrl: maskCurrentUrl.value,
        ...params,
      })
      maskCurrentUrl.value = result.maskImageUrl
      return result
    } finally {
      isProcessingMask.value = false
    }
  }

  async function applyMaskToCurrent() {
    if (!originalImageUrl.value || !maskCurrentUrl.value) return
    isApplyingMask.value = true
    try {
      const result = await post<{ processedImageUrl: string }>('/image-processing/apply-mask', {
        imageUrl: originalImageUrl.value,
        maskUrl: maskCurrentUrl.value,
      })
      processedImageUrl.value = result.processedImageUrl
      return result
    } finally {
      isApplyingMask.value = false
    }
  }

  async function resetMask() {
    if (!maskOriginalUrl.value) return
    isProcessingMask.value = true
    try {
      const result = await post<{ maskImageUrl: string }>('/image-processing/mask/reset', {
        originalMaskUrl: maskOriginalUrl.value,
      })
      maskCurrentUrl.value = result.maskImageUrl
      return result
    } finally {
      isProcessingMask.value = false
    }
  }

  async function analyzeLighting(imageUrl: string, isTemplate: boolean) {
    isAnalyzingLighting.value = true
    try {
      const result = await post<{
        avgBrightness: number
        avgContrast: number
        dominantLightDirection: { x: number; y: number }
        lightIntensityMap: number[][]
      }>('/image-processing/analyze-lighting', { imageUrl })

      if (isTemplate) {
        templateLightingStats.value = result
      } else {
        designLightingStats.value = result
      }
      return result
    } finally {
      isAnalyzingLighting.value = false
    }
  }

  async function matchLighting(imageUrl: string, templateImageUrl: string) {
    isMatchingLighting.value = true
    try {
      const result = await post<{
        processedImageUrl: string
        params: LightingAdjustParams
      }>('/image-processing/match-lighting', {
        imageUrl,
        templateImageUrl,
        customParams: customLightingParams.value,
      })

      lightingParams.value = result.params
      processedImageUrl.value = result.processedImageUrl
      return result
    } finally {
      isMatchingLighting.value = false
    }
  }

  async function replaceBackground(foregroundUrl: string, params: BackgroundReplaceParams, targetWidth?: number, targetHeight?: number) {
    isReplacingBackground.value = true
    try {
      const result = await post<{ processedImageUrl: string }>('/image-processing/replace-background', {
        foregroundUrl,
        params,
        targetWidth,
        targetHeight,
      })
      return result
    } finally {
      isReplacingBackground.value = false
    }
  }

  async function uploadBackgroundImage(file: File) {
    const fd = new FormData()
    fd.append('file', file)
    return await upload<{ url: string; width: number; height: number }>(
      '/image-processing/background/upload',
      fd
    )
  }

  async function loadBackgroundImages() {
    try {
      const result = await post<BackgroundImageItem[]>('/image-processing/background/list', {})
      backgroundImages.value = result
      return result
    } catch (e) {
      backgroundImages.value = []
      return []
    }
  }

  async function generateComposite(options: {
    templateImageUrl: string
    designImageUrl: string
    maskImageUrl?: string
    backgroundParams?: BackgroundReplaceParams | null
    lightingEnabled?: boolean
    customLightingParams?: Partial<LightingAdjustParams>
    fitRegion: { x: number; y: number; width: number; height: number }
    offsetX: number
    offsetY: number
    scaleX: number
    scaleY: number
    targetWidth?: number
    targetHeight?: number
  }) {
    isGenerating.value = true
    try {
      const result = await post<{ resultImageUrl: string }>('/image-processing/generate-with-all', {
        ...options,
        backgroundParams: options.backgroundParams || undefined,
        customLightingParams: options.customLightingParams || undefined,
      })
      return result
    } finally {
      isGenerating.value = false
    }
  }

  function openMaskEditor() {
    isMaskEditorOpen.value = true
  }

  function closeMaskEditor() {
    isMaskEditorOpen.value = false
  }

  function setBackgroundParams(params: BackgroundReplaceParams | null) {
    backgroundParams.value = params
    if (params) {
      backgroundReplaceEnabled.value = true
    }
  }

  function setCustomLightingParams(params: Partial<LightingAdjustParams> | null) {
    customLightingParams.value = params
  }

  return {
    originalImageUrl,
    processedImageUrl,
    maskOriginalUrl,
    maskCurrentUrl,
    isRemovingBackground,
    isApplyingMask,
    isProcessingMask,
    isAnalyzingLighting,
    isMatchingLighting,
    isReplacingBackground,
    isGenerating,
    lightingEnabled,
    lightingParams,
    customLightingParams,
    templateLightingStats,
    designLightingStats,
    backgroundParams,
    backgroundImages,
    backgroundReplaceEnabled,
    brushSettings,
    thresholdSettings,
    featherRadius,
    isMaskEditorOpen,
    hasBackground,
    hasMask,
    setOriginalImage,
    resetAll,
    resetTemplateStats,
    removeBackground,
    applyMaskToCurrent,
    applyBrushStrokes,
    applyFeather,
    applyThreshold,
    resetMask,
    analyzeLighting,
    matchLighting,
    replaceBackground,
    uploadBackgroundImage,
    loadBackgroundImages,
    generateComposite,
    openMaskEditor,
    closeMaskEditor,
    setBackgroundParams,
    setCustomLightingParams,
  }
})
