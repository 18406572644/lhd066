import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface QualityIssue {
  dimension: string
  severity: 'critical' | 'warning' | 'info'
  message: string
}

export interface QualitySuggestion {
  dimension: string
  message: string
}

export interface QualityReport {
  fitRegionScore: number
  imageQualityScore: number
  metadataScore: number
  accessibilityScore: number
  totalScore: number
  grade: 'S' | 'A' | 'B' | 'C'
  issues: QualityIssue[]
  suggestions: QualitySuggestion[]
  autoTags: string[]
}

interface TemplateData {
  id: number
  width: number
  height: number
  fit_x: number
  fit_y: number
  fit_width: number
  fit_height: number
  image_url: string
  name: string
  category: string
  description?: string
  user_id: number
}

function getAbsoluteImagePath(imageUrl: string): string {
  if (path.isAbsolute(imageUrl)) return imageUrl
  return path.resolve(__dirname, '..', '..', imageUrl.replace(/^\//, ''))
}

function checkFitRegion(t: TemplateData): { score: number; issues: QualityIssue[]; suggestions: QualitySuggestion[] } {
  const issues: QualityIssue[] = []
  const suggestions: QualitySuggestion[] = []
  let score = 100

  const fitRight = t.fit_x + t.fit_width
  const fitBottom = t.fit_y + t.fit_height
  if (fitRight > t.width || fitBottom > t.height) {
    issues.push({
      dimension: 'fit_region',
      severity: 'critical',
      message: `贴合区域超出模板边界 (fit_right=${fitRight}, fit_bottom=${fitBottom}, template=${t.width}x${t.height})`
    })
    score -= 40
  }

  if (t.fit_x < 0 || t.fit_y < 0) {
    issues.push({
      dimension: 'fit_region',
      severity: 'critical',
      message: '贴合区域起点坐标为负值'
    })
    score -= 20
  }

  const fitArea = t.fit_width * t.fit_height
  const templateArea = t.width * t.height
  const coverageRatio = templateArea > 0 ? fitArea / templateArea : 0
  if (coverageRatio < 0.1) {
    issues.push({
      dimension: 'fit_region',
      severity: 'warning',
      message: `贴合区域占模板面积比例过小 (${(coverageRatio * 100).toFixed(1)}%)`
    })
    score -= 15
  } else if (coverageRatio > 0.95) {
    issues.push({
      dimension: 'fit_region',
      severity: 'warning',
      message: `贴合区域占模板面积比例过大 (${(coverageRatio * 100).toFixed(1)}%)，缺少边距`
    })
    score -= 10
  }

  const fitAspect = t.fit_width / Math.max(t.fit_height, 1)
  if (fitAspect > 10 || fitAspect < 0.1) {
    issues.push({
      dimension: 'fit_region',
      severity: 'warning',
      message: `贴合区域宽高比极端 (${fitAspect.toFixed(2)})，可能导致设计变形`
    })
    score -= 15
  }

  if (t.fit_width < 100 || t.fit_height < 100) {
    issues.push({
      dimension: 'fit_region',
      severity: 'warning',
      message: '贴合区域尺寸过小（宽或高 < 100px），影响设计展示效果'
    })
    score -= 10
  }

  if (coverageRatio >= 0.3 && coverageRatio <= 0.85 && fitAspect >= 0.3 && fitAspect <= 3) {
    suggestions.push({
      dimension: 'fit_region',
      message: '贴合区域设置合理，比例适中'
    })
  } else {
    suggestions.push({
      dimension: 'fit_region',
      message: '建议调整贴合区域使其占模板面积的 30%-85%，宽高比在 0.3-3 之间'
    })
  }

  return { score: Math.max(0, score), issues, suggestions }
}

async function checkImageQuality(t: TemplateData): Promise<{ score: number; issues: QualityIssue[]; suggestions: QualitySuggestion[] }> {
  const issues: QualityIssue[] = []
  const suggestions: QualitySuggestion[] = []
  let score = 100

  try {
    const imagePath = getAbsoluteImagePath(t.image_url)
    const metadata = await sharp(imagePath).metadata()
    const stats = await sharp(imagePath).stats()

    if (!metadata.width || !metadata.height) {
      issues.push({
        dimension: 'image_quality',
        severity: 'critical',
        message: '无法读取图片尺寸信息'
      })
      return { score: 0, issues, suggestions }
    }

    const maxDimension = Math.max(metadata.width, metadata.height)
    if (maxDimension < 2000) {
      issues.push({
        dimension: 'image_quality',
        severity: maxDimension < 1000 ? 'critical' : 'warning',
        message: `图片分辨率不达标 (${metadata.width}x${metadata.height})，要求至少 2000px`
      })
      score -= maxDimension < 1000 ? 40 : 20
    } else if (maxDimension >= 4000) {
      suggestions.push({
        dimension: 'image_quality',
        message: '图片分辨率优秀，适合高清展示'
      })
    }

    if (metadata.format === 'jpeg' && metadata.chromaSubsampling === '4:2:0') {
      issues.push({
        dimension: 'image_quality',
        severity: 'warning',
        message: 'JPEG 图片使用了色度子采样 (4:2:0)，可能存在压缩伪影'
      })
      score -= 10
    }

    const metaQuality = (metadata as any).quality
    if (metadata.format === 'jpeg' && metaQuality !== undefined && metaQuality < 80) {
      issues.push({
        dimension: 'image_quality',
        severity: 'warning',
        message: `JPEG 质量较低 (quality=${metaQuality})，可能存在可见压缩伪影`
      })
      score -= 10
    }

    const channels = stats.channels
    if (channels && channels.length >= 3) {
      const rMean = channels[0].mean
      const gMean = channels[1].mean
      const bMean = channels[2].mean
      const diff = Math.max(rMean, gMean, bMean) - Math.min(rMean, gMean, bMean)
      if (diff < 5 && rMean > 240) {
        issues.push({
          dimension: 'image_quality',
          severity: 'info',
          message: '图片接近纯白色，可能缺少内容'
        })
        score -= 5
      }
    }

    if (metadata.hasAlpha) {
      suggestions.push({
        dimension: 'image_quality',
        message: '图片包含透明通道，适合多种背景'
      })
    }

    if (metadata.size && metadata.size > 10 * 1024 * 1024) {
      issues.push({
        dimension: 'image_quality',
        severity: 'warning',
        message: `图片文件过大 (${(metadata.size / 1024 / 1024).toFixed(1)}MB)，可能影响加载速度`
      })
      score -= 5
    }

    if (maxDimension >= 2000 && (!issues.some(i => i.dimension === 'image_quality' && i.severity === 'critical'))) {
      suggestions.push({
        dimension: 'image_quality',
        message: '图片分辨率达标，质量良好'
      })
    }
  } catch (err: any) {
    issues.push({
      dimension: 'image_quality',
      severity: 'critical',
      message: `无法分析图片: ${err.message}`
    })
    score -= 50
  }

  return { score: Math.max(0, score), issues, suggestions }
}

function checkMetadata(t: TemplateData): { score: number; issues: QualityIssue[]; suggestions: QualitySuggestion[] } {
  const issues: QualityIssue[] = []
  const suggestions: QualitySuggestion[] = []
  let score = 100

  if (!t.description || t.description.trim().length === 0) {
    issues.push({
      dimension: 'metadata',
      severity: 'warning',
      message: '缺少模板描述，影响搜索和推荐'
    })
    score -= 20
  } else if (t.description.trim().length < 10) {
    issues.push({
      dimension: 'metadata',
      severity: 'info',
      message: '模板描述过短，建议补充更多细节'
    })
    score -= 10
  } else {
    suggestions.push({
      dimension: 'metadata',
      message: '模板描述完整'
    })
  }

  const tagRows = db.prepare(
    'SELECT tg.name FROM template_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE tt.template_id = ?'
  ).all(t.id) as any[]
  const tagCount = tagRows.length

  if (tagCount < 3) {
    issues.push({
      dimension: 'metadata',
      severity: tagCount === 0 ? 'critical' : 'warning',
      message: `标签数量不足 (当前${tagCount}个，要求≥3个)`
    })
    score -= tagCount === 0 ? 30 : 15
  } else {
    suggestions.push({
      dimension: 'metadata',
      message: `标签数量充足 (${tagCount}个)`
    })
  }

  const validCategories = ['poster', 'phone', 'computer', 'packaging']
  if (!validCategories.includes(t.category)) {
    issues.push({
      dimension: 'metadata',
      severity: 'critical',
      message: `分类不准确: "${t.category}"，有效值为: ${validCategories.join(', ')}`
    })
    score -= 30
  } else {
    suggestions.push({
      dimension: 'metadata',
      message: '模板分类正确'
    })
  }

  if (!t.name || t.name.trim().length < 2) {
    issues.push({
      dimension: 'metadata',
      severity: 'warning',
      message: '模板名称过短，建议使用更具描述性的名称'
    })
    score -= 10
  }

  return { score: Math.max(0, score), issues, suggestions }
}

async function checkAccessibility(t: TemplateData): Promise<{ score: number; issues: QualityIssue[]; suggestions: QualitySuggestion[] }> {
  const issues: QualityIssue[] = []
  const suggestions: QualitySuggestion[] = []
  let score = 100

  try {
    const imagePath = getAbsoluteImagePath(t.image_url)
    const metadata = await sharp(imagePath).metadata()

    if (metadata.hasAlpha) {
      const { data, info } = await sharp(imagePath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      const pixelCount = info.width * info.height
      let transparentCount = 0
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 128) transparentCount++
      }
      const transparentRatio = transparentCount / pixelCount

      if (transparentRatio > 0.3) {
        issues.push({
          dimension: 'accessibility',
          severity: 'warning',
          message: `透明区域占比过大 (${(transparentRatio * 100).toFixed(1)}%)，可能影响深色背景显示`
        })
        score -= 15
      } else if (transparentRatio > 0.05) {
        suggestions.push({
          dimension: 'accessibility',
          message: `存在少量透明区域 (${(transparentRatio * 100).toFixed(1)}%)，适配时需注意`
        })
      } else {
        suggestions.push({
          dimension: 'accessibility',
          message: '透明区域占比极小，适配性良好'
        })
      }

      if (transparentRatio > 0.01) {
        const darkPixelCount = await countDarkPixels(data, info.width, info.height)
        if (darkPixelCount > pixelCount * 0.3) {
          issues.push({
            dimension: 'accessibility',
            severity: 'warning',
            message: '图片暗色区域较多，在深色背景下可能对比度不足'
          })
          score -= 10
        }
      }
    } else {
      suggestions.push({
        dimension: 'accessibility',
        message: '图片无透明通道，适配深色背景无问题'
      })
    }

    const metaChannels = metadata.channels as number | undefined
    if (metaChannels === 1 || (metaChannels === 2 && metadata.hasAlpha)) {
      issues.push({
        dimension: 'accessibility',
        severity: 'warning',
        message: '图片为灰度模式，可能缺少色彩信息'
      })
      score -= 10
    }
  } catch (err: any) {
    issues.push({
      dimension: 'accessibility',
      severity: 'warning',
      message: `无法检查可访问性: ${err.message}`
    })
    score -= 20
  }

  return { score: Math.max(0, score), issues, suggestions }
}

async function countDarkPixels(data: Buffer, width: number, height: number): Promise<number> {
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    if (luminance < 64) count++
  }
  return count
}

