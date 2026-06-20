<template>
  <div class="version-manager">
    <div class="vm-header">
      <div class="section-title">版本管理</div>
      <a-tooltip :content="canEdit ? '' : '您没有权限编辑此模板'" placement="top">
        <a-button
          type="primary"
          size="small"
          @click="onCreateNewVersion"
          :disabled="!canEdit"
        >
          保存为新版本
        </a-button>
      </a-tooltip>
    </div>

    <a-spin :loading="templateStore.versionsLoading" dot>
      <div v-if="templateStore.versions.length === 0" class="vm-empty">
        <a-empty description="暂无版本记录" />
      </div>
      <div v-else class="vm-list">
        <div
          v-for="v in templateStore.versions"
          :key="v.id"
          class="vm-item"
          :class="{
            'vm-item-stable': v.isStable,
            'vm-item-active': templateStore.activeVersion?.id === v.id,
          }"
        >
          <div class="vm-item-thumb">
            <img :src="v.imageUrl" :alt="v.name" />
            <div v-if="v.isStable" class="vm-stable-badge">稳定版</div>
          </div>
          <div class="vm-item-info">
            <div class="vm-item-head">
              <span class="vm-version-label">{{ v.versionLabel }}</span>
              <a-tag v-if="v.isStable" color="green" size="small">稳定版</a-tag>
            </div>
            <div class="vm-item-name">{{ v.name }}</div>
            <div class="vm-item-meta">
              {{ v.width }}×{{ v.height }} · {{ formatDate(v.createdAt) }}
            </div>
            <div v-if="v.description" class="vm-item-desc">{{ v.description }}</div>
          </div>
          <div class="vm-item-actions">
            <a-button
              v-if="canEdit && !v.isStable"
              size="mini"
              type="outline"
              status="success"
              @click.stop="onSetStable(v)"
            >
              设为稳定版
            </a-button>
            <a-button
              size="mini"
              type="outline"
              @click.stop="onSelectVersion(v)"
            >
              使用此版本
            </a-button>
            <a-button
              v-if="canEdit"
              size="mini"
              type="outline"
              status="warning"
              @click.stop="onToggleCompare(v)"
            >
              {{ isInCompareSet(v.id) ? '取消对比' : '对比' }}
            </a-button>
            <a-button
              v-if="canEdit && templateStore.versions[0]?.id !== v.id"
              size="mini"
              type="outline"
              status="danger"
              @click.stop="onRollback(v)"
            >
              回滚
            </a-button>
          </div>
        </div>
      </div>
    </a-spin>

    <div v-if="compareSet.size === 2" class="vm-compare-bar">
      <span>已选择 2 个版本进行对比</span>
      <a-button size="small" type="primary" @click="onDoCompare">
        开始对比
      </a-button>
      <a-button size="small" @click="clearCompare">
        清除
      </a-button>
    </div>

    <a-modal
      v-model:visible="createVisible"
      title="保存为新版本"
      @ok="onSubmitNewVersion"
      @cancel="createVisible = false"
      :confirm-loading="creating"
      width="520px"
    >
      <a-form :model="versionForm" layout="vertical">
        <a-form-item label="版本描述">
          <a-textarea
            v-model="versionForm.description"
            placeholder="描述本次更新的内容..."
            :auto-size="{ minRows: 3, maxRows: 6 }"
          />
        </a-form-item>
        <a-divider style="margin: 12px 0">可选：覆盖模板信息</a-divider>
        <a-form-item label="模板名称">
          <a-input v-model="versionForm.name" :placeholder="currentTemplate?.name" />
        </a-form-item>
        <div class="grid grid-cols-2 gap-3">
          <a-form-item label="宽度 (px)">
            <a-input-number v-model="versionForm.width" :min="100" style="width: 100%" />
          </a-form-item>
          <a-form-item label="高度 (px)">
            <a-input-number v-model="versionForm.height" :min="100" style="width: 100%" />
          </a-form-item>
        </div>
        <a-divider style="margin: 12px 0">贴合区域</a-divider>
        <div class="grid grid-cols-2 gap-3">
          <a-form-item label="X">
            <a-input-number v-model="versionForm.fitX" :min="0" style="width: 100%" />
          </a-form-item>
          <a-form-item label="Y">
            <a-input-number v-model="versionForm.fitY" :min="0" style="width: 100%" />
          </a-form-item>
          <a-form-item label="宽度">
            <a-input-number v-model="versionForm.fitWidth" :min="10" style="width: 100%" />
          </a-form-item>
          <a-form-item label="高度">
            <a-input-number v-model="versionForm.fitHeight" :min="10" style="width: 100%" />
          </a-form-item>
        </div>
        <a-form-item label="替换模板图片">
          <a-upload
            :auto-upload="false"
            :limit="1"
            list-type="picture-card"
            accept="image/*"
            @change="onImageChange"
            :fileList="fileList"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:visible="rollbackVisible"
      title="确认回滚"
      @ok="doRollback"
      @cancel="rollbackVisible = false"
      ok-text="确认回滚"
      :ok-button-props="{ status: 'danger' }"
    >
      <div v-if="rollbackTarget">
        <p>确定要将模板回滚到版本 <b>{{ rollbackTarget.versionLabel }}</b> 吗？</p>
        <p class="text-secondary text-sm mt-2">
          回滚会将当前模板的内容（名称、尺寸、贴合区域、图片等）替换为该版本的数据，
          但不会删除任何版本记录。
        </p>
        <div class="rollback-preview mt-4">
          <img :src="rollbackTarget.imageUrl" :alt="rollbackTarget.name" />
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useTemplateStore, type Template, type TemplateVersion } from '@/stores/template'
import { Message, Modal } from '@arco-design/web-vue'
import type { FileItem } from '@arco-design/web-vue'

