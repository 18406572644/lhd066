<template>
  <div class="generator-layout">
    <div class="generator-left">
      <div class="section-title">选择模板</div>
      <div v-if="templateStore.loading" class="grid grid-cols-2 gap-2">
        <a-skeleton v-for="i in 4" :key="i" animation>
          <a-skeleton-shape style="width: 100%; height: 80px" />
        </a-skeleton>
      </div>
      <div v-else class="tpl-grid">
        <div
          v-for="tpl in templateStore.templates"
          :key="tpl.id"
          class="tpl-thumb"
          :class="{ selected: mockupStore.currentTemplate?.id === tpl.id }"
          @click="selectTemplate(tpl)"
        >
          <img :src="tpl.imageUrl" :alt="tpl.name" />
        </div>
      </div>

      <div v-if="mockupStore.currentTemplate" class="mt-4">
        <div class="section-title">使用版本</div>
        <VersionSelector
          :template-id="mockupStore.currentTemplate.id"
          v-model="selectedVersionId"
          @select="onSelectVersion"
        />
        <div v-if="selectedVersionInfo" class="version-info mt-2">
          <a-tag v-if="selectedVersionInfo.isStable" color="green" size="small">稳定版</a-tag>
          <span class="version-info-text">{{ selectedVersionInfo.versionLabel }} · {{ formatDate(selectedVersionInfo.createdAt) }}</span>
        </div>
      </div>

      <div v-if="brandStore.brandPacks.length > 0" class="mt-4">
        <div class="section-title">
          <Briefcase :size="14" class="mr-1" />
          品牌包
        </div>
        <a-select
          v-model="selectedBrandPackId"
          placeholder="选择品牌包（可选）"
          allow-clear
          @change="onBrandPackChange"
        >
          <a-option
            v-for="pack in brandStore.brandPacks"
            :key="pack.id"
            :value="pack.id"
          >
            <div class="brand-pack-option">
              <div class="brand-pack-color-preview">
                <div
                  v-for="(c, i) in pack.primaryColors.slice(0, 3)"
                  :key="i"
                  class="color-dot"
                  :style="{ backgroundColor: c.hex }"
                />
                <div v-if="pack.primaryColors.length === 0" class="color-dot-empty" />
              </div>
              <span class="brand-pack-name">{{ pack.name }}</span>
              <a-tag v-if="pack.brandPrefix" color="arcoblue" size="small">{{ pack.brandPrefix }}</a-tag>
            </div>
          </a-option>
        </a-select>

        <div v-if="selectedBrandPack" class="brand-pack-details mt-3">
          <div v-if="selectedBrandPack.logos.length > 0" class="mt-2">
            <div class="field-label mb-2">选择 Logo</div>
            <div class="logo-selector">
              <div
                v-for="logo in selectedBrandPack.logos"
                :key="logo.id"
                class="logo-selector-item"
                :class="{ 'logo-selected': selectedLogoId === logo.id || (selectedLogoId === null && logo.id === selectedBrandPack.logos[0]?.id) }"
                @click="selectedLogoId = logo.id"
              >
                <img :src="logo.imageUrl" :alt="logo.name" />
              </div>
            </div>
          </div>
          <div v-if="allBrandColors.length > 0" class="mt-3">
            <div class="field-label mb-2">品牌色板（点击作为背景色）</div>
            <div class="brand-palette">
              <div
                v-for="(color, idx) in allBrandColors"
                :key="idx"
                class="palette-swatch"
                :class="{ 'palette-selected': selectedBackgroundColor === color.hex }"
                :style="{ backgroundColor: color.hex }"
                :title="`${color.name}: ${color.hex}`"
                @click="toggleBackgroundColor(color.hex)"
              />
            </div>
          </div>
          <div class="brand-info-tags mt-3">
            <a-tag v-if="selectedBrandPack.brandPrefix" color="arcoblue" size="small">
              导出前缀: {{ selectedBrandPack.brandPrefix }}
            </a-tag>
            <a-tag v-if="selectedBrandPack.fonts.length > 0" color="purple" size="small">
              {{ selectedBrandPack.fonts.length }} 字体
            </a-tag>
            <a-tag v-if="selectedBrandPack.assets.length > 0" color="cyan" size="small">
              {{ selectedBrandPack.assets.length }} 素材
            </a-tag>
          </div>
        </div>
      </div>

      <div class="section-title mt-4">设计图</div>
      <a-upload
        :auto-upload="false"
        :limit="1"
        accept="image/*"
        :draggable="true"
        :fileList="designFileList"
        @change="onDesignChange"
      >
        <template #upload-button>
          <div class="upload-area">
            点击或拖拽上传设计图
          </div>
        </template>
      </a-upload>

      <div v-if="mockupStore.designImage" class="design-actions mt-3">
        <a-button
          size="small"
          long
          :loading="imageStore.isRemovingBackground"
          @click="onRemoveBackground"
        >
          <template #icon><Scissors class="icon" /></template>
          AI 智能抠图
        </a-button>
        <a-button
          size="small"
          long
          class="mt-2"
          :disabled="!imageStore.hasMask"
          @click="showMaskEditor = true"
        >
          <template #icon><Palette class="icon" /></template>
          编辑蒙版
        </a-button>

        <div v-if="imageStore.hasMask" class="mask-preview mt-3">
          <div class="section-title mb-2">抠图预览</div>
          <div class="preview-wrapper checkerboard">
            <img
              v-if="imageStore.processedImageUrl"
              :src="imageStore.processedImageUrl"
              alt="processed design"
              class="preview-img"
            />
          </div>
          <a-tag color="green" class="mt-2" v-if="imageStore.hasMask">
            <Wand2 class="icon" />
            已抠图
          </a-tag>
        </div>
      </div>
    </div>

    <MaskEditor
      :visible="showMaskEditor"
      :image-url="imageStore.originalImageUrl || mockupStore.designImage || ''"
      :mask-url="imageStore.maskCurrentUrl || ''"
      @close="showMaskEditor = false"
      @confirm="onMaskConfirmed"
    />

    <div class="generator-center">
      <div class="canvas-toolbar">
        <a-button
          size="small" :type="mockupStore.snapEnabled ? 'primary' : 'secondary'"
          @click="mockupStore.toggleSnapEnabled()">
          智能吸附
        </a-button>
        <a-button
          size="small" :type="mockupStore.guidesLocked ? 'primary' : 'secondary'"
          @click="mockupStore.toggleGuidesLocked()">
          锁定辅助线
        </a-button>
        <a-button size="small" @click="mockupStore.clearGuides()" :disabled="mockupStore.guides.length === 0">
          清除辅助线
        </a-button>
        <span class="canvas-toolbar-hint">
          提示：从顶部/左侧标尺拖拽可创建辅助线
        </span>
      </div>

      <div class="canvas-stage" ref="canvasStageRef">
        <div class="ruler-corner"></div>
        <div class="ruler ruler-h" ref="rulerHRef">
          <div class="ruler-content">
            <div
              v-for="mark in horizontalRulerMarks" :key="'h-'+mark.pos"
              class="ruler-tick" :style="{ left: mark.pos + 'px' }"
            >
              <div class="tick-line"></div>
              <div class="tick-label">{{ mark.label }}</div>
            </div>
          </div>
          <div
            class="ruler-drag-area"
            @mousedown="startCreateGuide('horizontal', $event)"
          ></div>
        </div>

        <div class="ruler ruler-v" ref="rulerVRef">
          <div class="ruler-content">
            <div
              v-for="mark in verticalRulerMarks" :key="'v-'+mark.pos"
              class="ruler-tick tick-vertical" :style="{ top: mark.pos + 'px' }"
            >
              <div class="tick-line"></div>
              <div class="tick-label">{{ mark.label }}</div>
            </div>
          </div>
          <div
            class="ruler-drag-area"
            @mousedown="startCreateGuide('vertical', $event)"
          ></div>
        </div>

        <div
          class="canvas-wrapper checkerboard"
          ref="canvasWrapperRef"
          @mousedown="onCanvasMouseDown"
        >
          <canvas ref="canvasRef" />

          <div
            v-for="guide in mockupStore.guides"
            :key="guide.id"
            class="guide-line"
            :class="{
              'guide-horizontal': guide.type === 'horizontal',
              'guide-vertical': guide.type === 'vertical',
              'guide-locked': mockupStore.guidesLocked,
              'guide-active': draggingGuideId === guide.id
            }"
            :style="getGuideStyle(guide)"
            @mousedown.stop="startDragGuide(guide, $event)"
            @dblclick.stop="onGuideDoubleClick(guide.id)"
          >
            <div class="guide-dot"></div>
          </div>

          <div
            v-if="tempGuide"
            class="guide-line guide-temp"
            :class="{
              'guide-horizontal': tempGuide.type === 'horizontal',
              'guide-vertical': tempGuide.type === 'vertical',
            }"
            :style="getTempGuideStyle()"
          >
            <div class="guide-dot"></div>
          </div>

          <div
            v-for="guide in mockupStore.activeSnapGuides"
            :key="'snap-'+guide.type+'-'+guide.position"
            class="snap-line"
            :class="{
              'snap-horizontal': guide.type === 'horizontal',
              'snap-vertical': guide.type === 'vertical',
            }"
            :style="getSnapGuideStyle(guide)"
          ></div>

          <div
            v-for="region in brandStore.logoRegions"
            :key="'logo-region-' + region.id"
            class="logo-region-box"
            :style="getLogoRegionStyle(region)"
          >
            <div class="logo-region-label">
              <Briefcase :size="10" />
              {{ region.label }}
            </div>
          </div>
        </div>
      </div>

      <div v-if="mockupStore.currentTemplate" class="canvas-info">
        {{ mockupStore.currentTemplate.name }} · {{ mockupStore.currentTemplate.width }}×{{ mockupStore.currentTemplate.height }}
      </div>
    </div>

    <div class="panel">
      <div class="panel-tabs">
        <div
          class="panel-tab"
          :class="{ active: activeTab === 'lighting' }"
          @click="activeTab = 'lighting'"
        >
          光照
        </div>
        <div
          class="panel-tab"
          :class="{ active: activeTab === 'background' }"
          @click="activeTab = 'background'"
        >
          背景
        </div>
        <div
          class="panel-tab"
          :class="{ active: activeTab === 'adjust' }"
          @click="activeTab = 'adjust'"
        >
          调整
        </div>
      </div>

      <div class="panel-content-area">
        <div v-show="activeTab === 'lighting'" class="tab-content">
          <LightingPanel
            :template-image-url="mockupStore.currentTemplate?.imageUrl || null"
            :design-image-url="uploadedDesignUrl || imageStore.processedImageUrl || null"
            @applied="onLightingApplied"
          />
        </div>

        <div v-show="activeTab === 'background'" class="tab-content">
          <BackgroundEditor
            @applied="onBackgroundApplied"
          />
        </div>

        <div v-show="activeTab === 'adjust'" class="tab-content">
          <div class="panel-section">
            <div class="section-title">位置</div>
            <div class="flex gap-3">
              <div class="flex-1">
                <div class="field-label">X 偏移</div>
                <a-input-number v-model="mockupStore.offset.x" :step="1" size="small" @change="renderCanvas" />
              </div>
              <div class="flex-1">
                <div class="field-label">Y 偏移</div>
                <a-input-number v-model="mockupStore.offset.y" :step="1" size="small" @change="renderCanvas" />
              </div>
            </div>
          </div>
          <div class="panel-section">
            <div class="section-title">缩放</div>
            <div class="field-label">缩放 X</div>
            <a-slider v-model="mockupStore.scale.x" :min="0.1" :max="3" :step="0.05" @change="renderCanvas" />
            <div class="field-label">缩放 Y</div>
            <a-slider v-model="mockupStore.scale.y" :min="0.1" :max="3" :step="0.05" @change="renderCanvas" />
          </div>
          <div class="panel-section">
            <div class="section-title">辅助线</div>
            <div class="field-label">共 {{ mockupStore.guides.length }} 条</div>
            <div class="guide-list" v-if="mockupStore.guides.length > 0">
              <div
                v-for="guide in mockupStore.guides" :key="guide.id"
                class="guide-item"
              >
                <span class="guide-type">{{ guide.type === 'horizontal' ? '水平' : '垂直' }}</span>
                <span class="guide-pos">{{ Math.round(guide.position) }}px</span>
                <a-button size="mini" type="text" @click="mockupStore.removeGuide(guide.id)">删除</a-button>
              </div>
            </div>
            <div v-else class="guide-empty">暂无辅助线</div>
          </div>
          <div class="panel-section">
            <div class="section-title">导出设置</div>
            <div class="field-label">分辨率</div>
            <a-radio-group v-model="mockupStore.exportSettings.width" type="button" size="small">
              <a-radio :value="1">1x</a-radio>
              <a-radio :value="2">2x</a-radio>
              <a-radio :value="3">3x</a-radio>
            </a-radio-group>
            <div class="field-label mt-3">格式</div>
            <a-radio-group v-model="mockupStore.exportSettings.format" type="button" size="small">
              <a-radio value="png">PNG</a-radio>
              <a-radio value="jpeg">JPEG</a-radio>
              <a-radio value="webp">WebP</a-radio>
            </a-radio-group>
          </div>
        </div>
      </div>

      <a-button
        type="primary"
        long
        size="large"
        :loading="imageStore.isGenerating || mockupStore.generating"
        :disabled="!mockupStore.currentTemplate || !mockupStore.designFile"
        @click="onGenerate"
      >
        生成样机
      </a-button>
      <div v-if="mockupStore.resultUrl" class="mt-4">
        <div class="section-title">结果预览</div>
        <div class="result-preview">
          <img :src="mockupStore.resultUrl" alt="result" />
        </div>
        <a-button long size="small" class="mt-2" @click="onDownload">下载</a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useMockupStore } from '@/stores/mockup'
