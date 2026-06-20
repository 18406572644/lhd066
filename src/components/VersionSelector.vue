<template>
  <div class="version-selector">
    <a-select
      :model-value="selectedVersionId"
      :loading="templateStore.versionsLoading"
      placeholder="选择版本"
      style="width: 100%"
      @change="onChange"
    >
      <a-option
        v-for="v in options"
        :key="v.id"
        :value="v.id"
      >
        <div class="vs-option">
          <span class="vs-label">{{ v.label }}</span>
          <a-tag v-if="v.isStable" color="green" size="mini">稳定</a-tag>
          <span class="vs-dot" v-if="v.isLatest" />
        </div>
      </a-option>
    </a-select>
    <div v-if="stableInfo" class="vs-hint">
      <template v-if="selectedIsStable">
        <icon-check-circle style="color: var(--color-success)" />
        当前为稳定版（推荐使用）
      </template>
      <template v-else>
        <span style="color: var(--color-warning); font-weight: 600;">⚠</span>
        推荐使用稳定版 <b>{{ stableInfo.label }}</b>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useTemplateStore, type TemplateVersion } from '@/stores/template'
import { IconCheckCircle } from '@arco-design/web-vue/es/icon'

const props = defineProps<{
  templateId: number
  modelValue: number | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', id: number | null): void
  (e: 'select', version: TemplateVersion): void
}>()

const templateStore = useTemplateStore()

const selectedVersionId = computed(() => props.modelValue)

const options = computed(() => {
  const latest = templateStore.versions[0]
  return templateStore.versions.map((v, idx) => ({
    id: v.id,
    label: `${v.versionLabel} · ${v.name}`,
    isStable: v.isStable,
    isLatest: idx === 0 && latest?.id === v.id,
  }))
})

const stableInfo = computed(() => {
  const v = templateStore.stableVersion
  if (!v) return null
  return { id: v.id, label: v.versionLabel }
})

const selectedIsStable = computed(() => {
  const sel = templateStore.versions.find(v => v.id === props.modelValue)
  return sel?.isStable ?? false
})

watch(() => props.templateId, (id) => {
  if (id) {
    templateStore.fetchVersions(id).then(() => {
      const stable = templateStore.stableVersion
      if (stable && !props.modelValue) {
        emit('update:modelValue', stable.id)
      }
    })
    templateStore.fetchStableVersion(id)
  }
}, { immediate: true })

function onChange(id: number) {
  emit('update:modelValue', id)
  const v = templateStore.versions.find(v => v.id === id)
  if (v) {
    templateStore.activeVersion = v
    emit('select', v)
  }
}
</script>

<style scoped>
.version-selector {
  width: 100%;
}
.vs-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}
.vs-label {
  flex: 1;
  min-width: 0;
}
.vs-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
}
.vs-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--color-text-3);
}
.vs-hint b {
  color: var(--color-text-secondary);
}
</style>
