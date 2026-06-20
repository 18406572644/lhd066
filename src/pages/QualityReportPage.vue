<template>
  <div class="quality-report-page">
    <div class="qr-header">
      <a-button @click="$router.back()">← 返回</a-button>
      <a-breadcrumb class="breadcrumb" style="margin-left: 16px">
        <a-breadcrumb-item @click="$router.push('/')">模板库</a-breadcrumb-item>
        <a-breadcrumb-item>质量报告</a-breadcrumb-item>
      </a-breadcrumb>
      <div style="flex: 1" />
      <a-button type="primary" :loading="loading" @click="onReinspect">重新检测</a-button>
    </div>

    <div v-if="loading && !report" class="qr-loading">
      <a-skeleton :loading="true" animation :text="{ rows: 6 }" />
    </div>

    <div v-else-if="!report" class="qr-404">
      <a-result status="404" title="质量报告不存在" sub-title="请先运行质量检测" />
    </div>

    <div v-else class="qr-content">
      <div class="qr-overview">
        <div class="qr-grade-card" :class="'grade-' + report.grade">
          <div class="qr-grade-label">模板等级</div>
          <div class="qr-grade-value">{{ report.grade }}</div>
          <div class="qr-grade-score">总分 {{ report.totalScore }}/100</div>
        </div>
        <div class="qr-scores-grid">
          <div class="qr-score-item">
            <div class="qr-score-ring">
              <a-progress
                :percent="report.fitRegionScore / 100"
                :stroke-width="6"
                :color="getScoreColor(report.fitRegionScore)"
                size="large"
                type="circle"
              />
            </div>
            <div class="qr-score-label">贴合区域</div>
            <div class="qr-score-value">{{ report.fitRegionScore }}</div>
          </div>
          <div class="qr-score-item">
            <div class="qr-score-ring">
              <a-progress
                :percent="report.imageQualityScore / 100"
                :stroke-width="6"
                :color="getScoreColor(report.imageQualityScore)"
                size="large"
                type="circle"
              />
            </div>
            <div class="qr-score-label">图片质量</div>
            <div class="qr-score-value">{{ report.imageQualityScore }}</div>
          </div>
          <div class="qr-score-item">
            <div class="qr-score-ring">
              <a-progress
                :percent="report.metadataScore / 100"
                :stroke-width="6"
                :color="getScoreColor(report.metadataScore)"
                size="large"
                type="circle"
              />
            </div>
            <div class="qr-score-label">元信息</div>
            <div class="qr-score-value">{{ report.metadataScore }}</div>
          </div>
          <div class="qr-score-item">
            <div class="qr-score-ring">
              <a-progress
                :percent="report.accessibilityScore / 100"
                :stroke-width="6"
                :color="getScoreColor(report.accessibilityScore)"
                size="large"
                type="circle"
              />
            </div>
            <div class="qr-score-label">可访问性</div>
            <div class="qr-score-value">{{ report.accessibilityScore }}</div>
          </div>
        </div>
      </div>

      <div class="qr-review-status" v-if="report.reviewStatus === 'pending'">
        <a-alert type="warning" :closable="false">
          此模板质量等级为 C 级，当前处于待审核状态，需管理员审核后才能公开发布。
        </a-alert>
      </div>
      <div class="qr-review-status" v-else-if="report.reviewStatus === 'approved'">
        <a-alert type="success" :closable="false">
          此模板已通过人工审核，已公开发布。
        </a-alert>
      </div>
      <div class="qr-review-status" v-else-if="report.reviewStatus === 'rejected'">
        <a-alert type="error" :closable="false">
          此模板未通过人工审核，请根据优化建议修改后重新提交。
        </a-alert>
      </div>

      <div class="qr-sections">
        <div class="qr-section">
          <h3 class="qr-section-title">
            <span class="qr-section-icon issue-icon">⚠</span>
            问题点
            <a-tag v-if="report.issues.length" color="red" size="small">{{ report.issues.length }}</a-tag>
          </h3>
          <div v-if="report.issues.length === 0" class="qr-empty">未发现问题</div>
          <div v-else class="qr-issues-list">
            <div
              v-for="(issue, idx) in report.issues"
              :key="idx"
              class="qr-issue-item"
              :class="'severity-' + issue.severity"
            >
              <span class="qr-issue-badge" :class="'badge-' + issue.severity">
                {{ issue.severity === 'critical' ? '严重' : issue.severity === 'warning' ? '警告' : '提示' }}
              </span>
              <span class="qr-issue-dimension">{{ getDimensionLabel(issue.dimension) }}</span>
              <span class="qr-issue-message">{{ issue.message }}</span>
            </div>
          </div>
        </div>

        <div class="qr-section">
          <h3 class="qr-section-title">
            <span class="qr-section-icon suggestion-icon">💡</span>
            优化建议
          </h3>
          <div v-if="report.suggestions.length === 0" class="qr-empty">暂无建议</div>
          <div v-else class="qr-suggestions-list">
            <div
              v-for="(s, idx) in report.suggestions"
              :key="idx"
              class="qr-suggestion-item"
            >
              <span class="qr-suggestion-dimension">{{ getDimensionLabel(s.dimension) }}</span>
              <span class="qr-suggestion-message">{{ s.message }}</span>
            </div>
          </div>
        </div>

        <div class="qr-section">
          <h3 class="qr-section-title">
            <span class="qr-section-icon tag-icon">🏷</span>
            AI 自动标签
            <a-button size="mini" type="text" @click="onAutoTag">重新识别</a-button>
          </h3>
          <div v-if="report.autoTags.length === 0" class="qr-empty">未识别到标签</div>
          <div v-else class="qr-auto-tags">
            <a-tag
              v-for="tag in report.autoTags"
              :key="tag"
              color="arcoblue"
              size="medium"
            >
              {{ tag }}
            </a-tag>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useQualityStore, type QualityReportData } from '@/stores/quality'