import { useTemplateStore, type Template, type TemplateVersion } from '@/stores/template'
import { useHistoryStore } from '@/stores/history'
import { useImageProcessingStore } from '@/stores/imageProcessing'
import { useBrandPackStore } from '@/stores/brandPack'
import type { Guide } from '@/stores/mockup'
import { upload } from '@/utils/api'
import { Message } from '@arco-design/web-vue'
import type { FileItem } from '@arco-design/web-vue'
import VersionSelector from '@/components/VersionSelector.vue'
import MaskEditor from '@/components/MaskEditor.vue'
import LightingPanel from '@/components/LightingPanel.vue'
import BackgroundEditor from '@/components/BackgroundEditor.vue'
import { Scissors, Palette, Wand2, Briefcase } from 'lucide-vue-next'

const route = useRoute()
const mockupStore = useMockupStore()
const templateStore = useTemplateStore()
const historyStore = useHistoryStore()
const imageStore = useImageProcessingStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWrapperRef = ref<HTMLDivElement | null>(null)
const canvasStageRef = ref<HTMLDivElement | null>(null)
const rulerHRef = ref<HTMLDivElement | null>(null)
const rulerVRef = ref<HTMLDivElement | null>(null)
const designFileList = ref<FileItem[]>([])
const uploadedDesignUrl = ref<string | null>(null)

