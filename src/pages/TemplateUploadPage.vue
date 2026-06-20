<template>
  <div class="p-6 max-w-3xl mx-auto">
    <div v-if="qualityReport">
      <div class="qr-result-header">
        <h2>质量检测完成</h2>
        <div class="qr-result-grade" :class="'grade-' + qualityReport.grade">
          <span class="qr-result-grade-label">{{ qualityReport.grade }} 级</span>
          <span class="qr-result-grade-score">{{ qualityReport.totalScore }}分</span>
        </div>
      </div>

      <div class="qr-result-scores">
        <div class="qr-result-score-item">
          <span class="label">贴合区域</span>
          <a-progress :percent="qualityReport.fitRegionScore" :stroke-width="8" :color="getScoreColor(qualityReport.fitRegionScore)" />
        </div>
        <div class="qr-result-score-item">
          <span class="label">图片质量</span>
          <a-progress :percent="qualityReport.imageQualityScore" :stroke-width="8" :color="getScoreColor(qualityReport.imageQualityScore)" />
        </div>
        <div class="qr-result-score-item">
          <span class="label">元信息</span>
          <a-progress :percent="qualityReport.metadataScore" :stroke-width="8" :color="getScoreColor(qualityReport.metadataScore)" />
        </div>
        <div class="qr-result-score-item">
          <span class="label">可访问性</span>
          <a-progress :percent="qualityReport.accessibilityScore" :stroke-width="8" :color="getScoreColor(qualityReport.accessibilityScore)" />
        </div>
      </div>

      <div v-if="qualityReport.issues.length" class="qr-result-issues">
        <h3>问题点</h3>
        <a-list :data="qualityReport.issues" :bordered="false" size="small">
          <template #item="{ item }">
            <a-list-item>
              <a-tag :color="item.severity === 'critical' ? 'red' : item.severity === 'warning' ? 'orangered' : 'arcoblue'" size="small">
                {{ item.severity === 'critical' ? '严重' : item.severity === 'warning' ? '警告' : '提示' }}
              </a-tag>
              <span class="ml-2">{{ item.message }}</span>
            </a-list-item>
          </template>
        </a-list>
      </div>

      <div v-if="qualityReport.autoTags.length" class="qr-result-tags">
        <h3>AI 自动标签</h3>
        <div class="flex flex-wrap gap-2">
          <a-tag v-for="tag in qualityReport.autoTags" :key="tag" color="arcoblue">{{ tag }}</a-tag>
        </div>
      </div>

      <div v-if="qualityReport.grade === 'C'" class="qr-result-warning">
        <a-alert type="warning" :closable="false">
          模板等级为 C 级，需要管理员审核后才能公开发布。建议根据上方问题点优化模板。
        </a-alert>
      </div>

      <div class="flex gap-3 mt-6">
        <a-button @click="resetForm">继续上传</a-button>
        <a-button type="primary" @click="viewDetail">查看模板详情</a-button>
        <a-button type="outline" @click="viewQualityReport">查看完整报告</a-button>
      </div>
    </div>

    <div v-else>
      <a-steps :current="currentStep" changeable @change="currentStep = $event" class="mb-8">
        <a-step description="基本信息">基本信息</a-step>
        <a-step description="尺寸与图片">尺寸与图片</a-step>
        <a-step description="适配区域与标签">适配区域与标签</a-step>
      </a-steps>

      <div class="step-content">
        <div v-if="currentStep === 1">
          <a-form :model="form" layout="vertical">
            <a-form-item label="模板名称" required>
              <a-input v-model="form.name" placeholder="输入模板名称" />
            </a-form-item>
            <a-form-item label="分类" required>
              <a-select v-model="form.category" placeholder="选择分类">
                <a-option value="poster">海报</a-option>
                <a-option value="phone">手机</a-option>
                <a-option value="computer">电脑</a-option>
                <a-option value="packaging">包装</a-option>
              </a-select>
            </a-form-item>
            <a-form-item label="描述">
              <a-textarea v-model="form.description" placeholder="模板描述（建议10字以上）" :auto-size="{ minRows: 3 }" />
            </a-form-item>
          </a-form>
        </div>

        <div v-if="currentStep === 2">
          <a-form :model="form" layout="vertical">
            <div class="flex gap-4">
              <a-form-item label="宽度" class="flex-1">
                <a-input-number v-model="form.width" :min="100" :max="8000" placeholder="宽度(px)" />
              </a-form-item>
              <a-form-item label="高度" class="flex-1">
                <a-input-number v-model="form.height" :min="100" :max="8000" placeholder="高度(px)" />
              </a-form-item>
            </div>
            <div class="flex gap-2 mb-4">
              <a-tag
                v-for="preset in sizePresets"
                :key="preset.label"
                class="cursor-pointer"
                :color="form.width === preset.w && form.height === preset.h ? 'arcoblue' : undefined"
                @click="form.width = preset.w; form.height = preset.h"
              >
                {{ preset.label }}
              </a-tag>
            </div>
            <a-form-item label="模板图片" required>
              <a-upload
                :auto-upload="false"
                :limit="1"
                list-type="picture-card"
                accept="image/*"
                @change="onImageChange"
                :fileList="fileList"
                :draggable="true"
              />
            </a-form-item>
          </a-form>
        </div>

        <div v-if="currentStep === 3">
          <a-form :model="form" layout="vertical">
            <div class="fit-region-grid">
              <a-form-item label="X">
                <a-input-number v-model="form.fitX" :min="0" />
              </a-form-item>
              <a-form-item label="Y">
                <a-input-number v-model="form.fitY" :min="0" />
              </a-form-item>
              <a-form-item label="宽度">
                <a-input-number v-model="form.fitWidth" :min="10" />
              </a-form-item>
              <a-form-item label="高度">
                <a-input-number v-model="form.fitHeight" :min="10" />
              </a-form-item>
            </div>
            <div
              v-if="imagePreview"
              class="fit-preview"
            >
              <img :src="imagePreview" alt="preview" />
              <div
                class="fit-region-box"
                :style="{
                  left: (form.fitX / form.width * 100) + '%',
                  top: (form.fitY / form.height * 100) + '%',
                  width: (form.fitWidth / form.width * 100) + '%',
                  height: (form.fitHeight / form.height * 100) + '%',
                }"
              />
            </div>
            <a-form-item label="标签（建议≥3个）" class="mt-4">
              <a-input-tag v-model="form.tags" placeholder="添加标签后按回车" />
            </a-form-item>
            <a-form-item label="权限">
              <a-radio-group v-model="form.permission">
                <a-radio value="public">公开</a-radio>
                <a-radio value="private">私有</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-form>
        </div>
      </div>

      <div class="flex justify-between mt-6">
        <a-button v-if="currentStep > 1" @click="currentStep--">上一步</a-button>
        <div v-else />
        <a-button v-if="currentStep < 3" type="primary" @click="currentStep++">下一步</a-button>
        <a-button v-else type="primary" :loading="submitting" @click="onSubmit">提交模板</a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useTemplateStore } from '@/stores/template'
