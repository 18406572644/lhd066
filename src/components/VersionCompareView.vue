<template>
  <div class="version-compare">
    <div class="vc-header">
      <div class="section-title">版本对比</div>
      <a-button size="small" @click="$emit('close')">关闭</a-button>
    </div>

    <div v-if="!compareResult" class="vc-empty">
      <a-empty description="请在左侧版本列表中选择 2 个版本进行对比" />
    </div>

    <div v-else class="vc-content">
      <div class="vc-summary" v-if="compareResult.diffs.length > 0">
        <span class="vc-summary-label">检测到差异：</span>
        <a-tag v-for="d in compareResult.diffs" :key="d" color="orangered" size="small">
          {{ getDiffLabel(d) }}
        </a-tag>
      </div>
      <div v-else class="vc-summary vc-summary-same">
        <icon-check-circle style="color: var(--color-success)" />
        两个版本完全相同
      </div>

      <div class="vc-grid">
        <div class="vc-column">
          <div class="vc-column-head">
            <div class="vc-version-badge">{{ compareResult.v1.versionLabel }}</div>
            <a-tag v-if="compareResult.v1.isStable" color="green" size="small">稳定版</a-tag>
          </div>
          <div class="vc-thumb">
            <img :src="compareResult.v1.imageUrl" :alt="compareResult.v1.name" />
            <div
              class="vc-fit-region"
              :class="{ 'vc-diff': hasDiff('fitRegion') || hasDiff('image') }"
              :style="{
                left: (compareResult.v1.fitRegion.x / compareResult.v1.width * 100) + '%',
                top: (compareResult.v1.fitRegion.y / compareResult.v1.height * 100) + '%',
                width: (compareResult.v1.fitRegion.width / compareResult.v1.width * 100) + '%',
                height: (compareResult.v1.fitRegion.height / compareResult.v1.height * 100) + '%',
              }"
            />
          </div>
          <div class="vc-props">
            <div class="vc-prop" :class="{ 'vc-diff': hasDiff('name') }">
              <div class="vc-prop-label">模板名称</div>
              <div class="vc-prop-value">{{ compareResult.v1.name }}</div>
            </div>
            <div class="vc-prop" :class="{ 'vc-diff': hasDiff('category') }">
              <div class="vc-prop-label">分类</div>
              <div class="vc-prop-value">{{ getCategoryLabel(compareResult.v1.category) }}</div>
            </div>
            <div class="vc-prop" :class="{ 'vc-diff': hasDiff('width') || hasDiff('height') }">
              <div class="vc-prop-label">尺寸</div>
              <div class="vc-prop-value">{{ compareResult.v1.width }} × {{ compareResult.v1.height }}</div>
            </div>
            <div class="vc-prop" :class="{ 'vc-diff': hasDiff('fitRegion') }">
              <div class="vc-prop-label">贴合区域</div>
              <div class="vc-prop-value">
                ({{ compareResult.v1.fitRegion.x }}, {{ compareResult.v1.fitRegion.y }})
                {{ compareResult.v1.fitRegion.width }}×{{ compareResult.v1.fitRegion.height }}
              </div>
            </div>
            <div class="vc-prop" :class="{ 'vc-diff': hasDiff('permission') }">
              <div class="vc-prop-label">权限</div>
              <div class="vc-prop-value">{{ getPermissionLabel(compareResult.v1.permission) }}</div>
            </div>
            <div class="vc-prop">
              <div class="vc-prop-label">创建时间</div>
              <div class="vc-prop-value">{{ formatDate(compareResult.v1.createdAt) }}</div>
            </div>
            <div v-if="compareResult.v1.description" class="vc-prop">
              <div class="vc-prop-label">描述</div>
              <div class="vc-prop-value">{{ compareResult.v1.description }}</div>
            </div>
          </div>
        </div>

        <div class="vc-vs">
          <span>VS</span>
        </div>

        <div class="vc-column">
          <div class="vc-column-head">
            <div class="vc-version-badge">{{ compareResult.v2.versionLabel }}</div>
            <a-tag v-if="compareResult.v2.isStable" color="green" size="small">稳定版</a-tag>
          </div>
          <div class="vc-thumb">
            <img :src="compareResult.v2.imageUrl" :alt="compareResult.v2.name" />
            <div
              class="vc-fit-region"
              :class="{ 'vc-diff': hasDiff('fitRegion') || hasDiff('image') }"
              :style="{
                left: (compareResult.v2.fitRegion.x / compareResult.v2.width * 100) + '%',
                top: (compareResult.v2.fitRegion.y / compareResult.v2.height * 100) + '%',
                width: (compareResult.v2.fitRegion.width / compareResult.v2.width * 100) + '%',
                height: (compareResult.v2.fitRegion.height / compareResult.v2.height * 100) + '%',
              }"
            />
          </div>
          <div class="vc-props">
            <div class="vc-prop" :class="{ 'vc-diff': hasDiff('name') }">
              <div class="vc-prop-label">模板名称</div>
              <div class="vc-prop-value">{{ compareResult.v2.name }}</div>
            </div>
            <div class="vc-prop" :class="{ 'vc-diff': hasDiff('category') }">
              <div class="vc-prop-label">分类</div>
              <div class="vc-prop-value">{{ getCategoryLabel(compareResult.v2.category) }}</div>
            </div>
            <div class="vc-prop" :class="{ 'vc-diff': hasDiff('width') || hasDiff('height') }">
              <div class="vc-prop-label">尺寸</div>
              <div class="vc-prop-value">{{ compareResult.v2.width }} × {{ compareResult.v2.height }}</div>
            </div>
            <div class="vc-prop" :class="{ 'vc-diff': hasDiff('fitRegion') }">
              <div class="vc-prop-label">贴合区域</div>
              <div class="vc-prop-value">
                ({{ compareResult.v2.fitRegion.x }}, {{ compareResult.v2.fitRegion.y }})
                {{ compareResult.v2.fitRegion.width }}×{{ compareResult.v2.fitRegion.height }}
              </div>
            </div>
            <div class="vc-prop" :class="{ 'vc-diff': hasDiff('permission') }">
              <div class="vc-prop-label">权限</div>
              <div class="vc-prop-value">{{ getPermissionLabel(compareResult.v2.permission) }}</div>
            </div>
            <div class="vc-prop">
              <div class="vc-prop-label">创建时间</div>
              <div class="vc-prop-value">{{ formatDate(compareResult.v2.createdAt) }}</div>
            </div>
            <div v-if="compareResult.v2.description" class="vc-prop">
              <div class="vc-prop-label">描述</div>
              <div class="vc-prop-value">{{ compareResult.v2.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTemplateStore, type VersionCompareResult } from '@/stores/template'
import { getCategoryLabel } from '@/constants'
import { IconCheckCircle } from '@arco-design/web-vue/es/icon'

defineEmits<{
  (e: 'close'): void
}>()

const templateStore = useTemplateStore()

const compareResult = computed<VersionCompareResult | null>(() => templateStore.compareResult)

function hasDiff(key: string) {
  if (!compareResult.value) return false
  return compareResult.value.diffs.includes(key)
}

function getDiffLabel(key: string): string {
  const map: Record<string, string> = {
    name: '模板名称',
    category: '分类',
    width: '宽度',
    height: '高度',
    image: '模板图片',
    fitRegion: '贴合区域',
    permission: '权限',
  }
  return map[key] || key
}

function getPermissionLabel(p: string): string {
  const map: Record<string, string> = {
    public: '公开',
    private: '私有',
    restricted: '受限',
  }
  return map[p] || p
}

function formatDate(d: string) {
  const date = new Date(d)
  return date.toLocaleString('zh-CN')
}
</script>

<style scoped>
.version-compare {
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  padding: 16px;
  margin-top: 16px;
}
.vc-header {
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
.vc-empty {
  padding: 32px 0;
}
.vc-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  background: rgba(245, 63, 63, 0.06);
  border: 1px solid rgba(245, 63, 63, 0.25);
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
  font-size: 13px;
  flex-wrap: wrap;
}
.vc-summary-same {
  background: rgba(0, 180, 42, 0.06);
  border-color: rgba(0, 180, 42, 0.25);
  color: var(--color-success);
  gap: 6px;
}
.vc-summary-label {
  color: var(--color-text-secondary);
  margin-right: 4px;
}
.vc-grid {
  display: grid;
  grid-template-columns: 1fr 60px 1fr;
  gap: 12px;
  align-items: start;
}
.vc-column {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-fill-1);
}
.vc-column-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-fill-2);
}
.vc-version-badge {
  font-weight: 700;
  font-size: 14px;
  color: var(--color-primary);
}
.vc-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--color-bg-secondary);
  overflow: hidden;
  border-bottom: 1px solid var(--color-border);
}
.vc-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.vc-fit-region {
  position: absolute;
  border: 2px dashed #007AFF;
  background: rgba(0, 122, 255, 0.08);
  border-radius: 2px;
}
.vc-fit-region.vc-diff {
  border-color: #f53f3f;
  background: rgba(245, 63, 63, 0.12);
}
.vc-props {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.vc-prop {
  display: flex;
  gap: 8px;
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 4px;
  background: transparent;
  transition: background 0.15s;
}
.vc-prop.vc-diff {
  background: rgba(245, 63, 63, 0.08);
  border: 1px solid rgba(245, 63, 63, 0.2);
}
.vc-prop-label {
  width: 72px;
  flex-shrink: 0;
  color: var(--color-text-3);
}
.vc-prop-value {
  flex: 1;
  color: var(--color-text);
  min-width: 0;
  word-break: break-word;
}
.vc-vs {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 50px;
}
.vc-vs span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.35);
}
</style>