const showMaskEditor = ref(false)
const activeTab = ref<'lighting' | 'background' | 'adjust'>('lighting')

const brandStore = useBrandPackStore()
const selectedBrandPackId = ref<number | null>(null)
const selectedLogoId = ref<number | null>(null)
const selectedBackgroundColor = ref<string | null>(null)
const brandLogoImages = ref<Record<number, HTMLImageElement>>({})
const lastGeneratedFilename = ref<string | null>(null)

const selectedVersionId = ref<number | null>(null)
const selectedVersionInfo = computed<TemplateVersion | null>(() =>
  templateStore.activeVersion ?? (templateStore.versions.find(v => v.id === selectedVersionId.value) || null)
)

const selectedBrandPack = computed(() => {
  if (!selectedBrandPackId.value) return null
  return brandStore.brandPacks.find(p => p.id === selectedBrandPackId.value) || null
})

const allBrandColors = computed(() => {
  if (!selectedBrandPack.value) return []
  return [...selectedBrandPack.value.primaryColors, ...selectedBrandPack.value.secondaryColors]
})

let templateImg: HTMLImageElement | null = null
let designImg: HTMLImageElement | null = null
let displayScale = 1

let isDraggingDesign = false
let dragStartX = 0
let dragStartY = 0
let dragStartOffsetX = 0
let dragStartOffsetY = 0

interface TempGuideState {
  type: 'horizontal' | 'vertical'
  position: number
}

const tempGuide = ref<TempGuideState | null>(null)
let isCreatingGuide = false

let draggingGuide: Guide | null = null
const draggingGuideId = ref<string | null>(null)
let dragGuideStartPos = 0
let dragGuideMouseStart = 0

const RULER_SIZE = 24

const horizontalRulerMarks = computed(() => {
  const marks: { pos: number; label: string }[] = []
  const tpl = mockupStore.currentTemplate
  if (!tpl) return marks
  const width = tpl.width * displayScale
  const step = width > 300 ? 100 : 50
  for (let i = 0; i <= tpl.width; i += step) {
    marks.push({ pos: i * displayScale, label: String(i) })
  }
  return marks
})

const verticalRulerMarks = computed(() => {
  const marks: { pos: number; label: string }[] = []
  const tpl = mockupStore.currentTemplate
  if (!tpl) return marks
  const height = tpl.height * displayScale
  const step = height > 200 ? 100 : 50
  for (let i = 0; i <= tpl.height; i += step) {
    marks.push({ pos: i * displayScale, label: String(i) })
  }
  return marks
})

