<template>
  <div class="template-detail-page">
    <div class="tdp-header">
      <a-button @click="$router.back()">
        ← 返回
      </a-button>
      <a-breadcrumb class="breadcrumb" style="margin-left: 16px">
        <a-breadcrumb-item @click="$router.push('/')">模板库</a-breadcrumb-item>
        <a-breadcrumb-item>模板详情</a-breadcrumb-item>
      </a-breadcrumb>
      <div style="flex: 1" />
      <a-button
        type="primary"
        :disabled="!currentTemplate"
        @click="onUseTemplate"
      >
        使用此模板生成样机
      </a-button>
    </div>

    <div v-if="templateStore.loading" class="tdp-loading">
      <a-skeleton :loading="true" animation :text="{ rows: 4 }">
        <a-skeleton-shape style="width: 100%; height: 320px; border-radius: 12px" />
      </a-skeleton>
    </div>

    <div v-else-if="!currentTemplate" class="tdp-404">
      <a-result status="404" title="模板不存在" sub-title="请检查链接是否正确" />
    </div>

    <div v-else class="tdp-content">
      <div class="tdp-main">
        <div class="tdp-preview-card">
          <div class="tdp-preview" ref="previewRef">
            <img :src="displayTemplate.imageUrl" :alt="displayTemplate.name" />
            <div
              class="tdp-fit-region"
              :style="fitRegionStyle"
            >
              <div class="tdp-fit-label">贴合区域</div>
            </div>
          </div>
          <div class="tdp-preview-info">
            <div class="tdp-preview-meta">
              <span class="meta-label">尺寸</span> {{ displayTemplate.width }} × {{ displayTemplate.height }} px
              <span class="divider" />
              <span class="meta-label">贴合区域</span> {{ displayTemplate.fitRegion.width }}×{{ displayTemplate.fitRegion.height }} @ ({{ displayTemplate.fitRegion.x }}, {{ displayTemplate.fitRegion.y }})
            </div>
          </div>
        </div>

        <div class="tdp-info-card mt-4">
          <div class="tdp-info-row">
            <h2 class="tdp-title">{{ displayTemplate.name }}</h2>
            <div class="tdp-tags">
              <a-tag color="arcoblue">{{ getCategoryLabel(displayTemplate.category) }}</a-tag>
              <a-tag v-if="currentStableVersion && activeVersionId === currentStableVersion.id" color="green">
                <icon-check /> 稳定版
              </a-tag>
              <a-tag v-if="activeVersionLabel" color="orangered">
                {{ activeVersionLabel }}
              </a-tag>
              <a-tag
                v-if="qualityGrade"
                :color="gradeColor"
                class="cursor-pointer"
                @click="$router.push(`/template/${templateId}/quality`)"
              >
                {{ qualityGrade }} 级 · {{ qualityScore }}分
              </a-tag>
            </div>
          </div>
          <div v-if="displayTemplate.description" class="tdp-desc">
            {{ displayTemplate.description }}
          </div>
          <div class="tdp-stats">
            <div class="stat-item">
              <div class="stat-value">{{ currentTemplate.useCount }}</div>
              <div class="stat-label">使用次数</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ templateStore.versions.length }}</div>
              <div class="stat-label">版本数</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ currentStableVersion ? currentStableVersion.versionLabel : '-' }}</div>
              <div class="stat-label">最新稳定版</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ getPermissionLabel(currentTemplate.permission) }}</div>
              <div class="stat-label">权限</div>
            </div>
          </div>
          <div class="tdp-actions">
            <VersionSelector
              v-if="templateStore.versions.length > 0"
              :template-id="templateId"
              v-model="activeVersionId"
              @select="onSelectVersion"
            />
          </div>
        </div>

        <VersionCompareView v-if="templateStore.compareResult" @close="templateStore.clearCompareResult()" />
      </div>

      <div class="tdp-side">
        <TemplateVersionManager
          :template-id="templateId"
          :current-template="currentTemplate"
          :can-edit="canEdit"
          @select-version="onSelectVersion"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTemplateStore, type Template, type TemplateVersion } from '@/stores/template'
import { useAuthStore } from '@/stores/auth'
import { getCategoryLabel } from '@/constants'
import { Message } from '@arco-design/web-vue'
import {
  IconCheck,
} from '@arco-design/web-vue/es/icon'
import TemplateVersionManager from '@/components/TemplateVersionManager.vue'
import VersionCompareView from '@/components/VersionCompareView.vue'
import VersionSelector from '@/components/VersionSelector.vue'

const route = useRoute()
const router = useRouter()
const templateStore = useTemplateStore()
const authStore = useAuthStore()

const templateId = computed(() => Number(route.params.id))
const currentTemplate = computed(() => templateStore.currentTemplate)
const previewRef = ref<HTMLDivElement | null>(null)

