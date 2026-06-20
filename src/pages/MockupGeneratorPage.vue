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
      <div class="canvas-wrapper checkerboard">
        <canvas ref="canvasRef" />
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
import { ref, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useMockupStore } from '@/stores/mockup'
import { useTemplateStore } from '@/stores/template'
import type { Template } from '@/stores/template'
import { Message } from '@arco-design/web-vue'
import type { FileItem } from '@arco-design/web-vue'

const route = useRoute()
const mockupStore = useMockupStore()
const templateStore = useTemplateStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const designFileList = ref<FileItem[]>([])

let templateImg: HTMLImageElement | null = null
let designImg: HTMLImageElement | null = null

onMounted(async () => {
  await templateStore.fetchTemplates()
  const id = route.params.id
  if (id) {
    const tpl = await templateStore.fetchTemplate(Number(id))
    if (tpl) selectTemplate(tpl)
  }
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
  mockupStore.currentTemplate = tpl
  mockupStore.offset = { x: 0, y: 0 }
  mockupStore.scale = { x: 1, y: 1 }
  mockupStore.resultUrl = null
  templateImg = new Image()
  templateImg.crossOrigin = 'anonymous'
  templateImg.onload = () => renderCanvas()
  templateImg.src = tpl.imageUrl
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

  const displayScale = Math.min(600 / tpl.width, 500 / tpl.height, 1)
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
}
.generator-left {
  width: 240px;
  min-width: 240px;
  background: var(--color-bg);
  border-right: 1px solid var(--color-border);
  padding: 16px;
  overflow-y: auto;
}
.generator-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.canvas-wrapper {
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: inline-block;
}
.canvas-wrapper canvas {
  display: block;
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
.panel-section {
  margin-bottom: 20px;
}
.field-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
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
</style>
