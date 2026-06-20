import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type {
  TemplatePerformance,
  UserProfileInsight,
  CategoryPreference,
  RevenueData,
  TopTemplate,
  OptimizationSuggestion,
  TrendDataPoint
} from './analytics.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const exportsDir = path.resolve(__dirname, '..', '..', 'data', 'exports')
fs.mkdirSync(exportsDir, { recursive: true })

export interface ReportData {
  designerName: string
  period: 'week' | 'month' | 'quarter'
  dateRange: { start: string; end: string }
  generatedAt: string
  summary: {
    totalTemplates: number
    totalUses: number
    avgRating: number
    totalFavorites: number
    totalRevenue: number
  }
  templatePerformance: TemplatePerformance[]
  usageTrends: Record<number, TrendDataPoint[]>
  favoriteTrends: Record<number, TrendDataPoint[]>
  userGeography: UserProfileInsight[]
  categoryPreferences: CategoryPreference[]
  revenueTrend: RevenueData[]
  topRevenueTemplates: TopTemplate[]
  suggestions: OptimizationSuggestion[]
}

export function generateAnalyticsPDF(reportData: ReportData): string {
  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const filename = `analytics-report-${Date.now()}.pdf`
  const filePath = path.join(exportsDir, filename)
  const stream = fs.createWriteStream(filePath)
  
  doc.pipe(stream)
  
  drawHeader(doc, reportData)
  drawSummary(doc, reportData)
  drawTemplatePerformance(doc, reportData)
  drawCategoryPreferences(doc, reportData)
  drawUserGeography(doc, reportData)
  drawRevenueAnalysis(doc, reportData)
  drawSuggestions(doc, reportData)
  drawFooter(doc)
  
  doc.end()
  
  return filePath
}

function drawHeader(doc: PDFKit.PDFDocument, data: ReportData): void {
  doc.fillColor('#1e40af')
  doc.fontSize(24).text('设计师数据分析报告', { align: 'center' })
  doc.moveDown()
  
  doc.fillColor('#6b7280')
  doc.fontSize(12).text(`设计师: ${data.designerName}`, { align: 'center' })
  doc.text(`报告周期: ${getPeriodText(data.period)} (${data.dateRange.start} ~ ${data.dateRange.end})`, { align: 'center' })
  doc.text(`生成时间: ${data.generatedAt}`, { align: 'center' })
  doc.moveDown()
  
  doc.strokeColor('#e5e7eb')
  doc.lineWidth(1)
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
  doc.moveDown()
}

function drawSummary(doc: PDFKit.PDFDocument, data: ReportData): void {
  doc.fillColor('#1f2937')
  doc.fontSize(16).text('一、数据概览')
  doc.moveDown(0.5)
  
  const summaryItems = [
    { label: '模板总数', value: data.summary.totalTemplates, color: '#3b82f6' },
    { label: '总使用次数', value: data.summary.totalUses, color: '#10b981' },
    { label: '平均评分', value: data.summary.avgRating.toFixed(2), color: '#f59e0b' },
    { label: '总收藏数', value: data.summary.totalFavorites, color: '#ef4444' },
    { label: '总收入', value: `¥${data.summary.totalRevenue.toFixed(2)}`, color: '#8b5cf6' }
  ]
  
  const startX = 50
  const itemWidth = 95
  const boxHeight = 60
  
  summaryItems.forEach((item, index) => {
    const x = startX + index * (itemWidth + 10)
    const y = doc.y
    
    doc.fillColor(item.color)
    doc.roundedRect(x, y, itemWidth, boxHeight, 8).fill()
    
    doc.fillColor('#ffffff')
    doc.fontSize(10).text(item.label, x + 10, y + 10, { width: itemWidth - 20, align: 'center' })
    doc.fontSize(14).text(String(item.value), x + 10, y + 30, { width: itemWidth - 20, align: 'center' })
  })
  
  doc.y = doc.y + boxHeight + 20
}