const activeVersionId = ref<number | null>(null)
const activeVersion = computed<TemplateVersion | null>(() =>
  templateStore.activeVersion ?? templateStore.versions.find(v => v.id === activeVersionId.value) ?? null
)
const activeVersionLabel = computed(() => activeVersion.value?.versionLabel || null)

const currentStableVersion = computed(() => templateStore.stableVersion)

const displayTemplate = computed(() => {
  if (activeVersion.value) {
    return {
      ...activeVersion.value,
      description: activeVersion.value.description || currentTemplate.value?.description || '',
    } as any
  }
  return currentTemplate.value
})

const canEdit = computed(() => {
  if (!authStore.user || !currentTemplate.value) return false
  return authStore.user.id === currentTemplate.value.userId || authStore.user.role === 'admin'
})

const qualityGrade = computed(() => {
  const t = currentTemplate.value
  return t?.qualityGrade || null
})

const qualityScore = computed(() => {
  const t = currentTemplate.value
  return t?.qualityScore || 0
})

const gradeColor = computed(() => {
  const g = qualityGrade.value
  if (g === 'S') return 'green'
  if (g === 'A') return 'arcoblue'
  if (g === 'B') return 'orangered'
  return 'red'
})

const fitRegionStyle = computed(() => {
  const t = displayTemplate.value
  if (!t || !t.fitRegion) return {}
  const f = t.fitRegion
  return {
    left: (f.x / t.width * 100) + '%',
    top: (f.y / t.height * 100) + '%',
    width: (f.width / t.width * 100) + '%',
    height: (f.height / t.height * 100) + '%',
  }
})

function getPermissionLabel(p: string) {
  return { public: '公开', private: '私有', restricted: '受限' }[p] || p
}

onMounted(async () => {
  if (authStore.token && !authStore.user) {
    try {
      await authStore.fetchMe()
    } catch {
      // ignore
    }
  }
  await templateStore.fetchTemplate(templateId.value)
})

watch(() => templateStore.versions, (vs) => {
  if (vs.length > 0 && !activeVersionId.value) {
    const stable = vs.find(v => v.isStable)
    activeVersionId.value = (stable || vs[0]).id
  }
}, { immediate: true })

function onSelectVersion(v: TemplateVersion) {
  activeVersionId.value = v.id
}

function onUseTemplate() {
  if (!currentTemplate.value) return
  let tpl: Template = currentTemplate.value
  if (activeVersion.value) {
    tpl = {
      ...currentTemplate.value,
      name: activeVersion.value.name,
      category: activeVersion.value.category,
      width: activeVersion.value.width,
      height: activeVersion.value.height,
      imageUrl: activeVersion.value.imageUrl,
      fitRegion: { ...activeVersion.value.fitRegion },
      permission: activeVersion.value.permission,
    }
  }
  templateStore.currentTemplate = tpl
  router.push(`/generator/${tpl.id}`)
}
</script>

<style scoped>
.template-detail-page {
  padding: 20px 24px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}
.tdp-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}
.breadcrumb {
  font-size: 13px;
}
.tdp-loading {
  padding: 20px 0;
}
.tdp-404 {
  padding: 60px 0;
}
.tdp-content {
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 20px;
  align-items: start;
}
.tdp-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.tdp-side {
  position: sticky;
  top: 20px;
}
.tdp-preview-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.tdp-preview {
  position: relative;
  width: 100%;
  max-height: 520px;
  aspect-ratio: 16 / 10;
  background: var(--color-bg-secondary);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tdp-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.tdp-fit-region {
  position: absolute;
  border: 2px dashed #007AFF;
  background: rgba(0, 122, 255, 0.06);
  border-radius: 4px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 2px 4px;
}
.tdp-fit-label {
  font-size: 10px;
  color: #007AFF;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.75);
  padding: 1px 4px;
  border-radius: 2px;
}
.tdp-preview-info {
  padding: 10px 16px;
  border-top: 1px solid var(--color-border);
}
.tdp-preview-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  flex-wrap: wrap;
}
.meta-label {
  display: inline-block;
  background: var(--color-fill-2);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--color-text-2);
}
.divider {
  width: 1px;
  height: 12px;
  background: var(--color-border);
  margin: 0 6px;
}
.tdp-info-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px 20px;
}
.tdp-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.tdp-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
}
.tdp-tags {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.tdp-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin: 8px 0 16px;
  padding: 10px 12px;
  background: var(--color-fill-1);
  border-radius: var(--radius-sm);
}
.tdp-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat-item {
  text-align: center;
  padding: 12px;
  background: var(--color-fill-1);
  border-radius: var(--radius-sm);
}
.stat-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}
.stat-label {
  font-size: 11px;
  color: var(--color-text-3);
  margin-top: 2px;
}
.tdp-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
.mt-4 {
  margin-top: 16px;
}
</style>
