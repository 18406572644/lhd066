<template>
  <div class="p-6">
    <div class="flex items-center gap-4 mb-6">
      <a-tabs :active-key="templateStore.filters.category || 'all'" @change="onCategoryChange" type="rounded">
        <a-tab-pane key="all" title="全部" />
        <a-tab-pane key="poster" title="海报" />
        <a-tab-pane key="phone" title="手机" />
        <a-tab-pane key="computer" title="电脑" />
        <a-tab-pane key="packaging" title="包装" />
      </a-tabs>
      <div class="flex-1" />
      <a-input-search
        v-model="templateStore.filters.keyword"
        placeholder="搜索模板..."
        style="width: 240px"
        @search="onSearch"
        allow-clear
      />
    </div>

    <div v-if="templateStore.loading" class="grid grid-cols-3 gap-4">
      <a-skeleton v-for="i in 6" :key="i" animation>
        <a-skeleton-shape style="width: 100%; height: 200px; border-radius: 12px" />
        <a-skeleton-line :rows="2" />
      </a-skeleton>
    </div>

    <div v-else class="grid grid-cols-3 gap-4">
      <div
        v-for="tpl in templateStore.templates"
        :key="tpl.id"
        class="template-card"
        @click="$router.push(`/template/${tpl.id}`)"
      >
        <div class="card-thumb">
          <img :src="tpl.imageUrl" :alt="tpl.name" />
          <div class="card-badges">
            <div v-if="getStableVersionLabel(tpl.id)" class="card-stable">
              <icon-check /> {{ getStableVersionLabel(tpl.id) }}
            </div>
            <div v-if="tpl.qualityGrade" class="card-quality" :class="'grade-' + tpl.qualityGrade">
              {{ tpl.qualityGrade }}级
            </div>
          </div>
          <div class="card-overlay">
            <a-button type="primary" size="small" @click.stop="$router.push(`/template/${tpl.id}`)">
              查看详情
            </a-button>
            <a-button size="small" status="success" @click.stop="$router.push(`/generator/${tpl.id}`)">
              立即使用
            </a-button>
          </div>
        </div>
        <div class="card-info">
          <div class="card-name">{{ tpl.name }}</div>
          <div class="flex items-center gap-2">
            <a-tag size="small" color="arcoblue">{{ getCategoryLabel(tpl.category) }}</a-tag>
            <span class="card-meta">{{ tpl.useCount }} 次使用</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!templateStore.loading && templateStore.templates.length === 0" class="py-20">
      <a-empty description="暂无模板" />
    </div>

    <div class="flex justify-center mt-6">
      <a-pagination
        v-model:current="templateStore.filters.page"
        :total="templateStore.total"
        :page-size="templateStore.filters.pageSize"
        @change="onPageChange"
        show-total
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch, ref } from 'vue'
import { useTemplateStore } from '@/stores/template'
import { getCategoryLabel } from '@/constants'
import { IconCheck } from '@arco-design/web-vue/es/icon'

const templateStore = useTemplateStore()
const stableLabelMap = ref<Record<number, string>>({})

onMounted(async () => {
  await templateStore.fetchTemplates()
})

watch(() => templateStore.templates, async (tpls) => {
  const newMap: Record<number, string> = {}
  for (const tpl of tpls) {
    try {
      const stable = await templateStore.fetchStableVersion(tpl.id)
      if (stable) newMap[tpl.id] = stable.versionLabel
    } catch {}
  }
  stableLabelMap.value = newMap
}, { immediate: true })

function getStableVersionLabel(id: number) {
  return stableLabelMap.value[id] || null
}

function onCategoryChange(key: string) {
  templateStore.filters.category = key === 'all' ? '' : key
  templateStore.filters.page = 1
  templateStore.fetchTemplates()
}

function onSearch() {
  templateStore.filters.page = 1
  templateStore.fetchTemplates()
}

function onPageChange(page: number) {
  templateStore.filters.page = page
  templateStore.fetchTemplates()
}
</script>

<style scoped>
.template-card {
  background: var(--color-bg);
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.15s ease;
  border: 1px solid var(--color-border);
}
.template-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}
.card-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: var(--color-bg-secondary);
}
.card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card-badges {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 6px;
  z-index: 2;
}
.card-stable {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 180, 42, 0.92);
  color: #fff;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 600;
  backdrop-filter: blur(4px);
}
.card-quality {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
}
.card-quality.grade-S {
  background: rgba(0, 180, 42, 0.92);
  color: #fff;
}
.card-quality.grade-A {
  background: rgba(22, 93, 255, 0.92);
  color: #fff;
}
.card-quality.grade-B {
  background: rgba(255, 125, 0, 0.92);
  color: #fff;
}
.card-quality.grade-C {
  background: rgba(245, 63, 63, 0.92);
  color: #fff;
}
.card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 3;
}
.template-card:hover .card-overlay {
  opacity: 1;
}
.card-info {
  padding: 12px 16px;
}
.card-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--color-text);
}
.card-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
}
</style>