function generateAutoTags(t: TemplateData, imageMetadata?: sharp.Metadata): string[] {
  const tags: string[] = []

  const categoryTagMap: Record<string, string[]> = {
    'phone': ['手机', '移动设备'],
    'computer': ['电脑', '笔记本', '桌面设备'],
    'poster': ['海报', '宣传图'],
    'packaging': ['包装', '产品包装'],
  }
  if (categoryTagMap[t.category]) {
    tags.push(...categoryTagMap[t.category])
  }

  if (t.width && t.height) {
    const aspect = t.width / t.height
    if (aspect > 1.5) tags.push('横屏')
    else if (aspect < 0.7) tags.push('竖屏')
    else tags.push('方形')

    const phoneResolutions: Record<string, [number, number][]> = {
      'iPhone 15 Pro': [[1179, 2556], [2556, 1179]],
      'iPhone 15': [[1179, 2556]],
      'iPhone 14': [[1170, 2532]],
      'iPad': [[1640, 2360], [2048, 2732]],
      'MacBook': [[1440, 900], [2560, 1600], [3024, 1964]],
    }
    for (const [device, resolutions] of Object.entries(phoneResolutions)) {
      for (const [w, h] of resolutions) {
        if ((Math.abs(t.width - w) < 50 && Math.abs(t.height - h) < 50) ||
            (Math.abs(t.width - h) < 50 && Math.abs(t.height - w) < 50)) {
          tags.push(device)
          break
        }
      }
    }
  }

  if (imageMetadata) {
    if (imageMetadata.hasAlpha) tags.push('透明背景')
    if (imageMetadata.format === 'svg') tags.push('矢量图')
    if (imageMetadata.density && imageMetadata.density >= 300) tags.push('高清')
    if (imageMetadata.width && imageMetadata.height) {
      if (imageMetadata.width >= 4000 || imageMetadata.height >= 4000) tags.push('超高清')
    }
  }

  if (t.fit_width && t.fit_height) {
    const fitAspect = t.fit_width / t.fit_height
    if (fitAspect > 0.8 && fitAspect < 1.2) tags.push('等距视角')
  }

  const uniqueTags = [...new Set(tags)]
  return uniqueTags
}

