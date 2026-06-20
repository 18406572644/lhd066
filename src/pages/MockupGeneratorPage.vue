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
    </div>

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
      <div class="canvas-stage">
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
            @dblclick="onGuideDoubleClick(guide.id)"
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
        </div>
      </div>
      <div v-if="mockupStore.currentTemplate" class="canvas-info">
        {{ mockupStore.currentTemplate.name }} · {{ mockupStore.currentTemplate.width }}×{{ mockupStore.currentTemplate.height }}
      </div>
    </div>

    <div class="panel">
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
      <a-button
        type="primary"
        long
        size="large"
        :loading="mockupStore.generating"
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
import type { Guide } from '@/stores/mockup'
import { Message } from '@arco-design/web-vue'
import type { FileItem } from '@arco-design/web-vue'
import VersionSelector from '@/components/VersionSelector.vue'

const route = useRoute()
const mockupStore = useMockupStore()
const templateStore = useTemplateStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvasWrapperRef = ref<HTMLDivElement | null>(null)
const rulerHRef = ref<HTMLDivElement | null>(null)
const rulerVRef = ref<HTMLDivElement | null>(null)
const designFileList = ref<FileItem[]>([])

const selectedVersionId = ref<number | null>(null)
const selectedVersionInfo = computed<TemplateVersion | null>(() =>
  templateStore.activeVersion ?? (templateStore.versions.find(v => v.id === selectedVersionId.value) || null)
)

let templateImg: HTMLImageElement | null = null
let designImg: HTMLImageElement | null = null
let displayScale = 1

let isDraggingDesign = false
let dragStartX = 0
let dragStartY = 0
let dragStartOffsetX = 0
let dragStartOffsetY = 0

let isCreatingGuide = false
let creatingGuideType: 'horizontal' | 'vertical' | null = null

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

onMounted(async () => {
  await templateStore.fetchTemplates()
  const id = route.params.id
  if (id) {
    const tpl = await templateStore.fetchTemplate(Number(id))
    if (tpl) selectTemplate(tpl)
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
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
  templateImg = new Image()
  templateImg.crossOrigin = 'anonymous'
  templateImg.onload = () => {
    renderCanvas()
    nextTick(() => updateRulers())
  }
  templateImg.src = tpl.imageUrl
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
  templateImg = new Image()
  templateImg.crossOrigin = 'anonymous'
  templateImg.onload = () => {
    renderCanvas()
    nextTick(() => updateRulers())
  }
  templateImg.src = v.imageUrl
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
    const reader = new FileReader()
    reader.onload = (e) => {
      mockupStore.designImage = e.target?.result as string
    }
    reader.readAsDataURL(file)
  } else {
    mockupStore.designFile = null
    mockupStore.designImage = null
  }
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
  }

  if (designImg && tpl.fitRegion) {
    const fit = tpl.fitRegion
    const dx = (fit.x + mockupStore.offset.x) * displayScale
    const dy = (fit.y + mockupStore.offset.y) * displayScale
    const dw = fit.width * mockupStore.scale.x * displayScale
    const dh = fit.height * mockupStore.scale.y * displayScale
    ctx.drawImage(designImg, dx, dy, dw, dh)
  }
}

function getCanvasPoint(e: MouseEvent) {
  const canvas = canvasRef.value
  if (!canvas) return { x: 0, y: 0 }
  const rect = canvas.getBoundingClientRect()
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
  }
}

function startCreateGuide(type: 'horizontal' | 'vertical', e: MouseEvent) {
  if (mockupStore.guidesLocked) return
  isCreatingGuide = true
  creatingGuideType = type
  e.preventDefault()
}

function startDragGuide(guide: Guide, e: MouseEvent) {
  if (mockupStore.guidesLocked) return
  draggingGuide = guide
  draggingGuideId.value = guide.id
  dragGuideStartPos = guide.position
  dragGuideMouseStart = guide.type === 'horizontal' ? e.clientY : e.clientX
  e.preventDefault()
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

  if (isCreatingGuide && creatingGuideType) {
    const canvas = canvasRef.value
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    
    let pos = 0
    if (creatingGuideType === 'horizontal') {
      pos = (e.clientY - rect.top) / displayScale
    } else {
      pos = (e.clientX - rect.left) / displayScale
    }

    const tpl = mockupStore.currentTemplate
    const maxPos = creatingGuideType === 'horizontal' ? (tpl?.height || 0) : (tpl?.width || 0)
    
    if (pos >= 0 && pos <= maxPos) {
      if (!draggingGuide) {
        mockupStore.addGuide(creatingGuideType, pos)
        const lastGuide = mockupStore.guides[mockupStore.guides.length - 1]
        if (lastGuide) {
          draggingGuide = lastGuide
          draggingGuideId.value = lastGuide.id
          dragGuideStartPos = lastGuide.position
          dragGuideMouseStart = creatingGuideType === 'horizontal' ? e.clientY : e.clientX
        }
      }
    }
  }

  if (draggingGuide && !isCreatingGuide) {
    const canvas = canvasRef.value
    if (!canvas) return
    
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

function onMouseUp() {
  if (isDraggingDesign) {
    isDraggingDesign = false
    mockupStore.activeSnapGuides = []
  }
  if (isCreatingGuide) {
    isCreatingGuide = false
    creatingGuideType = null
  }
  if (draggingGuide) {
    draggingGuide = null
    draggingGuideId.value = null
  }
}

function getGuideStyle(guide: Guide) {
  const pos = guide.position * displayScale
  if (guide.type === 'horizontal') {
    return { top: pos + 'px', left: 0, right: 0 }
  } else {
    return { left: pos + 'px', top: 0, bottom: 0 }
  }
}

function getSnapGuideStyle(guide: { type: 'horizontal' | 'vertical'; position: number }) {
  const pos = guide.position * displayScale
  if (guide.type === 'horizontal') {
    return { top: pos + 'px', left: 0, right: 0 }
  } else {
    return { left: pos + 'px', top: 0, bottom: 0 }
  }
}

async function onGenerate() {
  try {
    await mockupStore.generateMockup()
    Message.success('生成成功')
  } catch (e: any) {
    Message.error(e.message || '生成失败')
  }
}

function onDownload() {
  if (!mockupStore.resultUrl) return
  const a = document.createElement('a')
  a.href = mockupStore.resultUrl
  a.download = `mockup-${Date.now()}.${mockupStore.exportSettings.format}`
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
  flex: 1 1 auto;
  min-width: 0;
  width: 0;
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
}
.canvas-toolbar-hint {
  font-size: 12px;
  color: var(--color-text-3);
  margin-left: 8px;
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
  overflow: hidden;
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
}
.ruler-drag-area {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: crosshair;
  z-index: 2;
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
  display: inline-block;
  position: relative;
  cursor: default;
  border: 1px solid var(--color-border);
  border-left: none;
  border-top: none;
}
.canvas-wrapper canvas {
  display: block;
}
.guide-line {
  position: absolute;
  background: #ff00ff;
  z-index: 10;
  cursor: move;
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
</style>