function drawTemplatePerformance(doc: PDFKit.PDFDocument, data: ReportData): void {
  doc.fillColor('#1f2937')
  doc.fontSize(16).text('二、模板表现')
  doc.moveDown(0.5)
  
  const headers = ['排名', '模板名称', '分类', '使用次数', '平均评分', '收藏数']
  const colWidths = [40, 160, 70, 70, 70, 60]
  let startX = 50
  let startY = doc.y
  
  doc.fillColor('#f3f4f6')
  doc.roundedRect(startX, startY, 470, 25, 4).fill()
  
  doc.fillColor('#374151')
  doc.fontSize(10).font('Helvetica-Bold')
  headers.forEach((header, i) => {
    doc.text(header, startX + 5, startY + 7, { width: colWidths[i] - 10, align: i === 0 ? 'center' : 'left' })
    startX += colWidths[i]
  })
  
  doc.font('Helvetica')
  data.templatePerformance.slice(0, 8).forEach((tpl, index) => {
    const rowY = startY + 25 + index * 22
    const isEven = index % 2 === 0
    
    if (isEven) {
      doc.fillColor('#fafafa')
      doc.roundedRect(50, rowY, 470, 22, 2).fill()
    }
    
    doc.fillColor('#1f2937')
    startX = 50
    
    const rankBadge = index < 3 ? ['#fbbf24', '#9ca3af', '#d97706'][index] : '#e5e7eb'
    const textColor = index < 3 ? '#ffffff' : '#6b7280'
    doc.fillColor(rankBadge)
    doc.roundedRect(startX + 5, rowY + 3, 30, 16, 4).fill()
    doc.fillColor(textColor)
    doc.text(String(index + 1), startX, rowY + 6, { width: 40, align: 'center' })
    startX += colWidths[0]
    
    doc.fillColor('#1f2937')
    doc.text(truncate(tpl.name, 22), startX + 5, rowY + 6, { width: colWidths[1] - 10 })
    startX += colWidths[1]
    
    doc.fillColor(getCategoryColor(tpl.category))
    doc.text(tpl.category, startX + 5, rowY + 6, { width: colWidths[2] - 10 })
    startX += colWidths[2]
    
    doc.fillColor('#1f2937')
    doc.text(String(tpl.use_count), startX + 5, rowY + 6, { width: colWidths[3] - 10 })
    startX += colWidths[3]
    
    const ratingColor = tpl.avg_rating >= 4 ? '#10b981' : tpl.avg_rating >= 3 ? '#f59e0b' : '#ef4444'
    doc.fillColor(ratingColor)
    doc.text(`★ ${tpl.avg_rating.toFixed(1)}`, startX + 5, rowY + 6, { width: colWidths[4] - 10 })
    startX += colWidths[4]
    
    doc.fillColor('#ef4444')
    doc.text(`♥ ${tpl.favorite_count}`, startX + 5, rowY + 6, { width: colWidths[5] - 10 })
  })
  
  doc.y = startY + 25 + Math.min(data.templatePerformance.length, 8) * 22 + 20
}

function drawCategoryPreferences(doc: PDFKit.PDFDocument, data: ReportData): void {
  doc.fillColor('#1f2937')
  doc.fontSize(16).text('三、分类偏好')
  doc.moveDown(0.5)
  
  if (data.categoryPreferences.length === 0) {
    doc.fillColor('#6b7280')
    doc.fontSize(12).text('暂无分类数据')
    doc.moveDown()
    return
  }
  
  const maxCount = Math.max(...data.categoryPreferences.map(c => c.count))
  const barMaxWidth = 300
  const startX = 100
  
  data.categoryPreferences.forEach((cat, index) => {
    const y = doc.y + index * 30
    const barWidth = (cat.count / maxCount) * barMaxWidth
    
    doc.fillColor(getCategoryColor(cat.category))
    doc.roundedRect(startX, y, barWidth, 20, 4).fill()
    
    doc.fillColor('#1f2937')
    doc.fontSize(11).text(cat.category, 50, y + 4, { width: 45 })
    doc.fillColor('#ffffff')
    doc.text(`${cat.count}次 (${cat.percentage}%)`, startX + 10, y + 4, { width: barWidth - 20 })
  })
  
  doc.y = doc.y + data.categoryPreferences.length * 30 + 10
}

function drawUserGeography(doc: PDFKit.PDFDocument, data: ReportData): void {
  if (doc.y > 650) doc.addPage()
  
  doc.fillColor('#1f2937')
  doc.fontSize(16).text('四、用户地域分布')
  doc.moveDown(0.5)
  
  if (data.userGeography.length === 0) {
    doc.fillColor('#6b7280')
    doc.fontSize(12).text('暂无地域数据')
    doc.moveDown()
    return
  }
  
  const topRegions = data.userGeography.slice(0, 6)
  const total = topRegions.reduce((sum, r) => sum + r.count, 0)
  
  let currentX = 50
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
  
  topRegions.forEach((region, index) => {
    const percentage = (region.count / total) * 100
    const color = colors[index % colors.length]
    
    doc.fillColor(color)
    doc.roundedRect(currentX, doc.y, 70, 50, 6).fill()
    
    doc.fillColor('#ffffff')
    doc.fontSize(10).text(region.region || '未知', currentX + 5, doc.y + 8, { width: 60, align: 'center' })
    doc.fontSize(12).text(`${region.count}人`, currentX + 5, doc.y + 26, { width: 60, align: 'center' })
    doc.fontSize(9).text(`${percentage.toFixed(1)}%`, currentX + 5, doc.y + 40, { width: 60, align: 'center' })
    
    currentX += 80
  })
  
  doc.y = doc.y + 65
}

