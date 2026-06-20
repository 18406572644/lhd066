<template>
  <div class="lighting-panel">
    <div class="panel-header">
      <div class="section-title">光照匹配</div>
      <a-switch v-model="imageStore.lightingEnabled" />
    </div>

    <div v-if="imageStore.lightingEnabled" class="panel-content">
      <div class="lighting-stats" v-if="templateStats">
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">模板亮度</div>
            <div class="stat-value">{{ formatPercent(templateStats.avgBrightness) }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">模板对比度</div>
            <div class="stat-value">{{ formatPercent(templateStats.avgContrast) }}</div>
          </div>
          <div class="stat-item" v-if="designStats">
            <div class="stat-label">设计图亮度</div>
            <div class="stat-value">{{ formatPercent(designStats.avgBrightness) }}</div>
          </div>
          <div class="stat-item" v-if="designStats">
            <div class="stat-label">设计图对比度</div>
            <div class="stat-value">{{ formatPercent(designStats.avgContrast) }}</div>
          </div>
        </div>

        <div class="light-direction" v-if="templateStats.dominantLightDirection">
          <div class="field-label">检测到的光照方向</div>
          <div class="direction-indicator">
            <svg viewBox="0 0 100 100" class="direction-svg">
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-border)" stroke-width="2" />
              <line x1="50" y1="50" x2="50" y2="10" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="3,3" />
              <line x1="50" y1="50" x2="90" y2="50" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="3,3" />
              <line x1="50" y1="50" x2="50" y2="90" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="3,3" />
              <line x1="50" y1="50" x2="10" y2="50" stroke="var(--color-border)" stroke-width="1" stroke-dasharray="3,3" />
              <line
                x1="50"
                y1="50"
                :x2="50 + templateStats.dominantLightDirection.x * 35"
                :y2="50 + templateStats.dominantLightDirection.y * 35"
                stroke="var(--color-primary)"
                stroke-width="3"
                stroke-linecap="round"
              />
              <circle
                :cx="50 + templateStats.dominantLightDirection.x * 35"
                :cy="50 + templateStats.dominantLightDirection.y * 35"
                r="6"
                fill="var(--color-primary)"
              />
              <circle cx="50" cy="50" r="4" fill="var(--color-text-3)" />
            </svg>
          </div>
        </div>
      </div>

      <a-collapse :default-active-key="['auto', 'manual']">
        <a-collapse-item name="auto" title="自动匹配">
          <a-button
            size="small"
            type="primary"
            long
            :loading="imageStore.isMatchingLighting"
            @click="autoMatchLighting"
          >
            <template #icon><Sparkles class="icon" /></template>
            一键匹配模板光照
          </a-button>
          <div class="tip-text">自动分析模板光照特征，调整设计图的亮度、对比度和阴影方向</div>
        </a-collapse-item>

        <a-collapse-item name="manual" title="手动调节">
          <div class="field-label">亮度</div>
          <a-slider
            v-model="manualParams.brightness"
            :min="-100"
            :max="100"
            :step="1"
            @change="onManualChange"
          />
          <span class="value-label">{{ manualParams.brightness > 0 ? '+' : '' }}{{ manualParams.brightness }}</span>

          <div class="field-label mt-3">对比度</div>
          <a-slider
            v-model="manualParams.contrast"
            :min="0.5"
            :max="2"
            :step="0.01"
            @change="onManualChange"
          />
          <span class="value-label">{{ manualParams.contrast.toFixed(2) }}x</span>

          <div class="field-label mt-3">饱和度</div>
          <a-slider
            v-model="manualParams.saturation"
            :min="0"
            :max="2"
            :step="0.01"
            @change="onManualChange"
          />
          <span class="value-label">{{ manualParams.saturation.toFixed(2) }}x</span>

          <div class="field-label mt-3">阴影强度</div>
          <a-slider
            v-model="manualParams.shadowIntensity"
            :min="0"
            :max="1"
            :step="0.01"
            @change="onManualChange"
          />
          <span class="value-label">{{ (manualParams.shadowIntensity * 100).toFixed(0) }}%</span>

          <a-button
            size="small"
            class="mt-3"
            long
            :loading="imageStore.isMatchingLighting"
            @click="applyManualLighting"
          >
            应用手动调节
          </a-button>
        </a-collapse-item>
      </a-collapse>

      <div v-if="imageStore.lightingParams" class="applied-params mt-3">
        <div class="field-label">当前参数</div>
        <div class="params-grid">
          <div class="param-row">
            <span>亮度</span>
            <span>{{ imageStore.lightingParams.brightness > 0 ? '+' : '' }}{{ imageStore.lightingParams.brightness.toFixed(1) }}</span>
          </div>
          <div class="param-row">
            <span>对比度</span>
            <span>{{ imageStore.lightingParams.contrast.toFixed(2) }}x</span>
          </div>
          <div class="param-row">
            <span>饱和度</span>
            <span>{{ imageStore.lightingParams.saturation.toFixed(2) }}x</span>
          </div>
          <div class="param-row">
            <span>阴影</span>
            <span>{{ (imageStore.lightingParams.shadowIntensity * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { useImageProcessingStore, type LightingAdjustParams } from '@/stores/imageProcessing'
import { Message } from '@arco-design/web-vue'
import { Sparkles } from 'lucide-vue-next'

const props = defineProps<{
  templateImageUrl: string | null
  designImageUrl: string | null
}>()

const emit = defineEmits<{
  applied: [imageUrl: string]
}>()

const imageStore = useImageProcessingStore()

const templateStats = computed(() => imageStore.templateLightingStats)
const designStats = computed(() => imageStore.designLightingStats)

const manualParams = reactive<Partial<LightingAdjustParams>>({
  brightness: 0,
  contrast: 1,
  saturation: 1,
  shadowIntensity: 0,
  lightDirection: { x: 0, y: -1 },
})

function formatPercent(value: number) {
  return (value * 100).toFixed(1) + '%'
}

async function analyzeLighting() {
  if (props.templateImageUrl) {
    try {
      await imageStore.analyzeLighting(props.templateImageUrl, true)
    } catch (e: any) {
      console.warn('Failed to analyze template lighting:', e.message)
    }
  }
  if (props.designImageUrl) {
    try {
      await imageStore.analyzeLighting(props.designImageUrl, false)
    } catch (e: any) {
      console.warn('Failed to analyze design lighting:', e.message)
    }
  }
}

async function autoMatchLighting() {
  if (!props.designImageUrl || !props.templateImageUrl) {
    Message.warning('请先上传设计图和选择模板')
    return
  }

  try {
    const result = await imageStore.matchLighting(props.designImageUrl, props.templateImageUrl)
    if (imageStore.templateLightingStats?.dominantLightDirection) {
      manualParams.lightDirection = { ...imageStore.templateLightingStats.dominantLightDirection }
    }
    Message.success('光照匹配完成')
    emit('applied', result.processedImageUrl)
  } catch (e: any) {
    Message.error(e.message || '光照匹配失败')
  }
}

function onManualChange() {
  if (templateStats.value?.dominantLightDirection) {
    manualParams.lightDirection = { ...templateStats.value.dominantLightDirection }
  }
  imageStore.setCustomLightingParams({ ...manualParams })
}

async function applyManualLighting() {
  if (!props.designImageUrl || !props.templateImageUrl) {
    Message.warning('请先上传设计图和选择模板')
    return
  }

  try {
    const result = await imageStore.matchLighting(props.designImageUrl, props.templateImageUrl)
    Message.success('手动调节已应用')
    emit('applied', result.processedImageUrl)
  } catch (e: any) {
    Message.error(e.message || '应用失败')
  }
}

watch(() => props.templateImageUrl, () => {
  if (props.templateImageUrl && imageStore.lightingEnabled) {
    analyzeLighting()
  }
}, { immediate: true })

watch(() => props.designImageUrl, () => {
  if (props.designImageUrl && imageStore.lightingEnabled) {
    analyzeLighting()
  }
}, { immediate: true })
</script>

<style scoped>
.lighting-panel {
  width: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lighting-stats {
  background: var(--color-fill-2);
  border-radius: var(--radius-sm);
  padding: 12px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  font-family: monospace;
}

.field-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.value-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-family: monospace;
}

.light-direction {
  margin-top: 12px;
}

.direction-indicator {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.direction-svg {
  width: 100px;
  height: 100px;
}

.tip-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 8px;
  line-height: 1.5;
}

.applied-params {
  background: var(--color-fill-2);
  border-radius: var(--radius-sm);
  padding: 12px;
}

.params-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  font-family: monospace;
}

.param-row span:first-child {
  color: var(--color-text-secondary);
}

.icon {
  width: 14px;
  height: 14px;
}

.mt-3 {
  margin-top: 12px;
}

.long {
  width: 100%;
}
</style>
