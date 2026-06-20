<template>
  <div class="background-editor">
    <div class="panel-header">
      <div class="section-title">模板背景</div>
      <a-switch v-model="imageStore.backgroundReplaceEnabled" />
    </div>

    <div v-if="imageStore.backgroundReplaceEnabled" class="editor-content">
      <div class="type-selector">
        <a-radio-group v-model="selectedType" type="button" size="small">
          <a-radio value="solid">纯色</a-radio>
          <a-radio value="gradient">渐变</a-radio>
          <a-radio value="image">图片</a-radio>
        </a-radio-group>
      </div>

      <div v-if="selectedType === 'solid'" class="solid-section">
        <div class="field-label">背景颜色</div>
        <div class="color-picker-row">
          <div
            class="color-preview"
            :style="{ background: solidColorCss }"
            @click="showColorPicker = !showColorPicker"
          ></div>
          <a-input v-model="solidColorHex" placeholder="#ffffff" style="flex: 1" @blur="updateSolidFromHex" />
        </div>

        <div v-if="showColorPicker" class="color-picker-popup">
          <div class="color-grid">
            <div
              v-for="color in presetColors"
              :key="color"
              class="color-swatch"
              :style="{ background: color }"
              @click="selectPresetColor(color)"
            ></div>
          </div>
        </div>

        <div class="field-label mt-3">不透明度</div>
        <a-slider v-model="solidAlpha" :min="0" :max="1" :step="0.01" />
      </div>

      <div v-if="selectedType === 'gradient'" class="gradient-section">
        <div class="field-label">渐变类型</div>
        <a-radio-group v-model="gradientType" type="button" size="small">
          <a-radio value="linear">线性</a-radio>
          <a-radio value="radial">径向</a-radio>
        </a-radio-group>

        <div v-if="gradientType === 'linear'" class="mt-3">
          <div class="field-label">角度</div>
          <a-slider v-model="gradientAngle" :min="0" :max="360" :step="1" />
          <span class="value-label">{{ gradientAngle }}°</span>
        </div>

        <div class="gradient-stops mt-3">
          <div class="field-label">颜色节点</div>
          <div
            v-for="(stop, idx) in gradientStops"
            :key="idx"
            class="gradient-stop-row"
          >
            <div
              class="color-preview small"
              :style="{ background: rgbToCss(stop.r, stop.g, stop.b) }"
              @click="editStopIndex = editStopIndex === idx ? -1 : idx"
            ></div>
            <a-slider
              v-model="stop.offset"
              :min="0"
              :max="1"
              :step="0.01"
              style="flex: 1"
            />
            <a-button
              v-if="gradientStops.length > 2"
              size="mini"
              type="text"
              @click="removeStop(idx)"
            >
              移除
            </a-button>
          </div>
          <a-button size="small" class="mt-2" @click="addStop">+ 添加节点</a-button>
        </div>

        <div v-if="editStopIndex >= 0" class="color-picker-popup">
          <div class="color-grid">
            <div
              v-for="color in presetColors"
              :key="color"
              class="color-swatch"
              :style="{ background: color }"
              @click="setStopColor(color)"
            ></div>
          </div>
        </div>

        <div class="gradient-preview mt-3">
          <div class="preview-box" :style="{ background: gradientPreviewCss }"></div>
        </div>
      </div>

      <div v-if="selectedType === 'image'" class="image-section">
        <a-upload
          :auto-upload="false"
          :limit="1"
          accept="image/*"
          :draggable="true"
          @change="onBgImageChange"
        >
          <template #upload-button>
            <div class="upload-area">上传背景图片</div>
          </template>
        </a-upload>

        <div v-if="bgImageUrl" class="bg-image-preview mt-3">
          <img :src="bgImageUrl" alt="background preview" />
        </div>

        <div class="field-label mt-3">填充方式</div>
        <a-radio-group v-model="imageFit" type="button" size="small">
          <a-radio value="cover">覆盖</a-radio>
          <a-radio value="contain">包含</a-radio>
          <a-radio value="fill">拉伸</a-radio>
        </a-radio-group>

        <div class="field-label mt-3">不透明度</div>
        <a-slider v-model="imageOpacity" :min="0" :max="1" :step="0.01" />

        <div v-if="imageStore.backgroundImages.length > 0" class="mt-3">
          <div class="field-label">已上传背景</div>
          <div class="bg-gallery">
            <div
              v-for="item in imageStore.backgroundImages"
              :key="item.url"
              class="bg-thumb"
              :class="{ selected: bgImageUrl === item.url }"
              @click="selectBgImage(item.url)"
            >
              <img :src="item.url" :alt="item.filename" />
            </div>
          </div>
        </div>
      </div>

      <a-button
        size="small"
        type="primary"
        class="mt-3"
        long
        :loading="imageStore.isReplacingBackground"
        @click="applyBackground"
      >
        应用背景
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useImageProcessingStore, type BackgroundReplaceParams } from '@/stores/imageProcessing'
import { Message } from '@arco-design/web-vue'

