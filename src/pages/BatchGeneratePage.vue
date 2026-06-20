<template>
  <div class="p-6 max-w-5xl mx-auto">
    <h2 class="text-lg font-semibold mb-4">批量生成样机</h2>

    <div class="batch-section">
      <div class="section-label">选择模板（可多选）</div>
      <div v-if="templateStore.loading" class="grid grid-cols-6 gap-3">
        <a-skeleton v-for="i in 6" :key="i" animation>
          <a-skeleton-shape style="width: 100%; height: 60px" />
        </a-skeleton>
      </div>
      <div v-else class="grid grid-cols-6 gap-3">
        <div
          v-for="tpl in templateStore.templates"
          :key="tpl.id"
          class="batch-tpl-item"
          :class="{ selected: mockupStore.batchItems.includes(tpl.id) }"
          @click="toggleTemplate(tpl.id)"
        >
          <img :src="tpl.imageUrl" :alt="tpl.name" />
          <a-checkbox
            :model-value="mockupStore.batchItems.includes(tpl.id)"
            class="batch-check"
          />
          <div class="batch-tpl-name">{{ tpl.name }}</div>
        </div>
      </div>
    </div>

    <div class="batch-section">
      <div class="section-label">上传设计图（支持多个文件）</div>
      <a-upload
        :auto-upload="false"
        accept="image/*"
        multiple
        :draggable="true"
        :fileList="designFileList"
        @change="onDesignChange"
      >
        <template #upload-button>
          <div class="upload-area">
            点击或拖拽上传多个设计图
          </div>
        </template>
      </a-upload>
    </div>

    <div class="batch-section">
      <div class="section-label">导出设置</div>
      <div class="flex gap-4">
        <div>
          <div class="field-label">格式</div>
          <a-radio-group v-model="mockupStore.exportSettings.format" type="button" size="small">
            <a-radio value="png">PNG</a-radio>
            <a-radio value="jpeg">JPEG</a-radio>
            <a-radio value="webp">WebP</a-radio>
          </a-radio-group>
        </div>
        <div>
          <div class="field-label">分辨率</div>
          <a-radio-group v-model="mockupStore.exportSettings.width" type="button" size="small">
            <a-radio :value="1">1x</a-radio>
            <a-radio :value="2">2x</a-radio>
            <a-radio :value="3">3x</a-radio>
          </a-radio-group>
        </div>
      </div>
    </div>

    <a-button
      type="primary"
      size="large"
      :loading="mockupStore.generating"
      :disabled="mockupStore.batchItems.length === 0 || designFiles.length === 0"
      @click="onBatchGenerate"
    >
      批量生成
    </a-button>

    <div v-if="mockupStore.batchResults.length > 0" class="mt-6">
      <div class="section-label">生成结果</div>
      <div class="space-y-2">
        <div
          v-for="(item, i) in mockupStore.batchResults"
          :key="i"
          class="batch-result-item"
        >
          <span>模板 #{{ item.templateId }}</span>
          <a-tag :color="item.status === 'done' ? 'green' : 'orangered'" size="small">
            {{ item.status === 'done' ? '完成' : item.status }}
          </a-tag>
          <a-button
            v-if="item.resultUrl"
            size="mini"
            type="text"
            @click="downloadFile(item.resultUrl!)"
          >
            下载
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTemplateStore } from '@/stores/template'
import { useMockupStore } from '@/stores/mockup'
import { Message } from '@arco-design/web-vue'
import type { FileItem } from '@arco-design/web-vue'

const templateStore = useTemplateStore()
const mockupStore = useMockupStore()
const designFileList = ref<FileItem[]>([])
const designFiles = ref<File[]>([])

onMounted(() => {
  templateStore.fetchTemplates()
})

function toggleTemplate(id: number) {
  const idx = mockupStore.batchItems.indexOf(id)
  if (idx >= 0) {
    mockupStore.batchItems.splice(idx, 1)
  } else {
    mockupStore.batchItems.push(id)
  }
}

function onDesignChange(fileItemList: FileItem[]) {
  designFileList.value = fileItemList
  designFiles.value = fileItemList.filter(f => f.file).map(f => f.file!)
}

async function onBatchGenerate() {
  try {
    await mockupStore.batchGenerate(designFiles.value)
    Message.success('批量生成完成')
  } catch (e: any) {
    Message.error(e.message || '批量生成失败')
  }
}

function downloadFile(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = `batch-mockup-${Date.now()}.${mockupStore.exportSettings.format}`
  a.click()
}
</script>

<style scoped>
.batch-section {
  margin-bottom: 24px;
}
.section-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}
.batch-tpl-item {
  position: relative;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 2px solid var(--color-border);
  cursor: pointer;
  transition: border-color 0.15s ease;
  background: var(--color-bg);
}
.batch-tpl-item.selected {
  border-color: var(--color-primary);
}
.batch-tpl-item img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}
.batch-check {
  position: absolute;
  top: 4px;
  right: 4px;
}
.batch-tpl-name {
  font-size: 11px;
  padding: 4px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.upload-area {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.upload-area:hover {
  border-color: var(--color-primary);
}
.field-label {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}
.batch-result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: 13px;
}
</style>
