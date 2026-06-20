<template>
  <div class="mask-editor-overlay" v-if="visible">
    <div class="mask-editor-modal">
      <div class="modal-header">
        <div class="modal-title">蒙版编辑器</div>
        <div class="modal-actions">
          <a-button size="small" @click="onReset">重置蒙版</a-button>
          <a-button size="small" type="primary" @click="onConfirm">确认应用</a-button>
          <a-button size="small" @click="onClose">关闭</a-button>
        </div>
      </div>

      <div class="modal-body">
        <div class="editor-toolbar">
          <div class="toolbar-group">
            <div class="toolbar-label">工具</div>
            <a-radio-group v-model="imageStore.brushSettings.mode" type="button" size="small">
              <a-radio value="keep">
                <template #icon><Eraser class="icon" /></template>
                保留区域
              </a-radio>
              <a-radio value="erase">
                <template #icon><Pencil class="icon" /></template>
                擦除区域
              </a-radio>
            </a-radio-group>
          </div>

          <div class="toolbar-group">
            <div class="toolbar-label">画笔大小</div>
            <a-slider
              v-model="imageStore.brushSettings.radius"
              :min="2"
              :max="100"
              :step="1"
              style="width: 150px"
            />
            <span class="value-label">{{ imageStore.brushSettings.radius }}px</span>
          </div>

          <div class="toolbar-group">
            <div class="toolbar-label">显示</div>
            <a-checkbox v-model="showMaskOverlay">显示蒙版</a-checkbox>
            <a-checkbox v-model="showOriginal">显示原图</a-checkbox>
          </div>
        </div>

        <div class="editor-canvas-container">
          <div class="canvas-wrapper" ref="canvasWrapperRef">
            <canvas ref="baseCanvasRef" class="base-canvas" />
            <canvas ref="overlayCanvasRef" class="overlay-canvas" />
          </div>
        </div>

        <div class="editor-sidebar">
          <a-collapse :default-active-key="['threshold', 'feather']">
            <a-collapse-item name="threshold" title="阈值调节">
              <div class="field-label">阈值</div>
              <a-slider
                v-model="imageStore.thresholdSettings.value"
                :min="0"
                :max="1"
                :step="0.01"
                @change="applyThreshold"
              />
              <div class="field-label mt-3">柔和度</div>
              <a-slider
                v-model="imageStore.thresholdSettings.softness"
                :min="0"
                :max="1"
                :step="0.01"
                @change="applyThreshold"
              />
              <a-button size="small" class="mt-3" :loading="imageStore.isProcessingMask" @click="applyThreshold">
                应用阈值
              </a-button>
            </a-collapse-item>

            <a-collapse-item name="feather" title="边缘羽化">
              <div class="field-label">羽化半径</div>
              <a-slider
                v-model="imageStore.featherRadius"
                :min="0"
                :max="20"
                :step="1"
              />
              <span class="value-label">{{ imageStore.featherRadius }}px</span>
              <a-button size="small" class="mt-3" :loading="imageStore.isProcessingMask" @click="applyFeather">
                应用羽化
              </a-button>
            </a-collapse-item>
          </a-collapse>

          <div class="tip-box mt-4">
            <div class="tip-title">提示</div>
            <ul class="tip-list">
              <li>使用鼠标在画布上涂抹进行精细编辑</li>
              <li>保留区域画笔（绿色）将添加到蒙版</li>
              <li>擦除区域画笔（红色）将从蒙版移除</li>
              <li>开启「显示蒙版」可查看蒙版效果</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { useImageProcessingStore, type BrushStroke } from '@/stores/imageProcessing'
import { Message } from '@arco-design/web-vue'
import { Eraser, Pencil } from 'lucide-vue-next'

const props = defineProps<{
  visible: boolean
  imageUrl: string
  maskUrl: string
}>()

const emit = defineEmits<{
  close: []
  confirm: [maskUrl: string]
}>()

const imageStore = useImageProcessingStore()

const canvasWrapperRef = ref<HTMLDivElement | null>(null)
const baseCanvasRef = ref<HTMLCanvasElement | null>(null)
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null)

const showMaskOverlay = ref(true)
const showOriginal = ref(false)

let baseImg: HTMLImageElement | null = null
let maskImg: HTMLImageElement | null = null
let displayScale = 1
let isDrawing = false
let pendingStrokes: BrushStroke[] = []
let lastPos = { x: 0, y: 0 }
let canvasWidth = 0
let canvasHeight = 0

