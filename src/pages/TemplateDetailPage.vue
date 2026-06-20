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
        <div v-if="editingRegions" class="tdp-fit-editor-card">
          <div class="editor-header">
            <span class="editor-title">编辑贴合区域</span>
            <div class="flex gap-2">
              <a-button @click="cancelEditRegions">取消</a-button>
              <a-button type="primary" :loading="saving" @click="saveRegions">保存</a-button>
            </div>
          </div>
          <FitRegionEditor
            v-model="displayTemplate.fitRegions"
            :image-url="displayTemplate.imageUrl"
            :template-width="displayTemplate.width"
            :template-height="displayTemplate.height"
            @update:modelValue="onUpdateRegions"
          />
        </div>

        <div v-else class="tdp-preview-card">
          <div class="tdp-preview" ref="previewRef">
            <img :src="displayTemplate.imageUrl" :alt="displayTemplate.name" />
            <div
              v-for="(region, idx) in displayFitRegions"
              :key="idx"
              class="tdp-fit-region"
              :class="{ active: idx === selectedRegionIndex }"
              :style="{
                ...getRegionStyle(region),
                borderColor: getRegionColor(idx).border,
                background: idx === selectedRegionIndex ? getRegionColor(idx).bg : 'transparent',
              }"
              @click="selectedRegionIndex = idx"
            >
              <div class="tdp-fit-label" :style="{ color: getRegionColor(idx).border }">
                {{ region.name || `区域${idx + 1}` }}
              </div>
            </div>
          </div>
          <div class="tdp-preview-info">
            <div class="tdp-preview-meta">
              <span class="meta-label">尺寸</span> {{ displayTemplate.width }} × {{ displayTemplate.height }} px
              <span class="divider" />
              <span class="meta-label">贴合区域</span>
              <a-tag
                v-for="(r, idx) in displayFitRegions"
                :key="idx"
                :style="{ borderColor: getRegionColor(idx).border, color: getRegionColor(idx).border }"
                :class="{ active: idx === selectedRegionIndex }"
                size="small"
                @click="selectedRegionIndex = idx"
              >
                {{ r.name || `区域${idx + 1}` }}: {{ r.width }}×{{ r.height }}
              </a-tag>
            </div>
            <div v-if="selectedRegion" class="selected-region-info mt-2">
              <span class="meta-label">选中区域</span>
              {{ selectedRegion.name }} @ ({{ Math.round(selectedRegion.x) }}, {{ Math.round(selectedRegion.y) }}) · {{ Math.round(selectedRegion.width) }}×{{ Math.round(selectedRegion.height) }}
            </div>
          </div>
        </div>

        <div class="tdp-info-card mt-4">
          <div v-if="!editingInfo">
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
            <div class="tdp-tags-list" v-if="currentTemplate.tags && currentTemplate.tags.length > 0">
              <a-tag v-for="tag in currentTemplate.tags" :key="tag" color="cyan" size="small">{{ tag }}</a-tag>
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
            <div class="tdp-actions" v-if="canEdit">
              <a-space>
                <a-button v-if="!editingRegions" @click="startEditRegions">
                  <template #icon><icon-settings /></template>
                  编辑贴合区域
                </a-button>
                <a-button @click="startEditInfo">
                  <template #icon><icon-edit /></template>
                  编辑信息
                </a-button>
              </a-space>
              <VersionSelector
                v-if="templateStore.versions.length > 0"
                :template-id="templateId"
                v-model="activeVersionId"
                @select="onSelectVersion"
              />
            </div>
            <div class="tdp-actions" v-else>
              <VersionSelector
                v-if="templateStore.versions.length > 0"
                :template-id="templateId"
                v-model="activeVersionId"
                @select="onSelectVersion"
              />
            </div>
          </div>

          <div v-else class="tdp-edit-form">
            <h3 class="edit-title">编辑模板信息</h3>
            <a-form :model="infoForm" layout="vertical">
              <a-form-item label="模板名称" required>
                <a-input v-model="infoForm.name" placeholder="输入模板名称" />
              </a-form-item>
              <a-form-item label="描述">
                <a-textarea v-model="infoForm.description" :auto-size="{ minRows: 3 }" placeholder="模板描述" />
              </a-form-item>
              <a-form-item label="标签">
                <a-input-tag v-model="infoForm.tags" placeholder="添加标签后按回车" />
              </a-form-item>
              <a-form-item label="权限">
                <a-radio-group v-model="infoForm.permission">
                  <a-radio value="public">公开</a-radio>
                  <a-radio value="private">私有</a-radio>
                </a-radio-group>
              </a-form-item>
              <div class="flex justify-end gap-2 mt-4">
                <a-button @click="cancelEditInfo">取消</a-button>
                <a-button type="primary" :loading="saving" @click="saveInfo">保存</a-button>
              </div>
            </a-form>
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
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTemplateStore, type Template, type TemplateVersion, type FitRegion } from '@/stores/template'
import { useAuthStore } from '@/stores/auth'
import { getCategoryLabel } from '@/constants'
import { Message, Modal } from '@arco-design/web-vue'
import {
  IconCheck,
  IconEdit,
  IconClose,
  IconSettings,
} from '@arco-design/web-vue/es/icon'
import TemplateVersionManager from '@/components/TemplateVersionManager.vue'
import VersionCompareView from '@/components/VersionCompareView.vue'
import VersionSelector from '@/components/VersionSelector.vue'
import FitRegionEditor from '@/components/FitRegionEditor.vue'

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

