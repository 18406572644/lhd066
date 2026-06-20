<template>
  <div class="p-6 max-w-5xl mx-auto">
    <h2 class="text-lg font-semibold mb-4">批量生成样机</h2>

    <TaskProgress
      v-if="batchTaskStore.currentProgress"
      :progress="batchTaskStore.currentProgress"
      @pause="handlePause"
      @resume="handleResume"
      @cancel="handleCancel"
      @download="downloadFile"
    />

    <template v-else>
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

      <div class="flex gap-3">
        <a-button
          type="primary"
          size="large"
          :loading="creatingTask"
          :disabled="mockupStore.batchItems.length === 0 || designFiles.length === 0"
          @click="onBatchGenerate"
        >
          批量生成
        </a-button>
        <a-button
          size="large"
          @click="goToHistory"
        >
          查看历史任务
        </a-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTemplateStore } from '@/stores/template'
import { useMockupStore } from '@/stores/mockup'
import { useBatchTaskStore } from '@/stores/batchTask'
import { upload } from '@/utils/api'
import { Message } from '@arco-design/web-vue'
import TaskProgress from '@/components/TaskProgress.vue'
import type { FileItem } from '@arco-design/web-vue'

const router = useRouter()
const templateStore = useTemplateStore()
const mockupStore = useMockupStore()
const batchTaskStore = useBatchTaskStore()
const designFileList = ref<FileItem[]>([])
const designFiles = ref<File[]>([])
const creatingTask = ref(false)

onMounted(() => {
  templateStore.fetchTemplates()
})

onUnmounted(() => {
  batchTaskStore.stopPolling()
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
  if (creatingTask.value) return

  creatingTask.value = true
  try {
    const uploadedUrls: string[] = []
    for (const file of designFiles.value) {
      const fd = new FormData()
      fd.append('image', file)
      const uploadRes = await upload<{ url: string; width: number; height: number }>('/upload/design-image', fd)
      uploadedUrls.push(uploadRes.url)
    }

    const { useTemplateStore } = await import('@/stores/template')
    const templateStore = useTemplateStore()
    const items = mockupStore.batchItems.map((templateId, i) => {
      const tpl = templateStore.templates.find(t => t.id === templateId)
      return {
        templateId,
        designImageUrl: uploadedUrls[i % uploadedUrls.length],
        exportWidth: (tpl?.width ?? 1000) * mockupStore.exportSettings.width,
        exportHeight: (tpl?.height ?? 1000) * mockupStore.exportSettings.width,
        exportFormat: mockupStore.exportSettings.format,
        offsetX: mockupStore.offset.x,
        offsetY: mockupStore.offset.y,
        scaleX: mockupStore.scale.x,
        scaleY: mockupStore.scale.y,
      }
    })

    const taskName = `批量生成 (${mockupStore.batchItems.length}个模板 × ${designFiles.value.length}个设计图)`
    const taskId = await batchTaskStore.createTask(items, taskName)
    
    Message.success('任务已创建，开始处理...')
    batchTaskStore.startPolling(taskId)
    
  } catch (e: any) {
    Message.error(e.message || '创建任务失败')
  } finally {
    creatingTask.value = false
  }
}

async function handlePause() {
  if (!batchTaskStore.currentTaskId) return
  try {
    await batchTaskStore.pauseTask(batchTaskStore.currentTaskId)
    Message.success('任务已暂停')
  } catch (e: any) {
    Message.error(e.message || '暂停失败')
  }
}

async function handleResume() {
  if (!batchTaskStore.currentTaskId) return
  try {
    await batchTaskStore.resumeTask(batchTaskStore.currentTaskId)
    Message.success('任务已恢复')
  } catch (e: any) {
    Message.error(e.message || '恢复失败')
  }
}

async function handleCancel() {
  if (!batchTaskStore.currentTaskId) return
  try {
    await batchTaskStore.cancelTask(batchTaskStore.currentTaskId)
    Message.success('任务已取消')
  } catch (e: any) {
    Message.error(e.message || '取消失败')
  }
}

function goToHistory() {
  router.push({ name: 'batch-history' })
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