const emit = defineEmits<{
  applied: [params: BackgroundReplaceParams]
}>()

const imageStore = useImageProcessingStore()

const selectedType = ref<'solid' | 'gradient' | 'image'>('solid')
const showColorPicker = ref(false)
const editStopIndex = ref(-1)
const bgImageUrl = ref<string | null>(null)
const bgImageFile = ref<File | null>(null)

const solidColor = ref({ r: 255, g: 255, b: 255 })
const solidAlpha = ref(1)
const solidColorHex = ref('#ffffff')

const gradientType = ref<'linear' | 'radial'>('linear')
const gradientAngle = ref(180)
const gradientStops = ref([
  { offset: 0, r: 66, g: 153, b: 225 },
  { offset: 1, r: 255, g: 255, b: 255 },
])

const imageFit = ref<'cover' | 'contain' | 'fill' | 'stretch'>('cover')
const imageOpacity = ref(1)

const presetColors = [
  '#ffffff', '#f5f5f5', '#e0e0e0', '#bdbdbd',
  '#2196f3', '#4caf50', '#ff9800', '#f44336',
  '#9c27b0', '#3f51b5', '#00bcd4', '#8bc34a',
  '#ffc107', '#ff5722', '#795548', '#000000',
]

const solidColorCss = computed(() => `rgba(${solidColor.value.r}, ${solidColor.value.g}, ${solidColor.value.b}, ${solidAlpha.value})`)

const gradientPreviewCss = computed(() => {
  if (gradientType.value === 'linear') {
    const sorted = [...gradientStops.value].sort((a, b) => a.offset - b.offset)
    const stops = sorted.map(s => `${rgbToCss(s.r, s.g, s.b)} ${s.offset * 100}%`).join(', ')
    return `linear-gradient(${gradientAngle.value}deg, ${stops})`
  } else {
    const sorted = [...gradientStops.value].sort((a, b) => a.offset - b.offset)
    const stops = sorted.map(s => `${rgbToCss(s.r, s.g, s.b)} ${s.offset * 100}%`).join(', ')
    return `radial-gradient(circle, ${stops})`
  }
})

function rgbToCss(r: number, g: number, b: number) {
  return `rgb(${r}, ${g}, ${b})`
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 255, g: 255, b: 255 }
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

function selectPresetColor(color: string) {
  const rgb = hexToRgb(color)
  solidColor.value = rgb
  solidColorHex.value = color
  showColorPicker.value = false
}

function updateSolidFromHex() {
  if (/^#[0-9a-f]{6}$/i.test(solidColorHex.value)) {
    solidColor.value = hexToRgb(solidColorHex.value)
  }
}

function addStop() {
  gradientStops.value.push({
    offset: 0.5,
    r: Math.floor(Math.random() * 255),
    g: Math.floor(Math.random() * 255),
    b: Math.floor(Math.random() * 255),
  })
}

