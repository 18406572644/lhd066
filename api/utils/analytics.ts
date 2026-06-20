import db from '../db.js'

export interface DateRange {
  start: string
  end: string
}

export interface TemplatePerformance {
  id: number
  name: string
  category: string
  use_count: number
  avg_rating: number
  rating_count: number
  favorite_count: number
  created_at: string
}

export interface TrendDataPoint {
  date: string
  value: number
}

export interface UserProfileInsight {
  region: string
  country: string
  count: number
  percentage: number
}

export interface CategoryPreference {
  category: string
  count: number
  percentage: number
}

export interface RevenueData {
  date: string
  amount: number
  template_count: number
}

export interface TopTemplate {
  id: number
  name: string
  category: string
  revenue: number
  sales_count: number
}

export interface OptimizationSuggestion {
  type: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  icon: string
}

export function getDateRange(period: 'week' | 'month' | 'quarter'): DateRange {
  const end = new Date()
  const start = new Date()
  
  switch (period) {
    case 'week':
      start.setDate(start.getDate() - 7)
      break
    case 'month':
      start.setMonth(start.getMonth() - 1)
      break
    case 'quarter':
      start.setMonth(start.getMonth() - 3)
      break
  }
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  }
}

export function getTemplatePerformance(userId: number, period?: 'week' | 'month' | 'quarter'): TemplatePerformance[] {
  let dateFilter = ''
  let params: any[] = [userId]
  
  if (period) {
    const range = getDateRange(period)
    dateFilter = 'AND h.created_at BETWEEN ? AND ?'
    params.push(range.start, range.end)
  }
  
  const templates = db.prepare(`
    SELECT 
      t.id,
      t.name,
      t.category,
      t.use_count,
      AVG(tr.rating) as avg_rating,
      COUNT(DISTINCT tr.id) as rating_count,
      COUNT(DISTINCT f.id) as favorite_count,
      t.created_at
    FROM templates t
    LEFT JOIN template_ratings tr ON t.id = tr.template_id
    LEFT JOIN favorites f ON t.id = f.template_id
    LEFT JOIN history h ON t.id = h.template_id
    WHERE t.user_id = ?
    ${dateFilter}
    GROUP BY t.id
    ORDER BY t.use_count DESC
  `).all(...params) as any[]
  
  return templates.map(t => ({
    ...t,
    avg_rating: t.avg_rating ? parseFloat(t.avg_rating.toFixed(2)) : 0
  }))
}

export function getUsageTrend(templateId: number, period: 'week' | 'month' | 'quarter'): TrendDataPoint[] {
  const range = getDateRange(period)
  const format = period === 'week' ? '%Y-%m-%d' : period === 'month' ? '%Y-%m-%d' : '%Y-%m'
  
  const data = db.prepare(`
    SELECT 
      strftime(?, created_at) as date,
      COUNT(*) as value
    FROM history
    WHERE template_id = ? AND created_at BETWEEN ? AND ?
    GROUP BY strftime(?, created_at)
    ORDER BY date ASC
  `).all(format, templateId, range.start, range.end, format) as any[]
  
  return data
}

export function getFavoriteTrend(templateId: number, period: 'week' | 'month' | 'quarter'): TrendDataPoint[] {
  const range = getDateRange(period)
  const format = period === 'week' ? '%Y-%m-%d' : period === 'month' ? '%Y-%m-%d' : '%Y-%m'
  
  const data = db.prepare(`
    SELECT 
      strftime(?, created_at) as date,
      COUNT(*) as value
    FROM favorites
    WHERE template_id = ? AND created_at BETWEEN ? AND ?
    GROUP BY strftime(?, created_at)
    ORDER BY date ASC
  `).all(format, templateId, range.start, range.end, format) as any[]
  
  return data
}

export function getUserGeography(designerId: number, period?: 'week' | 'month' | 'quarter'): UserProfileInsight[] {
  let dateFilter = ''
  let params: any[] = [designerId]
  
  if (period) {
    const range = getDateRange(period)
    dateFilter = 'AND h.created_at BETWEEN ? AND ?'
    params.push(range.start, range.end)
  }
  
  const totalRow = db.prepare(`
    SELECT COUNT(DISTINCT h.user_id) as total
    FROM history h
    JOIN templates t ON h.template_id = t.id
    WHERE t.user_id = ?
    ${dateFilter}
  `).get(...params) as any
  
  const total = totalRow.total || 1
  
  const regions = db.prepare(`
    SELECT 
      COALESCE(up.region, 'Unknown') as region,
      COALESCE(up.country, 'Unknown') as country,
      COUNT(DISTINCT h.user_id) as count
    FROM history h
    JOIN templates t ON h.template_id = t.id
    JOIN users u ON h.user_id = u.id
    LEFT JOIN user_profiles up ON u.id = up.user_id
    WHERE t.user_id = ?
    ${dateFilter}
    GROUP BY up.region, up.country
    ORDER BY count DESC
    LIMIT 20
  `).all(...params) as any[]
  
  return regions.map(r => ({
    ...r,
    percentage: parseFloat(((r.count / total) * 100).toFixed(2))
  }))
}

export function getCategoryPreferences(designerId: number, period?: 'week' | 'month' | 'quarter'): CategoryPreference[] {
  let dateFilter = ''
  let params: any[] = [designerId]
  
  if (period) {
    const range = getDateRange(period)
    dateFilter = 'AND h.created_at BETWEEN ? AND ?'
    params.push(range.start, range.end)
  }
  
  const totalRow = db.prepare(`
    SELECT COUNT(*) as total
    FROM history h
    JOIN templates t ON h.template_id = t.id
    WHERE t.user_id = ?
    ${dateFilter}
  `).get(...params) as any
  
  const total = totalRow.total || 1
  
  const categories = db.prepare(`
    SELECT 
      t.category,
      COUNT(*) as count
    FROM history h
    JOIN templates t ON h.template_id = t.id
    WHERE t.user_id = ?
    ${dateFilter}
    GROUP BY t.category
    ORDER BY count DESC
  `).all(...params) as any[]
  
  return categories.map(c => ({
    ...c,
    percentage: parseFloat(((c.count / total) * 100).toFixed(2))
  }))
}