function computeGrade(totalScore: number): 'S' | 'A' | 'B' | 'C' {
  if (totalScore >= 90) return 'S'
  if (totalScore >= 75) return 'A'
  if (totalScore >= 60) return 'B'
  return 'C'
}

export async function runQualityInspection(templateId: number): Promise<QualityReport> {
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as TemplateData | undefined
  if (!template) {
    throw new Error(`Template ${templateId} not found`)
  }

  const fitResult = checkFitRegion(template)
  const imageResult = await checkImageQuality(template)
  const metadataResult = checkMetadata(template)
  const accessibilityResult = await checkAccessibility(template)

  const totalScore = Math.round(
    fitResult.score * 0.25 +
    imageResult.score * 0.30 +
    metadataResult.score * 0.25 +
    accessibilityResult.score * 0.20
  )

  const grade = computeGrade(totalScore)

  const allIssues = [
    ...fitResult.issues,
    ...imageResult.issues,
    ...metadataResult.issues,
    ...accessibilityResult.issues,
  ]

  const allSuggestions = [
    ...fitResult.suggestions,
    ...imageResult.suggestions,
    ...metadataResult.suggestions,
    ...accessibilityResult.suggestions,
  ]

  let imageMetadata: sharp.Metadata | undefined
  try {
    const imagePath = getAbsoluteImagePath(template.image_url)
    imageMetadata = await sharp(imagePath).metadata()
  } catch {}
  const autoTags = generateAutoTags(template, imageMetadata)

  const existingReport = db.prepare('SELECT id FROM quality_reports WHERE template_id = ?').get(templateId) as any

  const reviewStatus = grade === 'C' ? 'pending' : 'auto'

  if (existingReport) {
    db.prepare(
      `UPDATE quality_reports SET
        fit_region_score = ?, image_quality_score = ?, metadata_score = ?, accessibility_score = ?,
        total_score = ?, grade = ?, issues = ?, suggestions = ?, auto_tags = ?,
        review_status = ?, reviewed_by = NULL, reviewed_at = NULL,
        created_at = datetime('now')
      WHERE template_id = ?`
    ).run(
      fitResult.score, imageResult.score, metadataResult.score, accessibilityResult.score,
      totalScore, grade,
      JSON.stringify(allIssues), JSON.stringify(allSuggestions), JSON.stringify(autoTags),
      reviewStatus, templateId
    )
  } else {
    db.prepare(
      `INSERT INTO quality_reports
       (template_id, fit_region_score, image_quality_score, metadata_score, accessibility_score,
        total_score, grade, issues, suggestions, auto_tags, review_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      templateId, fitResult.score, imageResult.score, metadataResult.score, accessibilityResult.score,
      totalScore, grade,
      JSON.stringify(allIssues), JSON.stringify(allSuggestions), JSON.stringify(autoTags),
      reviewStatus
    )
  }

  db.prepare(
    'UPDATE templates SET quality_score = ?, quality_grade = ?, review_status = ? WHERE id = ?'
  ).run(totalScore, grade, reviewStatus, templateId)

  if (autoTags.length > 0) {
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
    const findTag = db.prepare('SELECT id FROM tags WHERE name = ?')
    const linkTag = db.prepare('INSERT OR IGNORE INTO template_tags (template_id, tag_id) VALUES (?, ?)')

    for (const tagName of autoTags) {
      insertTag.run(tagName)
      const tagRow = findTag.get(tagName) as any
      if (tagRow) {
        linkTag.run(templateId, tagRow.id)
      }
    }
  }

  return {
    fitRegionScore: fitResult.score,
    imageQualityScore: imageResult.score,
    metadataScore: metadataResult.score,
    accessibilityScore: accessibilityResult.score,
    totalScore,
    grade,
    issues: allIssues,
    suggestions: allSuggestions,
    autoTags,
  }
}

export function getQualityReport(templateId: number): any {
  const report = db.prepare('SELECT * FROM quality_reports WHERE template_id = ?').get(templateId) as any
  if (!report) return null

  return {
    id: report.id,
    templateId: report.template_id,
    fitRegionScore: report.fit_region_score,
    imageQualityScore: report.image_quality_score,
    metadataScore: report.metadata_score,
    accessibilityScore: report.accessibility_score,
    totalScore: report.total_score,
    grade: report.grade,
    issues: JSON.parse(report.issues),
    suggestions: JSON.parse(report.suggestions),
    autoTags: JSON.parse(report.auto_tags),
    reviewStatus: report.review_status,
    reviewedBy: report.reviewed_by,
    reviewedAt: report.reviewed_at,
    createdAt: report.created_at,
  }
}
