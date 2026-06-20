<template>
  <div class="p-6 max-w-3xl mx-auto">
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
            <a-textarea v-model="form.description" placeholder="模板描述" :auto-size="{ minRows: 3 }" />
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
          <a-form-item label="标签" class="mt-4">
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
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useTemplateStore } from '@/stores/template'
import { Message } from '@arco-design/web-vue'
import type { FileItem } from '@arco-design/web-vue'

const router = useRouter()
const store = useTemplateStore()
const currentStep = ref(1)
const submitting = ref(false)
const fileList = ref<FileItem[]>([])
const imagePreview = ref<string | null>(null)
const imageFile = ref<File | null>(null)

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
    await store.createTemplate(fd)
    Message.success('模板创建成功')
    router.push('/')
  } catch (e: any) {
    Message.error(e.message || '创建失败')
  } finally {
    submitting.value = false
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
</style>