export function getRevenueTrend(designerId: number, period: 'week' | 'month' | 'quarter'): RevenueData[] {
  const range = getDateRange(period)
  const format = period === 'week' ? '%Y-%m-%d' : period === 'month' ? '%Y-%m-%d' : '%Y-%m'
  
  const data = db.prepare(`
    SELECT 
      strftime(?, tx.created_at) as date,
      SUM(tx.amount) as amount,
      COUNT(DISTINCT tx.template_id) as template_count
    FROM transactions tx
    JOIN templates t ON tx.template_id = t.id
    WHERE t.user_id = ? AND tx.status = 'completed'
      AND tx.created_at BETWEEN ? AND ?
    GROUP BY strftime(?, tx.created_at)
    ORDER BY date ASC
  `).all(format, designerId, range.start, range.end, format) as any[]
  
  return data
}

export function getTopRevenueTemplates(designerId: number, period?: 'week' | 'month' | 'quarter', limit: number = 10): TopTemplate[] {
  let dateFilter = ''
  let params: any[] = [designerId]
  
  if (period) {
    const range = getDateRange(period)
    dateFilter = 'AND tx.created_at BETWEEN ? AND ?'
    params.push(range.start, range.end)
  }
  
  params.push(limit)
  
  const templates = db.prepare(`
    SELECT 
      t.id,
      t.name,
      t.category,
      SUM(tx.amount) as revenue,
      COUNT(tx.id) as sales_count
    FROM transactions tx
    JOIN templates t ON tx.template_id = t.id
    WHERE t.user_id = ? AND tx.status = 'completed'
      ${dateFilter}
    GROUP BY t.id
    ORDER BY revenue DESC
    LIMIT ?
  `).all(...params) as any[]
  
  return templates.map(t => ({
    ...t,
    revenue: parseFloat(t.revenue.toFixed(2))
  }))
}

export function getTotalRevenue(designerId: number, period?: 'week' | 'month' | 'quarter'): number {
  let dateFilter = ''
  let params: any[] = [designerId]
  
  if (period) {
    const range = getDateRange(period)
    dateFilter = 'AND tx.created_at BETWEEN ? AND ?'
    params.push(range.start, range.end)
  }
  
  const result = db.prepare(`
    SELECT COALESCE(SUM(tx.amount), 0) as total
    FROM transactions tx
    JOIN templates t ON tx.template_id = t.id
    WHERE t.user_id = ? AND tx.status = 'completed'
      ${dateFilter}
  `).get(...params) as any
  
  return parseFloat(result.total.toFixed(2))
}

export function generateOptimizationSuggestions(
  performance: TemplatePerformance[],
  categoryPreferences: CategoryPreference[],
  totalRevenue: number
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = []
  
  if (categoryPreferences.length > 0) {
    const topCategory = categoryPreferences[0]
    if (topCategory.percentage > 40) {
      suggestions.push({
        type: 'category_focus',
        title: `${topCategory.category} 分类最受欢迎`,
        description: `您的${topCategory.category}分类模板贡献了${topCategory.percentage}%的使用量，建议多创作此类模板以获得更多曝光。`,
        priority: 'high',
        icon: 'trending-up'
      })
    }
  }
  
  const highPerformers = performance.filter(p => p.avg_rating >= 4.5 && p.use_count > 50)
  if (highPerformers.length > 0) {
    const top = highPerformers[0]
    suggestions.push({
      type: 'high_performer',
      title: `优质模板「${top.name}」表现出色`,
      description: `该模板平均评分${top.avg_rating}，已被使用${top.use_count}次。建议基于此模板创作更多变体。`,
      priority: 'high',
      icon: 'star'
    })
  }
  
  const lowPerformers = performance.filter(p => p.avg_rating < 3 && p.use_count > 10)
  if (lowPerformers.length > 0) {
    const low = lowPerformers[0]
    suggestions.push({
      type: 'low_performer',
      title: `模板「${low.name}」需要优化`,
      description: `该模板平均评分仅${low.avg_rating}，建议检查模板质量或收集用户反馈进行改进。`,
      priority: 'medium',
      icon: 'alert-circle'
    })
  }
  
  if (performance.length > 0) {
    const avgFavorites = performance.reduce((sum, p) => sum + p.favorite_count, 0) / performance.length
    if (avgFavorites < 5) {
      suggestions.push({
        type: 'engagement',
        title: '提升用户收藏',
        description: '您的模板平均收藏数较低，建议优化模板预览图和描述，吸引更多用户收藏。',
        priority: 'medium',
        icon: 'heart'
      })
    }
  }
  
  if (totalRevenue === 0 && performance.length > 5) {
    suggestions.push({
      type: 'monetization',
      title: '开启模板变现',
      description: '您已有多个优质模板，可以考虑设置付费模板以获得收入。',
      priority: 'low',
      icon: 'dollar-sign'
    })
  }
  
  const untagged = performance.filter(p => !p.name.includes('标签') && p.use_count > 20)
  if (untagged.length > 3) {
    suggestions.push({
      type: 'tags',
      title: '完善模板标签',
      description: '部分热门模板缺少相关标签，添加更多标签可以提升搜索曝光率。',
      priority: 'medium',
      icon: 'tag'
    })
  }
  
  return suggestions.slice(0, 6)
}
