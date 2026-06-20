import { Router, type Request, type Response } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  getTemplatePerformance,
  getUsageTrend,
  getFavoriteTrend,
  getUserGeography,
  getCategoryPreferences,
  getRevenueTrend,
  getTopRevenueTemplates,
  getTotalRevenue,
  getDateRange,
  generateOptimizationSuggestions
} from '../utils/analytics.js'
import type {
  TemplatePerformance,
  TrendDataPoint,
  UserProfileInsight,
  CategoryPreference,
  RevenueData,
  TopTemplate,
  OptimizationSuggestion
} from '../utils/analytics.js'
import { generateAnalyticsPDF, type ReportData } from '../utils/pdfGenerator.js'
import { createExportRecord, updateExportRecord } from '../utils/export.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

type Period = 'week' | 'month' | 'quarter'

function validatePeriod(period: string): Period {
  if (['week', 'month', 'quarter'].includes(period)) {
    return period as Period
  }
  return 'month'
}

router.get('/templates/performance', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { period } = req.query
    const userId = req.user!.id
    const validPeriod = period ? validatePeriod(period as string) : undefined
    
    const performance = getTemplatePerformance(userId, validPeriod)
    
    res.json({
      success: true,
      data: performance
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/templates/:id/trends', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'month' } = req.query
    const templateId = parseInt(req.params.id)
    const validPeriod = validatePeriod(period as string)
    
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as any
    
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' })
      return
    }
    
    if (template.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }
    
    const usageTrend = getUsageTrend(templateId, validPeriod)
    const favoriteTrend = getFavoriteTrend(templateId, validPeriod)
    
    res.json({
      success: true,
      data: {
        usageTrend,
        favoriteTrend
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/users/geography', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { period } = req.query
    const userId = req.user!.id
    const validPeriod = period ? validatePeriod(period as string) : undefined
    
    const geography = getUserGeography(userId, validPeriod)
    
    res.json({
      success: true,
      data: geography
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/users/category-preferences', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { period } = req.query
    const userId = req.user!.id
    const validPeriod = period ? validatePeriod(period as string) : undefined
    
    const preferences = getCategoryPreferences(userId, validPeriod)
    
    res.json({
      success: true,
      data: preferences
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/revenue/trend', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'month' } = req.query
    const userId = req.user!.id
    const validPeriod = validatePeriod(period as string)
    
    const trend = getRevenueTrend(userId, validPeriod)
    
    res.json({
      success: true,
      data: trend
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/revenue/top-templates', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { period, limit = '10' } = req.query
    const userId = req.user!.id
    const validPeriod = period ? validatePeriod(period as string) : undefined
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 10))
    
    const topTemplates = getTopRevenueTemplates(userId, validPeriod, limitNum)
    
    res.json({
      success: true,
      data: topTemplates
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/suggestions', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { period } = req.query
    const userId = req.user!.id
    const validPeriod = period ? validatePeriod(period as string) : undefined
    
    const performance = getTemplatePerformance(userId, validPeriod)
    const categoryPreferences = getCategoryPreferences(userId, validPeriod)
    const totalRevenue = getTotalRevenue(userId, validPeriod)
    
    const suggestions = generateOptimizationSuggestions(performance, categoryPreferences, totalRevenue)
    
    res.json({
      success: true,
      data: suggestions
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/summary', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'month' } = req.query
    const userId = req.user!.id
    const validPeriod = validatePeriod(period as string)
    const dateRange = getDateRange(validPeriod)
    
    const performance = getTemplatePerformance(userId, validPeriod)
    const categoryPreferences = getCategoryPreferences(userId, validPeriod)
    const geography = getUserGeography(userId, validPeriod)
    const revenueTrend = getRevenueTrend(userId, validPeriod)
    const topRevenueTemplates = getTopRevenueTemplates(userId, validPeriod)
    const totalRevenue = getTotalRevenue(userId, validPeriod)
    const suggestions = generateOptimizationSuggestions(performance, categoryPreferences, totalRevenue)
    
    const totalTemplates = performance.length
    const totalUses = performance.reduce((sum, p) => sum + p.use_count, 0)
    const avgRating = totalTemplates > 0
      ? performance.reduce((sum, p) => sum + p.avg_rating, 0) / totalTemplates
      : 0
    const totalFavorites = performance.reduce((sum, p) => sum + p.favorite_count, 0)
    
    const usageTrends: Record<number, TrendDataPoint[]> = {}
    const favoriteTrends: Record<number, TrendDataPoint[]> = {}
    
    for (const tpl of performance.slice(0, 5)) {
      usageTrends[tpl.id] = getUsageTrend(tpl.id, validPeriod)
      favoriteTrends[tpl.id] = getFavoriteTrend(tpl.id, validPeriod)
    }
    
    res.json({
      success: true,
      data: {
        period: validPeriod,
        dateRange,
        summary: {
          totalTemplates,
          totalUses,
          avgRating: parseFloat(avgRating.toFixed(2)),
          totalFavorites,
          totalRevenue
        },
        templatePerformance: performance,
        usageTrends,
        favoriteTrends,
        userGeography: geography,
        categoryPreferences,
        revenueTrend,
        topRevenueTemplates,
        suggestions
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/report/pdf', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'month' } = req.query
    const userId = req.user!.id
    const validPeriod = validatePeriod(period as string)
    const dateRange = getDateRange(validPeriod)
    
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any
    
    const performance = getTemplatePerformance(userId, validPeriod)
    const categoryPreferences = getCategoryPreferences(userId, validPeriod)
    const geography = getUserGeography(userId, validPeriod)
    const revenueTrend = getRevenueTrend(userId, validPeriod)
    const topRevenueTemplates = getTopRevenueTemplates(userId, validPeriod)
    const totalRevenue = getTotalRevenue(userId, validPeriod)
    const suggestions = generateOptimizationSuggestions(performance, categoryPreferences, totalRevenue)
    
    const totalTemplates = performance.length
    const totalUses = performance.reduce((sum, p) => sum + p.use_count, 0)
    const avgRating = totalTemplates > 0
      ? performance.reduce((sum, p) => sum + p.avg_rating, 0) / totalTemplates
      : 0
    const totalFavorites = performance.reduce((sum, p) => sum + p.favorite_count, 0)
    
    const usageTrends: Record<number, TrendDataPoint[]> = {}
    const favoriteTrends: Record<number, TrendDataPoint[]> = {}
    
    for (const tpl of performance.slice(0, 5)) {
      usageTrends[tpl.id] = getUsageTrend(tpl.id, validPeriod)
      favoriteTrends[tpl.id] = getFavoriteTrend(tpl.id, validPeriod)
    }
    
    const exportRecordId = createExportRecord(userId, 'analytics_report', 'pdf', { period: validPeriod })
    
    const reportData: ReportData = {
      designerName: user?.name || '设计师',
      period: validPeriod,
      dateRange,
      generatedAt: new Date().toLocaleString('zh-CN'),
      summary: {
        totalTemplates,
        totalUses,
        avgRating: parseFloat(avgRating.toFixed(2)),
        totalFavorites,
        totalRevenue
      },
      templatePerformance: performance,
      usageTrends,
      favoriteTrends,
      userGeography: geography,
      categoryPreferences,
      revenueTrend,
      topRevenueTemplates,
      suggestions
    }
    
    const filePath = generateAnalyticsPDF(reportData)
    
    updateExportRecord(exportRecordId, 'completed', filePath)
    
    const filename = path.basename(filePath)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    
    fs.createReadStream(filePath).pipe(res)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/templates/:id/rate', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const templateId = parseInt(req.params.id)
    const { rating, comment } = req.body
    const userId = req.user!.id
    
    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' })
      return
    }
    
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as any
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' })
      return
    }
    
    db.prepare(`
      INSERT INTO template_ratings (user_id, template_id, rating, comment)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, template_id) DO UPDATE SET
        rating = excluded.rating,
        comment = excluded.comment,
        created_at = datetime('now')
    `).run(userId, templateId, rating, comment || null)
    
    res.json({ success: true, data: { message: 'Rating submitted' } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/templates/:id/favorite', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const templateId = parseInt(req.params.id)
    const userId = req.user!.id
    
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as any
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' })
      return
    }
    
    try {
      db.prepare(`
        INSERT INTO favorites (user_id, template_id)
        VALUES (?, ?)
      `).run(userId, templateId)
      res.json({ success: true, data: { message: 'Added to favorites', isFavorite: true } })
    } catch {
      db.prepare(`
        DELETE FROM favorites WHERE user_id = ? AND template_id = ?
      `).run(userId, templateId)
      res.json({ success: true, data: { message: 'Removed from favorites', isFavorite: false } })
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/favorites', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query
    const userId = req.user!.id
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20))
    const offset = (pageNum - 1) * limitNum
    
    const countRow = db.prepare(`
      SELECT COUNT(*) as total FROM favorites f
      JOIN templates t ON f.template_id = t.id
      WHERE f.user_id = ?
    `).get(userId) as any
    const total = countRow.total
    
    const items = db.prepare(`
      SELECT f.id, f.template_id, f.created_at,
             t.name, t.category, t.image_url, t.use_count
      FROM favorites f
      JOIN templates t ON f.template_id = t.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limitNum, offset) as any[]
    
    res.json({
      success: true,
      data: {
        items,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