import { Message } from '@arco-design/web-vue'

const route = useRoute()
const qualityStore = useQualityStore()

const templateId = computed(() => Number(route.params.id))
const report = ref<QualityReportData | null>(null)
const loading = ref(false)

function getScoreColor(score: number): string {
  if (score >= 90) return '#00b42a'
  if (score >= 75) return '#165dff'
  if (score >= 60) return '#ff7d00'
  return '#f53f3f'
}

function getDimensionLabel(dimension: string): string {
  const map: Record<string, string> = {
    fit_region: '贴合区域',
    image_quality: '图片质量',
    metadata: '元信息',
    accessibility: '可访问性',
  }
  return map[dimension] || dimension
}

async function loadReport() {
  loading.value = true
  try {
    report.value = await qualityStore.fetchReport(templateId.value)
  } catch {
    report.value = null
  } finally {
    loading.value = false
  }
}

async function onReinspect() {
  loading.value = true
  try {
    report.value = await qualityStore.inspectTemplate(templateId.value)
    Message.success('质量检测完成')
  } catch (e: any) {
    Message.error(e.message || '检测失败')
  } finally {
    loading.value = false
  }
}

async function onAutoTag() {
  try {
    const res = await qualityStore.autoTag(templateId.value)
    if (report.value) {
      report.value.autoTags = res.autoTags
    }
    Message.success('AI 标签识别完成')
  } catch (e: any) {
    Message.error(e.message || '识别失败')
  }
}

onMounted(loadReport)
</script>

<style scoped>
.quality-report-page {
  padding: 20px 24px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}
.qr-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}
.breadcrumb {
  font-size: 13px;
}
.qr-loading {
  padding: 20px 0;
}
.qr-404 {
  padding: 60px 0;
}
.qr-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.qr-overview {
  display: flex;
  gap: 24px;
  align-items: stretch;
}
.qr-grade-card {
  flex-shrink: 0;
  width: 180px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 24px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.qr-grade-card.grade-S {
  border-color: #00b42a;
  background: linear-gradient(135deg, rgba(0, 180, 42, 0.06), rgba(0, 180, 42, 0.02));
}
.qr-grade-card.grade-A {
  border-color: #165dff;
  background: linear-gradient(135deg, rgba(22, 93, 255, 0.06), rgba(22, 93, 255, 0.02));
}
.qr-grade-card.grade-B {
  border-color: #ff7d00;
  background: linear-gradient(135deg, rgba(255, 125, 0, 0.06), rgba(255, 125, 0, 0.02));
}
.qr-grade-card.grade-C {
  border-color: #f53f3f;
  background: linear-gradient(135deg, rgba(245, 63, 63, 0.06), rgba(245, 63, 63, 0.02));
}
.qr-grade-label {
  font-size: 12px;
  color: var(--color-text-3);
  margin-bottom: 8px;
}
.qr-grade-value {
  font-size: 56px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 8px;
}
.grade-S .qr-grade-value { color: #00b42a; }
.grade-A .qr-grade-value { color: #165dff; }
.grade-B .qr-grade-value { color: #ff7d00; }
.grade-C .qr-grade-value { color: #f53f3f; }
.qr-grade-score {
  font-size: 13px;
  color: var(--color-text-2);
}
.qr-scores-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.qr-score-item {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 20px 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.qr-score-ring {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-score-label {
  font-size: 13px;
  color: var(--color-text-2);
}
.qr-score-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
}
.qr-review-status {
  margin: 0;
}
.qr-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.qr-section {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 20px;
}
.qr-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--color-text);
}
.qr-section-icon {
  font-size: 16px;
}
.qr-empty {
  color: var(--color-text-3);
  font-size: 13px;
  padding: 8px 0;
}
.qr-issues-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.qr-issue-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1.5;
}
.qr-issue-item.severity-critical {
  background: rgba(245, 63, 63, 0.06);
  border-left: 3px solid #f53f3f;
}
.qr-issue-item.severity-warning {
  background: rgba(255, 125, 0, 0.06);
  border-left: 3px solid #ff7d00;
}
.qr-issue-item.severity-info {
  background: rgba(22, 93, 255, 0.06);
  border-left: 3px solid #165dff;
}
.qr-issue-badge {
  flex-shrink: 0;
  display: inline-block;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.badge-critical {
  background: rgba(245, 63, 63, 0.12);
  color: #f53f3f;
}
.badge-warning {
  background: rgba(255, 125, 0, 0.12);
  color: #ff7d00;
}
.badge-info {
  background: rgba(22, 93, 255, 0.12);
  color: #165dff;
}
.qr-issue-dimension {
  flex-shrink: 0;
  color: var(--color-text-2);
  font-weight: 500;
  min-width: 60px;
}
.qr-issue-message {
  color: var(--color-text);
  flex: 1;
}
.qr-suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.qr-suggestion-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 14px;
  background: var(--color-fill-1);
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1.5;
}
.qr-suggestion-dimension {
  flex-shrink: 0;
  color: var(--color-text-2);
  font-weight: 500;
  min-width: 60px;
}
.qr-suggestion-message {
  color: var(--color-text);
}
.qr-auto-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