function removeStop(idx: number) {
  gradientStops.value.splice(idx, 1)
}

function setStopColor(color: string) {
  if (editStopIndex.value >= 0) {
    const rgb = hexToRgb(color)
    gradientStops.value[editStopIndex.value] = {
      ...gradientStops.value[editStopIndex.value],
      ...rgb,
    }
    editStopIndex.value = -1
  }
}

function onBgImageChange(fileList: any[]) {
  if (fileList.length > 0 && fileList[0].file) {
    bgImageFile.value = fileList[0].file
    const reader = new FileReader()
    reader.onload = (e) => {
      bgImageUrl.value = e.target?.result as string
    }
    reader.readAsDataURL(fileList[0].file)
  } else {
    bgImageFile.value = null
    bgImageUrl.value = null
  }
}

function selectBgImage(url: string) {
  bgImageUrl.value = url
  bgImageFile.value = null
}

async function applyBackground() {
  let params: BackgroundReplaceParams

  if (selectedType.value === 'solid') {
    params = {
      type: 'solid',
      solidColor: {
        ...solidColor.value,
        a: Math.round(solidAlpha.value * 255),
      },
    }
  } else if (selectedType.value === 'gradient') {
    const sorted = [...gradientStops.value].sort((a, b) => a.offset - b.offset)
    params = {
      type: 'gradient',
      gradient: {
        type: gradientType.value,
        colors: sorted.map(s => ({
          offset: s.offset,
          r: s.r,
          g: s.g,
          b: s.b,
          a: 255,
        })),
        angle: gradientType.value === 'linear' ? gradientAngle.value : undefined,
      },
    }
  } else if (selectedType.value === 'image' && bgImageUrl.value) {
    let imagePath = bgImageUrl.value

    if (bgImageFile.value) {
      try {
        const uploadRes = await imageStore.uploadBackgroundImage(bgImageFile.value)
        imagePath = uploadRes.url
        bgImageUrl.value = uploadRes.url
        await imageStore.loadBackgroundImages()
      } catch (e: any) {
        Message.error(e.message || '上传背景图失败')
        return
      }
    }

    params = {
      type: 'image',
      imagePath,
      imageFit: imageFit.value,
      imageOpacity: imageOpacity.value,
    }
  } else {
    Message.warning('请选择背景图片')
    return
  }

  imageStore.setBackgroundParams(params)
  emit('applied', params)
  Message.success('背景设置已应用')
}

watch(solidColor, (val) => {
  solidColorHex.value = rgbToHex(val.r, val.g, val.b)
}, { deep: true })

onMounted(() => {
  imageStore.loadBackgroundImages()
})
</script>

<style scoped>
.background-editor {
  width: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.editor-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.type-selector {
  display: flex;
  justify-content: center;
}

.field-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.value-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: 8px;
}

.color-picker-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-preview {
  width: 40px;
  height: 32px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  cursor: pointer;
  flex-shrink: 0;
}

.color-preview.small {
  width: 32px;
  height: 32px;
}

.color-picker-popup {
  margin-top: 8px;
  padding: 8px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
}

.color-swatch {
  aspect-ratio: 1;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid var(--color-border);
}

.gradient-stop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.gradient-preview {
  display: flex;
  justify-content: center;
}

.preview-box {
  width: 100%;
  height: 60px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.upload-area {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: border-color 0.15s;
}

.upload-area:hover {
  border-color: var(--color-primary);
}

.bg-image-preview {
  max-height: 120px;
  overflow: hidden;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}

.bg-image-preview img {
  width: 100%;
  display: block;
  object-fit: cover;
}

.bg-gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.bg-thumb {
  aspect-ratio: 1;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s;
}

.bg-thumb.selected {
  border-color: var(--color-primary);
}

.bg-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mt-2 {
  margin-top: 8px;
}

.mt-3 {
  margin-top: 12px;
}

.long {
  width: 100%;
}
</style>