const editingInfo = ref(false)
const editingRegions = ref(false)
const saving = ref(false)
const selectedRegionIndex = ref(0)
const infoForm = reactive({
  name: '',
  description: '',
  tags: [] as string[],
  permission: 'public',
})
let editRegionsBackup: FitRegion[] = []

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

const displayFitRegions = computed<FitRegion[]>(() => {
  const t = displayTemplate.value
  if (!t) return []
  if (t.fitRegions && t.fitRegions.length > 0) {
    return t.fitRegions
  }
  if (t.fitRegion) {
    return [{
      id: 0,
      name: '默认区域',
      x: t.fitRegion.x,
      y: t.fitRegion.y,
      width: t.fitRegion.width,
      height: t.fitRegion.height,
      sortOrder: 0,
    }]
  }
  return []
})

const selectedRegion = computed<FitRegion | null>(() => {
  return displayFitRegions.value[selectedRegionIndex.value] || null
})

function getRegionStyle(region: FitRegion) {
  const t = displayTemplate.value
  if (!t) return {}
  return {
    left: (region.x / t.width * 100) + '%',
    top: (region.y / t.height * 100) + '%',
    width: (region.width / t.width * 100) + '%',
    height: (region.height / t.height * 100) + '%',
  }
}

function getRegionColor(index: number) {
  const colors = [
    { border: '#007AFF', bg: 'rgba(0, 122, 255, 0.08)' },
    { border: '#FF7D00', bg: 'rgba(255, 125, 0, 0.08)' },
    { border: '#00B42A', bg: 'rgba(0, 180, 42, 0.08)' },
    { border: '#F53F3F', bg: 'rgba(245, 63, 63, 0.08)' },
    { border: '#722ED1', bg: 'rgba(114, 46, 209, 0.08)' },
  ]
  return colors[index % colors.length]
}

function getPermissionLabel(p: string) {
  return { public: '公开', private: '私有', restricted: '受限' }[p] || p
}

function startEditInfo() {
  const t = currentTemplate.value
  if (!t) return
  infoForm.name = t.name
  infoForm.description = t.description || ''
  infoForm.tags = [...(t.tags || [])]
  infoForm.permission = t.permission
  editingInfo.value = true
}

function cancelEditInfo() {
  editingInfo.value = false
}

async function saveInfo() {
  if (!infoForm.name.trim()) {
    Message.warning('模板名称不能为空')
    return
  }
  saving.value = true
  try {
    await templateStore.updateTemplate(templateId.value, {
      name: infoForm.name.trim(),
      description: infoForm.description.trim(),
      tags: infoForm.tags,
      permission: infoForm.permission,
    })
    Message.success('更新成功')
    editingInfo.value = false
  } catch (e: any) {
    Message.error(e.message || '更新失败')
  } finally {
    saving.value = false
  }
}

function startEditRegions() {
  const t = displayTemplate.value
  if (!t) return
  editRegionsBackup = JSON.parse(JSON.stringify(displayFitRegions.value))
  editingRegions.value = true
}

function cancelEditRegions() {
  editingRegions.value = false
  editRegionsBackup = []
}

async function saveRegions() {
  if (displayFitRegions.value.length === 0) {
    Message.warning('请至少保留一个贴合区域')
    return
  }
  saving.value = true
  try {
    const firstRegion = displayFitRegions.value[0]
    const payload: any = {
      fit_x: Math.round(firstRegion.x),
      fit_y: Math.round(firstRegion.y),
      fit_width: Math.round(firstRegion.width),
      fit_height: Math.round(firstRegion.height),
      fitRegions: displayFitRegions.value,
    }
    if (activeVersionId.value) {
      await templateStore.updateVersion(templateId.value, activeVersionId.value, payload)
    } else {
      await templateStore.updateTemplate(templateId.value, payload)
    }
    Message.success('贴合区域更新成功')
    editingRegions.value = false
  } catch (e: any) {
    Message.error(e.message || '更新失败')
  } finally {
    saving.value = false
  }
}

async function onUpdateRegions(val: FitRegion[]) {
  if (!currentTemplate.value) return
  if (activeVersionId.value) {
    const version = templateStore.versions.find(v => v.id === activeVersionId.value)
    if (version) {
      version.fitRegions = val
      if (val.length > 0) {
        version.fitRegion = {
          x: val[0].x,
          y: val[0].y,
          width: val[0].width,
          height: val[0].height,
        }
      }
    }
  } else if (currentTemplate.value) {
    currentTemplate.value.fitRegions = val
    if (val.length > 0) {
      currentTemplate.value.fitRegion = {
        x: val[0].x,
        y: val[0].y,
        width: val[0].width,
        height: val[0].height,
      }
    }
  }
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
      fitRegions: activeVersion.value.fitRegions ? [...activeVersion.value.fitRegions] : undefined,
      permission: activeVersion.value.permission,
    }
  }
  templateStore.currentTemplate = tpl
  templateStore.selectedFitRegionIndex = selectedRegionIndex.value
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
.mt-2 {
  margin-top: 8px;
}
.gap-2 {
  gap: 8px;
}
.tdp-fit-region {
  position: absolute;
  border: 2px dashed #007AFF;
  border-radius: 4px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 2px 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.tdp-fit-region.active {
  border-width: 3px;
}
.selected-region-info {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.tdp-fit-editor-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-fill-1);
}
.editor-title {
  font-weight: 600;
  color: var(--color-text);
}
.tdp-tags-list {
  margin-bottom: 16px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tdp-edit-form {
  padding: 4px;
}
.edit-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
}
.tdp-fit-region {
  position: absolute;
  border: 2px dashed #007AFF;
  background: transparent;
  border-radius: 4px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 2px 4px;
}
</style>