const props = defineProps<{
  templateId: number
  currentTemplate: Template | null
  canEdit?: boolean
}>()

const emit = defineEmits<{
  (e: 'select-version', version: TemplateVersion): void
}>()

const templateStore = useTemplateStore()
const createVisible = ref(false)
const creating = ref(false)
const rollbackVisible = ref(false)
const rollbackTarget = ref<TemplateVersion | null>(null)
const compareSet = ref<Set<number>>(new Set())
const fileList = ref<FileItem[]>([])
const imageFile = ref<File | null>(null)

const versionForm = reactive({
  description: '',
  name: '',
  width: undefined as number | undefined,
  height: undefined as number | undefined,
  fitX: undefined as number | undefined,
  fitY: undefined as number | undefined,
  fitWidth: undefined as number | undefined,
  fitHeight: undefined as number | undefined,
})

watch(() => props.templateId, (id) => {
  if (id) {
    templateStore.fetchVersions(id)
    templateStore.fetchStableVersion(id)
  }
}, { immediate: true })

watch(() => props.currentTemplate, (tpl) => {
  if (tpl) {
    versionForm.name = tpl.name
    versionForm.width = tpl.width
    versionForm.height = tpl.height
    versionForm.fitX = tpl.fitRegion.x
    versionForm.fitY = tpl.fitRegion.y
    versionForm.fitWidth = tpl.fitRegion.width
    versionForm.fitHeight = tpl.fitRegion.height
  }
}, { immediate: true, deep: true })

function formatDate(d: string) {
  const date = new Date(d)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function onCreateNewVersion() {
  createVisible.value = true
}

function onImageChange(fileItemList: FileItem[]) {
  fileList.value = fileItemList
  if (fileItemList.length > 0 && fileItemList[0].file) {
    imageFile.value = fileItemList[0].file
  } else {
    imageFile.value = null
  }
}

async function onSubmitNewVersion() {
  if (!props.templateId) return
  creating.value = true
  try {
    const fd = new FormData()
    if (versionForm.description) fd.append('description', versionForm.description)
    if (versionForm.name) fd.append('name', versionForm.name)
    if (versionForm.width !== undefined) fd.append('width', String(versionForm.width))
    if (versionForm.height !== undefined) fd.append('height', String(versionForm.height))
    if (versionForm.fitX !== undefined) fd.append('fit_x', String(versionForm.fitX))
    if (versionForm.fitY !== undefined) fd.append('fit_y', String(versionForm.fitY))
    if (versionForm.fitWidth !== undefined) fd.append('fit_width', String(versionForm.fitWidth))
    if (versionForm.fitHeight !== undefined) fd.append('fit_height', String(versionForm.fitHeight))
    if (imageFile.value) fd.append('image', imageFile.value)

    const v = await templateStore.createVersion(props.templateId, fd)
    Message.success(`版本 ${v.versionLabel} 创建成功`)
    createVisible.value = false
    versionForm.description = ''
    fileList.value = []
    imageFile.value = null
  } catch (e: any) {
    Message.error(e.message || '创建版本失败')
  } finally {
    creating.value = false
  }
}

function onSelectVersion(v: TemplateVersion) {
  templateStore.activeVersion = v
  emit('select-version', v)
  Message.info(`已切换到 ${v.versionLabel}`)
}

async function onSetStable(v: TemplateVersion) {
  if (!props.templateId) return
  Modal.confirm({
    title: '设置稳定版',
    content: `确定将版本 ${v.versionLabel} 设置为稳定版吗？用户默认会使用最新稳定版。`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      try {
        await templateStore.setStableVersion(props.templateId, v.id)
        Message.success(`已将 ${v.versionLabel} 设为稳定版`)
      } catch (e: any) {
        Message.error(e.message || '设置失败')
      }
    },
  })
}

