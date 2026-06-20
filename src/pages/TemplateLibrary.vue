<template>
  <div class="p-6">
    <div class="flex items-center gap-4 mb-6">
      <a-tabs :active-key="store.filters.category || 'all'" @change="onCategoryChange" type="rounded">
        <a-tab-pane key="all" title="全部" />
        <a-tab-pane key="poster" title="海报" />
        <a-tab-pane key="phone" title="手机" />
        <a-tab-pane key="computer" title="电脑" />
        <a-tab-pane key="packaging" title="包装" />
      </a-tabs>
      <div class="flex-1" />
      <a-input-search
        v-model="store.filters.keyword"
        placeholder="搜索模板..."
        style="width: 240px"
        @search="onSearch"
        allow-clear
      />
    </div>

    <div v-if="store.loading" class="grid grid-cols-3 gap-4">
      <a-skeleton v-for="i in 6" :key="i" animation>
        <a-skeleton-shape style="width: 100%; height: 200px; border-radius: 12px" />
        <a-skeleton-line :rows="2" />
      </a-skeleton>
    </div>

    <div v-else class="grid grid-cols-3 gap-4">
      <div
        v-for="tpl in store.templates"
        :key="tpl.id"
        class="template-card"
        @click="$router.push(`/generator/${tpl.id}`)"
      >
        <div class="card-thumb">
          <img :src="tpl.imageUrl" :alt="tpl.name" />
          <div class="card-overlay">
            <a-button type="primary" size="small">使用模板</a-button>
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

    <div v-if="!store.loading && store.templates.length === 0" class="py-20">
      <a-empty description="暂无模板" />
    </div>

    <div class="flex justify-center mt-6">
      <a-pagination
        v-model:current="store.filters.page"
        :total="store.total"
        :page-size="store.filters.pageSize"
        @change="onPageChange"
        show-total
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useTemplateStore } from '@/stores/template'
import { getCategoryLabel } from '@/constants'

const store = useTemplateStore()

onMounted(() => {
  store.fetchTemplates()
})

function onCategoryChange(key: string) {
  store.filters.category = key === 'all' ? '' : key
  store.filters.page = 1
  store.fetchTemplates()
}

function onSearch() {
  store.filters.page = 1
  store.fetchTemplates()
}

function onPageChange(page: number) {
  store.filters.page = page
  store.fetchTemplates()
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
.card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
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