import { Message } from '@arco-design/web-vue'
import type { FileItem } from '@arco-design/web-vue'

interface QualityReport {
  fitRegionScore: number
  imageQualityScore: number
  metadataScore: number
  accessibilityScore: number
  totalScore: number
  grade: 'S' | 'A' | 'B' | 'C'
  issues: any[]
  suggestions: any[]
  autoTags: string[]
}

const router = useRouter()
const store = useTemplateStore()
const currentStep = ref(1)
const submitting = ref(false)
const fileList = ref<FileItem[]>([])
const imagePreview = ref<string | null>(null)
const imageFile = ref<File | null>(null)
const qualityReport = ref<QualityReport | null>(null)
const createdTemplateId = ref<number | null>(null)

const sizePresets = [
  { label: '1080×1920', w: 1080, h: 1920 },
  { label: '1920×1080', w: 1920, h: 1080 },
  { label: '1080×1080', w: 1080, h: 1080 },
  { label: '750×1334', w: 750, h: 1334 },
  { label: '1440×900', w: 1440, h: 900 },
]

const form = reactive({
  name: '',
  category: '',
  description: '',
  width: 1080,
  height: 1920,
  fitX: 100,
  fitY: 200,
  fitWidth: 880,
  fitHeight: 1400,
  tags: [] as string[],
  permission: 'public',
})