watch(() => props.visible, (val) => {
  if (val) {
    nextTick(() => {
      loadImages()
    })
  }
})

function loadImages() {
  if (!props.imageUrl || !props.maskUrl) return

  baseImg = new Image()
  baseImg.crossOrigin = 'anonymous'
  baseImg.onload = () => {
    maskImg = new Image()
    maskImg.crossOrigin = 'anonymous'
    maskImg.onload = () => {
      renderCanvas()
    }
    maskImg.src = props.maskUrl
  }
  baseImg.src = props.imageUrl
}

function renderCanvas() {
  if (!baseCanvasRef.value || !overlayCanvasRef.value || !baseImg) return

  const wrapper = canvasWrapperRef.value
  const maxWidth = wrapper.clientWidth
  const maxHeight = wrapper.clientHeight

  const imgWidth = baseImg.width
  const imgHeight = baseImg.height
  canvasWidth = imgWidth
  canvasHeight = imgHeight

  displayScale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1)

  const displayWidth = imgWidth * displayScale
  const displayHeight = imgHeight * displayScale

  baseCanvasRef.value.width = imgWidth
  baseCanvasRef.value.height = imgHeight
  overlayCanvasRef.value.width = imgWidth
  overlayCanvasRef.value.height = imgHeight

  baseCanvasRef.value.style.width = displayWidth + 'px'
  baseCanvasRef.value.style.height = displayHeight + 'px'
  overlayCanvasRef.value.style.width = displayWidth + 'px'
  overlayCanvasRef.value.style.height = displayHeight + 'px'

  const baseCtx = baseCanvasRef.value.getContext('2d')
  if (!baseCtx) return

  baseCtx.clearRect(0, 0, imgWidth, imgHeight)

  if (showOriginal.value) {
    baseCtx.drawImage(baseImg, 0, 0, imgWidth, imgHeight)
  } else {
    drawCheckerboard(baseCtx, imgWidth, imgHeight)
    baseCtx.globalCompositeOperation = 'source-over'
    baseCtx.drawImage(baseImg, 0, 0, imgWidth, imgHeight)
  }

  renderOverlay()
}

function drawCheckerboard(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const tileSize = 16
  const color1 = '#cccccc'
  const color2 = '#ffffff'

  for (let y = 0; y < height; y += tileSize) {
    for (let x = 0; x < width; x += tileSize) {
      const tileX = Math.floor(x / tileSize)
      const tileY = Math.floor(y / tileSize)
      ctx.fillStyle = (tileX + tileY) % 2 === 0 ? color2 : color1
      ctx.fillRect(x, y, tileSize, tileSize)
    }
  }
}

function renderOverlay() {
  if (!overlayCanvasRef.value || !maskImg) return

  const ctx = overlayCanvasRef.value.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, overlayCanvasRef.value.width, overlayCanvasRef.value.height)

  if (showMaskOverlay.value) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(maskImg, 0, 0, overlayCanvasRef.value.width, overlayCanvasRef.value.height)

    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = 'rgba(0, 200, 0, 0.4)'
    ctx.fillRect(0, 0, overlayCanvasRef.value.width, overlayCanvasRef.value.height)

    ctx.globalCompositeOperation = 'source-over'
  }
}

function getCanvasPoint(e: MouseEvent) {
  if (!overlayCanvasRef.value) return { x: 0, y: 0 }
  const rect = overlayCanvasRef.value.getBoundingClientRect()
  return {
    x: (e.clientX - rect.left) / displayScale,
    y: (e.clientY - rect.top) / displayScale,
  }
}

function onCanvasMouseDown(e: MouseEvent) {
  isDrawing = true
  const point = getCanvasPoint(e)
  lastPos = point

  const stroke: BrushStroke = {
    x: point.x,
    y: point.y,
    radius: imageStore.brushSettings.radius,
    mode: imageStore.brushSettings.mode,
  }
  pendingStrokes.push(stroke)

  drawLocalStroke(point, point, stroke)
  e.preventDefault()
}