const TEST_TEMPLATE: Template = {
  id: 999,
  name: '测试模板',
  category: 'poster',
  description: '用于测试辅助线功能',
  imageUrl: '',
  width: 800,
  height: 600,
  fitRegion: { x: 100, y: 80, width: 600, height: 440 },
  tags: ['test'],
  useCount: 0,
  permission: 'public',
  userId: 1,
  createdAt: '2025-01-01T00:00:00Z',
  qualityScore: 100,
  qualityGrade: 'A',
  reviewStatus: 'auto',
}

onMounted(async () => {
  window.addEventListener('mousemove', onMouseMove, true)
  window.addEventListener('mouseup', onMouseUp, true)

  try {
    await brandStore.fetchBrandPacks()
  } catch (e) {
    console.warn('Brand packs fetch failed', e)
  }

  try {
    await templateStore.fetchTemplates()
  } catch (e) {
    console.warn('Template fetch failed, using test template', e)
  }

  const id = route.params.id
  if (id) {
    try {
      const tpl = await templateStore.fetchTemplate(Number(id))
      if (tpl) {
        selectTemplate(tpl)
        return
      }
    } catch (e) {
      console.warn('Template detail fetch failed', e)
    }
  }

  if (templateStore.templates.length > 0) {
    selectTemplate(templateStore.templates[0])
  } else {
    selectTemplate(TEST_TEMPLATE)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove, true)
  window.removeEventListener('mouseup', onMouseUp, true)
})

watch(() => mockupStore.designImage, (val) => {
  if (val) {
    designImg = new Image()
    designImg.crossOrigin = 'anonymous'
    designImg.onload = () => renderCanvas()
    designImg.src = val
  } else {
    designImg = null
    renderCanvas()
  }
})

function selectTemplate(tpl: Template) {
  selectedVersionId.value = null
  mockupStore.currentTemplate = tpl
  mockupStore.offset = { x: 0, y: 0 }
  mockupStore.scale = { x: 1, y: 1 }
  mockupStore.resultUrl = null
  mockupStore.activeSnapGuides = []
  mockupStore.loadGuides()

  if (selectedBrandPackId.value) {
    loadLogoRegions()
  }

  displayScale = Math.min(600 / tpl.width, 450 / tpl.height, 1)

  if (tpl.imageUrl) {
    templateImg = new Image()
    templateImg.crossOrigin = 'anonymous'
    templateImg.onload = () => {
      renderCanvas()
      nextTick(() => updateRulers())
    }
    templateImg.src = tpl.imageUrl
  } else {
    templateImg = null
    nextTick(() => {
      renderCanvas()
      updateRulers()
    })
  }
}

function onSelectVersion(v: TemplateVersion) {
  if (!mockupStore.currentTemplate) return
  const newTpl: Template = {
    ...mockupStore.currentTemplate,
    name: v.name,
    category: v.category,
    width: v.width,
    height: v.height,
    imageUrl: v.imageUrl,
    fitRegion: { ...v.fitRegion },
    permission: v.permission,
  }
  mockupStore.currentTemplate = newTpl
  mockupStore.offset = { x: 0, y: 0 }
  mockupStore.scale = { x: 1, y: 1 }
  mockupStore.resultUrl = null
  mockupStore.activeSnapGuides = []

  displayScale = Math.min(600 / newTpl.width, 450 / newTpl.height, 1)

  if (v.imageUrl) {
    templateImg = new Image()
    templateImg.crossOrigin = 'anonymous'
    templateImg.onload = () => {
      renderCanvas()
      nextTick(() => updateRulers())
    }
    templateImg.src = v.imageUrl
  } else {
    templateImg = null
    nextTick(() => {
      renderCanvas()
      updateRulers()
    })
  }
}

function onBrandPackChange(packId: number | null) {
  selectedLogoId.value = null
  selectedBackgroundColor.value = null
  if (packId) {
    const pack = brandStore.brandPacks.find(p => p.id === packId)
    if (pack && pack.logos.length > 0) {
      selectedLogoId.value = pack.logos[0].id
      preloadLogos(pack.logos)
    }
  }
  if (mockupStore.currentTemplate) {
    loadLogoRegions()
  }
  renderCanvas()
}

async function loadLogoRegions() {
  if (!mockupStore.currentTemplate) return
  await brandStore.fetchLogoRegions(mockupStore.currentTemplate.id)
  renderCanvas()
}

function preloadLogos(logos: any[]) {
  for (const logo of logos) {
    if (!brandLogoImages.value[logo.id]) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        brandLogoImages.value[logo.id] = img
        renderCanvas()
      }
      img.src = logo.imageUrl
    }
  }
}

function toggleBackgroundColor(hex: string) {
  selectedBackgroundColor.value = selectedBackgroundColor.value === hex ? null : hex
  renderCanvas()
}

function getLogoRegionStyle(region: any) {
  return {
    left: (region.posX * displayScale) + 'px',
    top: (region.posY * displayScale) + 'px',
    width: (region.width * displayScale) + 'px',
    height: (region.height * displayScale) + 'px',
  }
}