function getScoreColor(score: number): string {
  if (score >= 90) return '#00b42a'
  if (score >= 75) return '#165dff'
  if (score >= 60) return '#ff7d00'
  return '#f53f3f'
}

function onImageChange(fileItemList: FileItem[]) {
  fileList.value = fileItemList
  if (fileItemList.length > 0 && fileItemList[0].file) {
    imageFile.value = fileItemList[0].file
    const reader = new FileReader()
    reader.onload = (e) => {
      imagePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(fileItemList[0].file)
  } else {
    imageFile.value = null
    imagePreview.value = null
  }
}

async function onSubmit() {
  if (!form.name || !form.category) {
    Message.warning('请填写必要信息')
    return
  }
  if (!imageFile.value) {
    Message.warning('请上传模板图片')
    return
  }
  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('name', form.name)
    fd.append('category', form.category)
    fd.append('description', form.description)
    fd.append('width', String(form.width))
    fd.append('height', String(form.height))
    fd.append('fit_x', String(form.fitX))
    fd.append('fit_y', String(form.fitY))
    fd.append('fit_width', String(form.fitWidth))
    fd.append('fit_height', String(form.fitHeight))
    fd.append('tags', JSON.stringify(form.tags))
    fd.append('permission', form.permission)
    fd.append('image', imageFile.value)
    const result = await store.createTemplate(fd) as any
    createdTemplateId.value = result.id
    if (result.qualityReport) {
      qualityReport.value = result.qualityReport
    } else {
      Message.success('模板创建成功')
      router.push('/')
    }
  } catch (e: any) {
    Message.error(e.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  qualityReport.value = null
  createdTemplateId.value = null
  form.name = ''
  form.category = ''
  form.description = ''
  form.width = 1080
  form.height = 1920
  form.fitX = 100
  form.fitY = 200
  form.fitWidth = 880
  form.fitHeight = 1400
  form.tags = []
  form.permission = 'public'
  fileList.value = []
  imageFile.value = null
  imagePreview.value = null
  currentStep.value = 1
}

function viewDetail() {
  if (createdTemplateId.value) {
    router.push(`/template/${createdTemplateId.value}`)
  }
}

function viewQualityReport() {
  if (createdTemplateId.value) {
    router.push(`/template/${createdTemplateId.value}/quality`)
  }
}
</script>

<style scoped>
.fit-region-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.fit-preview {
  position: relative;
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--color-border);
}
.fit-preview img {
  width: 100%;
  display: block;
}
.fit-region-box {
  position: absolute;
  border: 2px dashed #007AFF;
  background: rgba(0, 122, 255, 0.1);
  border-radius: 2px;
}
.qr-result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.qr-result-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}
.qr-result-grade {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}
.qr-result-grade.grade-S { border-color: #00b42a; background: rgba(0, 180, 42, 0.06); }
.qr-result-grade.grade-A { border-color: #165dff; background: rgba(22, 93, 255, 0.06); }
.qr-result-grade.grade-B { border-color: #ff7d00; background: rgba(255, 125, 0, 0.06); }
.qr-result-grade.grade-C { border-color: #f53f3f; background: rgba(245, 63, 63, 0.06); }
.qr-result-grade-label {
  font-size: 24px;
  font-weight: 800;
}
.grade-S .qr-result-grade-label { color: #00b42a; }
.grade-A .qr-result-grade-label { color: #165dff; }
.grade-B .qr-result-grade-label { color: #ff7d00; }
.grade-C .qr-result-grade-label { color: #f53f3f; }
.qr-result-grade-score {
  font-size: 14px;
  color: var(--color-text-2);
}
.qr-result-scores {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}
.qr-result-score-item {
  display: flex;
  align-items: center;
  gap: 12px;
}
.qr-result-score-item .label {
  min-width: 70px;
  font-size: 13px;
  color: var(--color-text-2);
}
.qr-result-score-item :deep(.arco-progress) {
  flex: 1;
}
.qr-result-issues {
  margin-bottom: 20px;
}
.qr-result-issues h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 10px;
}
.qr-result-tags {
  margin-bottom: 20px;
}
.qr-result-tags h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 10px;
}
.qr-result-warning {
  margin-bottom: 16px;
}
.ml-2 {
  margin-left: 8px;
}
</style>