function drawRevenueAnalysis(doc: PDFKit.PDFDocument, data: ReportData): void {
  if (doc.y > 650) doc.addPage()
  
  doc.fillColor('#1f2937')
  doc.fontSize(16).text('五、收入分析')
  doc.moveDown(0.5)
  
  if (data.topRevenueTemplates.length === 0) {
    doc.fillColor('#6b7280')
    doc.fontSize(12).text('暂无收入数据')
    doc.moveDown()
    return
  }
  
  doc.fillColor('#1f2937')
  doc.fontSize(12).text('Top 收入模板:')
  doc.moveDown(0.5)
  
  const headers = ['排名', '模板名称', '分类', '销售额', '销量']
  const colWidths = [40, 180, 80, 80, 60]
  let startX = 50
  let startY = doc.y
  
  doc.fillColor('#f3f4f6')
  doc.roundedRect(startX, startY, 440, 25, 4).fill()
  
  doc.fillColor('#374151')
  doc.fontSize(10).font('Helvetica-Bold')
  headers.forEach((header, i) => {
    doc.text(header, startX + 5, startY + 7, { width: colWidths[i] - 10, align: 'center' })
    startX += colWidths[i]
  })
  
  doc.font('Helvetica')
  data.topRevenueTemplates.slice(0, 5).forEach((tpl, index) => {
    const rowY = startY + 25 + index * 22
    
    doc.fillColor(index % 2 === 0 ? '#fafafa' : '#ffffff')
    doc.roundedRect(50, rowY, 440, 22, 2).fill()
    
    doc.fillColor('#1f2937')
    startX = 50
    
    doc.text(String(index + 1), startX, rowY + 6, { width: colWidths[0], align: 'center' })
    startX += colWidths[0]
    
    doc.text(truncate(tpl.name, 25), startX + 5, rowY + 6, { width: colWidths[1] - 10 })
    startX += colWidths[1]
    
    doc.fillColor(getCategoryColor(tpl.category))
    doc.text(tpl.category, startX + 5, rowY + 6, { width: colWidths[2] - 10, align: 'center' })
    startX += colWidths[2]
    
    doc.fillColor('#10b981')
    doc.text(`¥${tpl.revenue.toFixed(2)}`, startX, rowY + 6, { width: colWidths[3], align: 'center' })
    startX += colWidths[3]
    
    doc.fillColor('#1f2937')
    doc.text(String(tpl.sales_count), startX, rowY + 6, { width: colWidths[4], align: 'center' })
  })
  
  doc.y = startY + 25 + Math.min(data.topRevenueTemplates.length, 5) * 22 + 20
}

function drawSuggestions(doc: PDFKit.PDFDocument, data: ReportData): void {
  if (doc.y > 650) doc.addPage()
  
  doc.fillColor('#1f2937')
  doc.fontSize(16).text('六、优化建议')
  doc.moveDown(0.5)
  
  if (data.suggestions.length === 0) {
    doc.fillColor('#6b7280')
    doc.fontSize(12).text('暂无优化建议，您的表现非常棒！')
    doc.moveDown()
    return
  }
  
  const priorityColors: Record<string, string> = {
    high: '#fef2f2',
    medium: '#fefce8',
    low: '#f0fdf4'
  }
  
  const priorityTextColors: Record<string, string> = {
    high: '#dc2626',
    medium: '#ca8a04',
    low: '#16a34a'
  }
  
  const priorityLabels: Record<string, string> = {
    high: '高优先级',
    medium: '中优先级',
    low: '低优先级'
  }
  
  data.suggestions.slice(0, 5).forEach((suggestion, index) => {
    const y = doc.y
    const bgColor = priorityColors[suggestion.priority]
    
    doc.fillColor(bgColor)
    doc.roundedRect(50, y, 490, 55, 8).fill()
    
    doc.fillColor(priorityTextColors[suggestion.priority])
    doc.fontSize(9).text(priorityLabels[suggestion.priority], 65, y + 8)
    
    doc.fillColor('#1f2937')
    doc.fontSize(12).text(suggestion.title, 65, y + 22)
    doc.fillColor('#6b7280')
    doc.fontSize(10).text(suggestion.description, 65, y + 38, { width: 460 })
    
    doc.y = y + 65
  })
}

function drawFooter(doc: PDFKit.PDFDocument): void {
  const pageCount = (doc as any).page?.pages?.length || 1
  for (let i = 1; i <= pageCount; i++) {
    doc.switchToPage(i)
    doc.fillColor('#9ca3af')
    doc.fontSize(10).text(`第 ${i} 页 / 共 ${pageCount} 页`, 50, 800, { align: 'center', width: 495 })
    doc.text('Mockup Studio 数据分析平台', 50, 815, { align: 'center', width: 495 })
  }
}

function getPeriodText(period: string): string {
  const map: Record<string, string> = {
    week: '周报',
    month: '月报',
    quarter: '季报'
  }
  return map[period] || period
}

function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    poster: '#3b82f6',
    phone: '#10b981',
    computer: '#f59e0b',
    packaging: '#8b5cf6'
  }
  return map[category] || '#6b7280'
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str
}