function onCanvasMouseMove(e: MouseEvent) {
  if (!isDrawing) return

  const point = getCanvasPoint(e)

  const dx = point.x - lastPos.x
  const dy = point.y - lastPos.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const steps = Math.max(1, Math.ceil(dist / (imageStore.brushSettings.radius / 2)))

  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const interpX = lastPos.x + dx * t
    const interpY = lastPos.y + dy * t

    const stroke: BrushStroke = {
      x: interpX,
      y: interpY,
      radius: imageStore.brushSettings.radius,
      mode: imageStore.brushSettings.mode,
    }
    pendingStrokes.push(stroke)

    drawLocalStroke(lastPos, { x: interpX, y: interpY }, stroke)
  }

  lastPos = point
}

async function onCanvasMouseUp() {
  if (!isDrawing) return
  isDrawing = false

  if (pendingStrokes.length > 0) {
    try {
      const strokes = [...pendingStrokes]
      pendingStrokes = []

      await imageStore.applyBrushStrokes(strokes, canvasWidth, canvasHeight)

      maskImg = new Image()
      maskImg.crossOrigin = 'anonymous'
      maskImg.onload = () => renderOverlay()
      maskImg.src = imageStore.maskCurrentUrl! + '?t=' + Date.now()
    } catch (e: any) {
      Message.error(e.message || '应用画笔失败')
    }
  }
}

function drawLocalStroke(from: { x: number; y: number }, to: { x: number; y: number }, stroke: BrushStroke) {
  if (!overlayCanvasRef.value) return
  const ctx = overlayCanvasRef.value.getContext('2d')
  if (!ctx) return

  ctx.globalCompositeOperation = 'source-over'
  const color = stroke.mode === 'keep' ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)'

  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = stroke.radius * 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
}

async function applyFeather() {
  try {
    await imageStore.applyFeather(imageStore.featherRadius)
    maskImg = new Image()
    maskImg.crossOrigin = 'anonymous'
    maskImg.onload = () => {
      renderCanvas()
      Message.success('羽化已应用')
    }
    maskImg.src = imageStore.maskCurrentUrl! + '?t=' + Date.now()
  } catch (e: any) {
    Message.error(e.message || '应用羽化失败')
  }
}

async function applyThreshold() {
  try {
    await imageStore.applyThreshold(imageStore.thresholdSettings)
    maskImg = new Image()
    maskImg.crossOrigin = 'anonymous'
    maskImg.onload = () => {
      renderCanvas()
      Message.success('阈值已应用')
    }
    maskImg.src = imageStore.maskCurrentUrl! + '?t=' + Date.now()
  } catch (e: any) {
    Message.error(e.message || '应用阈值失败')
  }
}

async function onReset() {
  try {
    await imageStore.resetMask()
    maskImg = new Image()
    maskImg.crossOrigin = 'anonymous'
    maskImg.onload = () => {
      renderCanvas()
      Message.success('蒙版已重置')
    }
    maskImg.src = imageStore.maskCurrentUrl! + '?t=' + Date.now()
  } catch (e: any) {
    Message.error(e.message || '重置失败')
  }
}

function onClose() {
  pendingStrokes = []
  emit('close')
}

function onConfirm() {
  if (imageStore.maskCurrentUrl) {
    emit('confirm', imageStore.maskCurrentUrl)
  }
  onClose()
}

onMounted(() => {
  document.addEventListener('mousemove', onCanvasMouseMove, true)
  document.addEventListener('mouseup', onCanvasMouseUp, true)
})
</script>

<style scoped>
.mask-editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mask-editor-modal {
  width: 90vw;
  max-width: 1400px;
  height: 85vh;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
}

.modal-actions {
  display: flex;
  gap: 8px;
}

.modal-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.editor-toolbar {
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  gap: 24px;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.value-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  min-width: 40px;
}

.editor-canvas-container {
  flex: 1;
  display: flex;
  min-height: 0;
  padding: 16px;
  background: var(--color-bg-secondary);
}

.canvas-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
}

.base-canvas,
.overlay-canvas {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  image-rendering: crisp-edges;
}

.overlay-canvas {
  cursor: crosshair;
  z-index: 2;
}

.base-canvas {
  z-index: 1;
}

.editor-sidebar {
  width: 280px;
  border-left: 1px solid var(--color-border);
  padding: 16px;
  overflow-y: auto;
  flex-shrink: 0;
}

.field-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.tip-box {
  background: var(--color-fill-2);
  border-radius: var(--radius-sm);
  padding: 12px;
}

.tip-title {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--color-text);
}

.tip-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.8;
}

.icon {
  width: 14px;
  height: 14px;
}

.mt-3 {
  margin-top: 12px;
}
</style>