function formatDate(d: string) {
  const date = new Date(d)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function updateRulers() {
  // rulers are rendered via computed, this is just for reference
}

function onDesignChange(fileItemList: FileItem[]) {
  designFileList.value = fileItemList
  if (fileItemList.length > 0 && fileItemList[0].file) {
    const file = fileItemList[0].file
    mockupStore.designFile = file
    imageStore.resetAll()
    const reader = new FileReader()
    reader.onload = (e) => {
      mockupStore.designImage = e.target?.result as string
    }
    reader.readAsDataURL(file)

    uploadDesignToServer(file)
  } else {
    mockupStore.designFile = null
    mockupStore.designImage = null
    uploadedDesignUrl.value = null
    imageStore.resetAll()
  }
}

async function uploadDesignToServer(file: File) {
  try {
    const fd = new FormData()
    fd.append('image', file)
    const uploadRes = await upload<{ url: string; width: number; height: number }>('/upload/design-image', fd)
    uploadedDesignUrl.value = uploadRes.url
    imageStore.setOriginalImage(uploadRes.url)
  } catch (e: any) {
    console.warn('设计图上传服务器失败:', e.message)
  }
}

async function onRemoveBackground() {
  if (!mockupStore.designFile) return

  try {
    let designUrl = uploadedDesignUrl.value
    if (!designUrl) {
      const fd = new FormData()
      fd.append('image', mockupStore.designFile)
      const uploadRes = await upload<{ url: string; width: number; height: number }>('/upload/design-image', fd)
      designUrl = uploadRes.url
      uploadedDesignUrl.value = uploadRes.url
      imageStore.setOriginalImage(uploadRes.url)
    }

    await imageStore.removeBackground(designUrl)

    if (imageStore.processedImageUrl) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        designImg = img
        renderCanvas()
      }
      img.src = imageStore.processedImageUrl + '?t=' + Date.now()
    }

    Message.success('抠图完成，可点击「编辑蒙版」进行精细调整')
  } catch (e: any) {
    Message.error(e.message || '抠图失败')
  }
}

async function onMaskConfirmed(maskUrl: string) {
  try {
    const result = await imageStore.applyMaskToCurrent()
    if (result?.processedImageUrl) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        designImg = img
        renderCanvas()
      }
      img.src = result.processedImageUrl + '?t=' + Date.now()
    }
    Message.success('蒙版已更新')
  } catch (e: any) {
    Message.error(e.message || '蒙版应用失败')
  } finally {
    showMaskEditor.value = false
  }
}

function onLightingApplied(imageUrl: string) {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    designImg = img
    renderCanvas()
  }
  img.src = imageUrl + '?t=' + Date.now()
}

function onBackgroundApplied() {
  Message.success('背景设置已保存，生成时将自动应用')
}

function renderCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  const tpl = mockupStore.currentTemplate
  if (!tpl) return

  displayScale = Math.min(600 / tpl.width, 450 / tpl.height, 1)
  canvas.width = tpl.width * displayScale
  canvas.height = tpl.height * displayScale
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (templateImg) {
    ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1)
    ctx.fillStyle = '#9ca3af'
    ctx.font = `${14 * displayScale}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(tpl.name, canvas.width / 2, 30 * displayScale)
  }

  if (tpl.fitRegion) {
    const fit = tpl.fitRegion
    ctx.save()
    ctx.strokeStyle = 'rgba(0, 122, 255, 0.6)'
    ctx.lineWidth = 2
    ctx.setLineDash([6 * displayScale, 4 * displayScale])
    ctx.strokeRect(
      fit.x * displayScale,
      fit.y * displayScale,
      fit.width * displayScale,
      fit.height * displayScale
    )
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(0, 122, 255, 0.05)'
    ctx.fillRect(
      fit.x * displayScale,
      fit.y * displayScale,
      fit.width * displayScale,
      fit.height * displayScale
    )
    ctx.restore()

    const centerX = (fit.x + fit.width / 2) * displayScale
    const centerY = (fit.y + fit.height / 2) * displayScale
    ctx.save()
    ctx.strokeStyle = 'rgba(0, 122, 255, 0.3)'
    ctx.lineWidth = 1
    ctx.setLineDash([3 * displayScale, 3 * displayScale])
    ctx.beginPath()
    ctx.moveTo(centerX, fit.y * displayScale)
    ctx.lineTo(centerX, (fit.y + fit.height) * displayScale)
    ctx.moveTo(fit.x * displayScale, centerY)
    ctx.lineTo((fit.x + fit.width) * displayScale, centerY)
    ctx.stroke()
    ctx.restore()
  }

  if (designImg && tpl.fitRegion) {
    const fit = tpl.fitRegion
    const dx = (fit.x + mockupStore.offset.x) * displayScale
    const dy = (fit.y + mockupStore.offset.y) * displayScale
    const dw = fit.width * mockupStore.scale.x * displayScale
    const dh = fit.height * mockupStore.scale.y * displayScale
    ctx.drawImage(designImg, dx, dy, dw, dh)
  }

  if (brandStore.logoRegions.length > 0) {
    for (const region of brandStore.logoRegions) {
      ctx.save()
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)'
      ctx.fillStyle = 'rgba(16, 185, 129, 0.08)'
      ctx.lineWidth = 2
      ctx.setLineDash([6 * displayScale, 4 * displayScale])
      const rx = region.posX * displayScale
      const ry = region.posY * displayScale
      const rw = region.width * displayScale
      const rh = region.height * displayScale
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeRect(rx, ry, rw, rh)
      ctx.setLineDash([])
      
      ctx.fillStyle = '#10B981'
      ctx.font = `bold ${10 * displayScale}px sans-serif`
      ctx.fillRect(rx, ry - 16 * displayScale, 60 * displayScale, 16 * displayScale)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(region.label.substring(0, 8), rx + 4 * displayScale, ry - 4 * displayScale)
      ctx.restore()
    }
  }

  if (selectedBrandPack.value && selectedLogoId.value !== null && brandStore.logoRegions.length > 0) {
    const logoImg = brandLogoImages.value[selectedLogoId.value]
    if (logoImg) {
      for (const region of brandStore.logoRegions) {
        try {
          const rx = region.posX * displayScale
          const ry = region.posY * displayScale
          const rw = region.width * displayScale
          const rh = region.height * displayScale
          
          const imgRatio = logoImg.width / logoImg.height
          const regionRatio = rw / rh
          
          let drawW, drawH
          if (imgRatio > regionRatio) {
            drawW = rw
            drawH = rw / imgRatio
          } else {
            drawH = rh
            drawW = rh * imgRatio
          }
          
          const drawX = rx + (rw - drawW) / 2
          const drawY = ry + (rh - drawH) / 2
          
          ctx.save()
          ctx.globalAlpha = 0.9
          ctx.drawImage(logoImg, drawX, drawY, drawW, drawH)
          ctx.restore()
        } catch (e) {
          console.warn('Logo draw failed', e)
        }
      }
    }
  }

  if (selectedBackgroundColor.value) {
    ctx.save()
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = selectedBackgroundColor.value
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }
}

function getCanvasPoint(e: MouseEvent) {
  const wrapper = canvasWrapperRef.value
  if (!wrapper) return { x: 0, y: 0 }
  const rect = wrapper.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) / displayScale,
    y: (e.clientY - rect.top) / displayScale,
  }
}

function onCanvasMouseDown(e: MouseEvent) {
  if (!designImg || !mockupStore.currentTemplate?.fitRegion) return

  const point = getCanvasPoint(e)
  const fit = mockupStore.currentTemplate.fitRegion
  const designX = fit.x + mockupStore.offset.x
  const designY = fit.y + mockupStore.offset.y
  const designW = fit.width * mockupStore.scale.x
  const designH = fit.height * mockupStore.scale.y

  if (
    point.x >= designX && point.x <= designX + designW &&
    point.y >= designY && point.y <= designY + designH
  ) {
    isDraggingDesign = true
    dragStartX = e.clientX
    dragStartY = e.clientY
    dragStartOffsetX = mockupStore.offset.x
    dragStartOffsetY = mockupStore.offset.y
    e.preventDefault()
    e.stopPropagation()
  }
}

function startCreateGuide(type: 'horizontal' | 'vertical', e: MouseEvent) {
  if (mockupStore.guidesLocked) return
  if (!mockupStore.currentTemplate) return

  isCreatingGuide = true
  const tpl = mockupStore.currentTemplate
  const maxPos = type === 'horizontal' ? tpl.height : tpl.width
  const pos = calculateGuidePosition(e, type)
  const clampedPos = Math.max(0, Math.min(maxPos, pos))

  tempGuide.value = {
    type,
    position: clampedPos,
  }
  e.preventDefault()
  e.stopPropagation()
}

function calculateGuidePosition(e: MouseEvent, type: 'horizontal' | 'vertical'): number {
  const wrapper = canvasWrapperRef.value
  if (!wrapper) return 0
  const rect = wrapper.getBoundingClientRect()

  if (type === 'horizontal') {
    return (e.clientY - rect.top) / displayScale
  } else {
    return (e.clientX - rect.left) / displayScale
  }
}

function startDragGuide(guide: Guide, e: MouseEvent) {
  if (mockupStore.guidesLocked) return
  draggingGuide = guide
  draggingGuideId.value = guide.id
  dragGuideStartPos = guide.position
  dragGuideMouseStart = guide.type === 'horizontal' ? e.clientY : e.clientX
  e.preventDefault()
  e.stopPropagation()
}

function onGuideDoubleClick(id: string) {
  if (mockupStore.guidesLocked) return
  mockupStore.removeGuide(id)
}

function onMouseMove(e: MouseEvent) {
  if (isDraggingDesign && mockupStore.currentTemplate?.fitRegion) {
    const dx = (e.clientX - dragStartX) / displayScale
    const dy = (e.clientY - dragStartY) / displayScale

    let newOffsetX = dragStartOffsetX + dx
    let newOffsetY = dragStartOffsetY + dy

    if (mockupStore.snapEnabled && mockupStore.currentTemplate.fitRegion && designImg) {
      const fit = mockupStore.currentTemplate.fitRegion
      const designWidth = fit.width * mockupStore.scale.x
      const designHeight = fit.height * mockupStore.scale.y

      const designX = fit.x + newOffsetX
      const designY = fit.y + newOffsetY

      const result = mockupStore.calculateSnap(
        designX, designY, designWidth, designHeight, fit
      )

      if (result.snapped) {
        newOffsetX = result.snapX - fit.x
        newOffsetY = result.snapY - fit.y
        mockupStore.activeSnapGuides = result.guides
      } else {
        mockupStore.activeSnapGuides = []
      }
    }

    mockupStore.offset.x = newOffsetX
    mockupStore.offset.y = newOffsetY
    renderCanvas()
  }

  if (isCreatingGuide && tempGuide.value) {
    const type = tempGuide.value.type
    const tpl = mockupStore.currentTemplate
    if (!tpl) return
    const maxPos = type === 'horizontal' ? tpl.height : tpl.width
    const rawPos = calculateGuidePosition(e, type)
    const clampedPos = Math.max(0, Math.min(maxPos, rawPos))
    tempGuide.value.position = clampedPos
  }

  if (draggingGuide) {
    const wrapper = canvasWrapperRef.value
    if (!wrapper) return

    if (draggingGuide.type === 'horizontal') {
      const dy = (e.clientY - dragGuideMouseStart) / displayScale
      const newPos = Math.max(0, Math.min(
        mockupStore.currentTemplate?.height || 0, dragGuideStartPos + dy
      ))
      mockupStore.updateGuidePosition(draggingGuide.id, newPos)
    } else {
      const dx = (e.clientX - dragGuideMouseStart) / displayScale
      const newPos = Math.max(0, Math.min(
        mockupStore.currentTemplate?.width || 0, dragGuideStartPos + dx
      ))
      mockupStore.updateGuidePosition(draggingGuide.id, newPos)
    }
  }
}

function onMouseUp(e: MouseEvent) {
  if (isDraggingDesign) {
    isDraggingDesign = false
    mockupStore.activeSnapGuides = []
  }

  if (isCreatingGuide && tempGuide.value) {
    const tpl = mockupStore.currentTemplate
    if (tpl) {
      const { type, position } = tempGuide.value
      mockupStore.addGuide(type, position)
    }
    isCreatingGuide = false
    tempGuide.value = null
  }

  if (draggingGuide) {
    draggingGuide = null
    draggingGuideId.value = null
  }
}

function getGuideStyle(guide: Guide) {
  const pos = guide.position * displayScale
  if (guide.type === 'horizontal') {
    return { top: pos + 'px', left: '0px', right: '0px' }
  } else {
    return { left: pos + 'px', top: '0px', bottom: '0px' }
  }
}

function getTempGuideStyle() {
  if (!tempGuide.value) return {}
  const pos = tempGuide.value.position * displayScale
  if (tempGuide.value.type === 'horizontal') {
    return { top: pos + 'px', left: '0px', right: '0px' }
  } else {
    return { left: pos + 'px', top: '0px', bottom: '0px' }
  }
}

function getSnapGuideStyle(guide: { type: 'horizontal' | 'vertical'; position: number }) {
  const pos = guide.position * displayScale
  if (guide.type === 'horizontal') {
    return { top: pos + 'px', left: '0px', right: '0px' }
  } else {
    return { left: pos + 'px', top: '0px', bottom: '0px' }
  }
}

async function onGenerate() {
  if (!mockupStore.currentTemplate) {
    Message.warning('请先选择模板')
    return
  }
  if (!mockupStore.designFile && !uploadedDesignUrl.value) {
    Message.warning('请先上传设计图')
    return
  }

  try {
    mockupStore.generating = true

    let designUrl = uploadedDesignUrl.value
    if (!designUrl && mockupStore.designFile) {
      const fd = new FormData()
      fd.append('image', mockupStore.designFile)
      const uploadRes = await upload<{ url: string; width: number; height: number }>('/upload/design-image', fd)
      designUrl = uploadRes.url
      uploadedDesignUrl.value = uploadRes.url
    }

    if (!designUrl) {
      Message.warning('请先上传设计图')
      return
    }

    const tpl = mockupStore.currentTemplate
    const targetWidth = tpl.width * mockupStore.exportSettings.width
    const targetHeight = tpl.height * mockupStore.exportSettings.width

    const result = await imageStore.generateComposite({
      templateImageUrl: tpl.imageUrl,
      designImageUrl: imageStore.processedImageUrl || designUrl,
      maskImageUrl: imageStore.maskCurrentUrl || undefined,
      backgroundParams: imageStore.backgroundReplaceEnabled ? imageStore.backgroundParams : null,
      lightingEnabled: imageStore.lightingEnabled,
      customLightingParams: imageStore.customLightingParams,
      fitRegion: {
        x: tpl.fitRegion.x,
        y: tpl.fitRegion.y,
        width: tpl.fitRegion.width,
        height: tpl.fitRegion.height,
      },
      offsetX: mockupStore.offset.x,
      offsetY: mockupStore.offset.y,
      scaleX: mockupStore.scale.x,
      scaleY: mockupStore.scale.y,
      targetWidth,
      targetHeight,
      brandPackId: selectedBrandPackId.value ?? undefined,
      logoId: selectedLogoId.value ?? undefined,
      backgroundColor: selectedBackgroundColor.value ?? undefined,
    })

    mockupStore.resultUrl = result.resultImageUrl
    lastGeneratedFilename.value = result.filename || null
    Message.success('生成成功')
    historyStore.fetchHistory()
  } catch (e: any) {
    Message.error(e.message || '生成失败')
  } finally {
    mockupStore.generating = false
  }
}

function onDownload() {
  if (!mockupStore.resultUrl) return
  const a = document.createElement('a')
  a.href = mockupStore.resultUrl
  const filename = lastGeneratedFilename.value || `mockup-${Date.now()}.${mockupStore.exportSettings.format}`
  a.download = filename
  a.click()
}
</script>

<style scoped>
.generator-layout {
  display: flex;
  height: 100%;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.generator-left {
  width: 240px;
  min-width: 240px;
  flex-shrink: 0;
  background: var(--color-bg);
  border-right: 1px solid var(--color-border);
  padding: 16px;
  overflow-y: auto;
}
.generator-center {
  flex: 1 1 0;
  min-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 16px 20px;
  position: relative;
  overflow: auto;
}
.canvas-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  width: 100%;
  max-width: 700px;
  flex-wrap: wrap;
}
.canvas-toolbar-hint {
  font-size: 12px;
  color: var(--color-text-3);
  margin-left: auto;
}
.canvas-stage {
  position: relative;
  display: grid;
  grid-template-columns: 24px 1fr;
  grid-template-rows: 24px 1fr;
  gap: 0;
}
.ruler-corner {
  grid-column: 1;
  grid-row: 1;
  background: var(--color-fill-2);
  border: 1px solid var(--color-border);
  border-right: none;
  border-bottom: none;
}
.ruler {
  background: var(--color-fill-2);
  border: 1px solid var(--color-border);
  position: relative;
  user-select: none;
  overflow: visible;
}
.ruler-h {
  grid-column: 2;
  grid-row: 1;
  height: 24px;
  border-bottom: none;
}
.ruler-v {
  grid-column: 1;
  grid-row: 2;
  width: 24px;
  border-right: none;
}
.ruler-content {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.ruler-drag-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: ns-resize;
  z-index: 10;
}
.ruler-v .ruler-drag-area {
  cursor: ew-resize;
}
.ruler-tick {
  position: absolute;
  top: 0;
  height: 100%;
}
.tick-line {
  position: absolute;
  background: var(--color-text-4);
}
.ruler-h .tick-line {
  width: 1px;
  height: 6px;
  left: 0;
  bottom: 0;
}
.tick-vertical .tick-line {
  width: 6px;
  height: 1px;
  right: 0;
  top: 0;
}
.tick-label {
  position: absolute;
  font-size: 10px;
  color: var(--color-text-3);
  white-space: nowrap;
  font-family: monospace;
}
.ruler-h .tick-label {
  left: 2px;
  top: 2px;
}
.tick-vertical .tick-label {
  right: 2px;
  top: 2px;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}
.canvas-wrapper {
  grid-column: 2;
  grid-row: 2;
  border-radius: 0 0 var(--radius-sm) 0;
  overflow: visible;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: block;
  position: relative;
  cursor: default;
  border: 1px solid var(--color-border);
  background: #fff;
}
.canvas-wrapper canvas {
  display: block;
}
.guide-line {
  position: absolute;
  background: #ff00ff;
  z-index: 10;
  cursor: move;
  pointer-events: auto;
}
.guide-line.guide-horizontal {
  height: 1px;
}
.guide-line.guide-vertical {
  width: 1px;
}
.guide-line.guide-locked {
  cursor: default;
}
.guide-line.guide-active {
  background: #ff3bff;
  box-shadow: 0 0 6px rgba(255, 0, 255, 0.7);
}
.guide-line.guide-temp {
  background: rgba(255, 0, 255, 0.6);
  border-style: dashed;
  cursor: none;
  pointer-events: none;
  z-index: 20;
}
.guide-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #ff00ff;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.2);
}
.guide-horizontal .guide-dot {
  left: -5px;
  top: -5px;
}
.guide-vertical .guide-dot {
  top: -5px;
  left: -5px;
}
.guide-temp .guide-dot {
  background: rgba(255, 0, 255, 0.6);
}
.snap-line {
  position: absolute;
  background: #007AFF;
  z-index: 5;
  pointer-events: none;
}
.snap-line.snap-horizontal {
  height: 1px;
}
.snap-line.snap-vertical {
  width: 1px;
}
.canvas-info {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.tpl-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.tpl-thumb {
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s ease;
  aspect-ratio: 1;
  background: var(--color-bg-secondary);
}
.tpl-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.tpl-thumb.selected {
  border-color: var(--color-primary);
}
.tpl-thumb:hover {
  border-color: rgba(0, 122, 255, 0.4);
}
.upload-area {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: border-color 0.15s;
}
.upload-area:hover {
  border-color: var(--color-primary);
}
.panel {
  width: 280px;
  min-width: 280px;
  flex-shrink: 0;
  background: var(--color-bg);
  border-left: 1px solid var(--color-border);
  padding: 16px;
  overflow-y: auto;
}
.panel-section {
  margin-bottom: 20px;
}
.field-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}
.guide-list {
  max-height: 120px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.guide-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid var(--color-border);
  font-size: 12px;
}
.guide-item:last-child {
  border-bottom: none;
}
.guide-type {
  width: 40px;
  color: var(--color-text-secondary);
}
.guide-pos {
  flex: 1;
  font-family: monospace;
}
.guide-empty {
  font-size: 12px;
  color: var(--color-text-3);
  padding: 12px;
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
}
.result-preview {
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--color-border);
}
.result-preview img {
  width: 100%;
  display: block;
}
.mt-4 {
  margin-top: 16px;
}
.mt-2 {
  margin-top: 8px;
}
.mt-3 {
  margin-top: 12px;
}
.flex {
  display: flex;
}
.gap-3 {
  gap: 12px;
}
.flex-1 {
  flex: 1;
}
.grid {
  display: grid;
}
.grid-cols-2 {
  grid-template-columns: repeat(2, 1fr);
}
.gap-2 {
  gap: 8px;
}
.long {
  width: 100%;
}
.version-info {
  display: flex;
  align-items: center;
  gap: 6px;
}
.version-info-text {
  font-size: 11px;
  color: var(--color-text-3);
}
.mt-4 {
  margin-top: 16px;
}
.mt-2 {
  margin-top: 8px;
}
.mt-3 {
  margin-top: 12px;
}
.mb-2 {
  margin-bottom: 8px;
}
.icon {
  width: 14px;
  height: 14px;
}
.long {
  width: 100%;
}

.design-actions {
  display: flex;
  flex-direction: column;
}

.mask-preview {
  background: var(--color-fill-2);
  border-radius: var(--radius-sm);
  padding: 10px;
}

.preview-wrapper {
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--color-border);
}

.preview-img {
  width: 100%;
  display: block;
}

.checkerboard {
  background-image:
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  margin: -16px -16px 12px -16px;
  padding: 0 8px;
}

.panel-tab {
  flex: 1;
  padding: 12px 8px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.panel-tab:hover {
  color: var(--color-text);
}

.panel-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 500;
}

.panel-content-area {
  max-height: calc(100vh - 400px);
  overflow-y: auto;
  margin-right: -8px;
  padding-right: 8px;
}

.tab-content {
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.brand-pack-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.brand-pack-color-preview {
  display: flex;
  gap: 2px;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.color-dot-empty {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #e5e7eb;
  border: 1px dashed #d1d5db;
}

.brand-pack-name {
  flex: 1;
  font-size: 13px;
}

.brand-pack-details {
  padding: 10px;
  background: var(--color-fill-1);
  border-radius: 8px;
}

.field-label {
  font-size: 12px;
  color: var(--color-text-3);
  font-weight: 500;
}

.logo-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.logo-selector-item {
  width: 52px;
  height: 52px;
  border: 2px solid var(--color-border-2);
  border-radius: 6px;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  background: #fff;
}

.logo-selector-item:hover {
  border-color: var(--color-primary-6);
}

.logo-selector-item.logo-selected {
  border-color: var(--color-primary-6);
  background: var(--color-primary-1);
  box-shadow: 0 0 0 2px var(--color-primary-2);
}

.logo-selector-item img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.brand-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.palette-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.15s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.palette-swatch:hover {
  transform: scale(1.1);
}

.palette-swatch.palette-selected {
  border-color: var(--color-primary-6);
  box-shadow: 0 0 0 2px var(--color-primary-3);
}

.brand-info-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.logo-region-box {
  position: absolute;
  border: 2px dashed rgba(16, 185, 129, 0.6);
  background: rgba(16, 185, 129, 0.05);
  pointer-events: none;
  border-radius: 4px;
  z-index: 5;
}

.logo-region-label {
  position: absolute;
  top: -20px;
  left: 0;
  background: #10B981;
  color: #fff;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}
</style>
