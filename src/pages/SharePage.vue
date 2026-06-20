<template>
  <div class="share-page">
    <div v-if="loading" class="share-card">
      <a-skeleton animation>
        <a-skeleton-shape style="width: 100%; height: 300px" />
        <a-skeleton-line :rows="3" />
      </a-skeleton>
    </div>

    <div v-else-if="template" class="share-card">
      <div class="share-preview">
        <img :src="template.imageUrl" :alt="template.name" />
      </div>
      <div class="share-info">
        <h1 class="share-name">{{ template.name }}</h1>
        <div class="flex items-center gap-2 mb-4">
          <a-tag size="small" color="arcoblue">{{ template.category }}</a-tag>
          <span class="share-meta">{{ template.useCount }} 次使用</span>
        </div>
        <p v-if="template.description" class="share-desc">{{ template.description }}</p>
        <div v-if="template.tags?.length" class="flex gap-1 flex-wrap mb-4">
          <a-tag v-for="tag in template.tags" :key="tag" size="small">{{ tag }}</a-tag>
        </div>
        <a-button type="primary" size="large" long @click="onUse">
          使用此模板生成样机
        </a-button>
      </div>
    </div>

    <div v-else class="share-card">
      <a-empty description="模板不存在或链接已失效" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { get } from '@/utils/api'
import type { Template } from '@/stores/template'

const route = useRoute()
const router = useRouter()
const template = ref<Template | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const token = route.params.token as string
    const res = await get<Template>(`/templates/share/${token}`)
    template.value = res
  } catch {
    template.value = null
  } finally {
    loading.value = false
  }
})

function onUse() {
  if (!template.value) return
  router.push(`/generator/${template.value.id}`)
}
</script>

<style scoped>
.share-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  padding: 40px 20px;
}
.share-card {
  width: 480px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
.share-preview {
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--color-bg-secondary);
}
.share-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.share-info {
  padding: 24px;
}
.share-name {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--color-text);
}
.share-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.share-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0 0 12px;
  line-height: 1.6;
}
</style>