function onToggleCompare(v: TemplateVersion) {
  const id = v.id
  if (compareSet.value.has(id)) {
    compareSet.value.delete(id)
  } else {
    if (compareSet.value.size >= 2) {
      Message.warning('最多只能选择 2 个版本进行对比')
      return
    }
    compareSet.value.add(id)
  }
  compareSet.value = new Set(compareSet.value)
}

function isInCompareSet(id: number) {
  return compareSet.value.has(id)
}

function clearCompare() {
  compareSet.value.clear()
  templateStore.clearCompareResult()
}

async function onDoCompare() {
  if (!props.templateId || compareSet.value.size !== 2) return
  const ids = Array.from(compareSet.value)
  try {
    await templateStore.compareVersions(props.templateId, ids[0], ids[1])
  } catch (e: any) {
    Message.error(e.message || '对比失败')
  }
}

function onRollback(v: TemplateVersion) {
  rollbackTarget.value = v
  rollbackVisible.value = true
}

async function doRollback() {
  if (!props.templateId || !rollbackTarget.value) return
  try {
    await templateStore.rollbackToVersion(props.templateId, rollbackTarget.value.id)
    Message.success(`已回滚到 ${rollbackTarget.value.versionLabel}`)
    rollbackVisible.value = false
    rollbackTarget.value = null
  } catch (e: any) {
    Message.error(e.message || '回滚失败')
  }
}
</script>

<style scoped>
.version-manager {
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  padding: 16px;
}
.vm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.vm-empty {
  padding: 24px 0;
}
.vm-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 520px;
  overflow-y: auto;
}
.vm-item {
  display: flex;
  gap: 12px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-fill-1);
  transition: all 0.15s;
}
.vm-item:hover {
  border-color: rgba(0, 122, 255, 0.4);
}
.vm-item-stable {
  border-color: rgba(0, 180, 42, 0.4);
  background: rgba(0, 180, 42, 0.04);
}
.vm-item-active {
  border-color: var(--color-primary);
  background: rgba(0, 122, 255, 0.06);
}
.vm-item-thumb {
  position: relative;
  width: 80px;
  height: 80px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
}
.vm-item-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.vm-stable-badge {
  position: absolute;
  top: 2px;
  left: 2px;
  background: #00b42a;
  color: #fff;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
}
.vm-item-info {
  flex: 1;
  min-width: 0;
}
.vm-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}
.vm-version-label {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text);
}
.vm-item-name {
  font-size: 13px;
  color: var(--color-text);
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vm-item-meta {
  font-size: 11px;
  color: var(--color-text-3);
}
.vm-item-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
  line-height: 1.4;
}
.vm-item-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 110px;
  flex-shrink: 0;
}
.vm-compare-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(0, 122, 255, 0.08);
  border: 1px solid rgba(0, 122, 255, 0.3);
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.rollback-preview {
  width: 120px;
  height: 120px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--color-border);
}
.rollback-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.text-secondary {
  color: var(--color-text-secondary);
}
.text-sm {
  font-size: 12px;
}
.mt-2 {
  margin-top: 8px;
}
.mt-4 {
  margin-top: 16px;
}
.grid {
  display: grid;
}
.grid-cols-2 {
  grid-template-columns: repeat(2, 1fr);
}
.gap-3 {
  gap: 12px;
}
</style>
