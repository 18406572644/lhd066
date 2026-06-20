import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware, optionalAuth } from '../middleware/auth.js'
import { runQualityInspection, getQualityReport } from '../utils/quality.js'

const router = Router()

router.post('/inspect/:templateId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.templateId) as any
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' })
      return
    }

    if (template.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    const report = await runQualityInspection(parseInt(req.params.templateId))

    res.json({ success: true, data: report })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/report/:templateId', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.templateId) as any
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' })
      return
    }

    if (template.permission !== 'public') {
      if (!req.user || (req.user.id !== template.user_id && req.user.role !== 'admin')) {
        res.status(403).json({ success: false, error: 'Access denied' })
        return
      }
    }

    const report = getQualityReport(parseInt(req.params.templateId))
    if (!report) {
      res.status(404).json({ success: false, error: 'Quality report not found, run inspection first' })
      return
    }

    res.json({ success: true, data: report })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/pending-reviews', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Admin only' })
      return
    }

    const { page = '1', limit = '20' } = req.query
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20))
    const offset = (pageNum - 1) * limitNum

    const countRow = db.prepare(
      "SELECT COUNT(*) as total FROM quality_reports WHERE review_status = 'pending'"
    ).get() as any

    const reports = db.prepare(`
      SELECT qr.*, t.name as template_name, t.image_url, t.category, u.name as uploader_name
      FROM quality_reports qr
      JOIN templates t ON qr.template_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE qr.review_status = 'pending'
      ORDER BY qr.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limitNum, offset) as any[]

    const mapped = reports.map(r => ({
      id: r.id,
      templateId: r.template_id,
      templateName: r.template_name,
      imageUrl: r.image_url,
      category: r.category,
      uploaderName: r.uploader_name,
      totalScore: r.total_score,
      grade: r.grade,
      issues: JSON.parse(r.issues),
      reviewStatus: r.review_status,
      createdAt: r.created_at,
    }))

    res.json({
      success: true,
      data: {
        items: mapped,
        total: countRow.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(countRow.total / limitNum),
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/review/:templateId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Admin only' })
      return
    }

    const { action } = req.body
    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ success: false, error: 'Action must be approve or reject' })
      return
    }

    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.templateId) as any
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' })
      return
    }

    const reviewStatus = action === 'approve' ? 'approved' : 'rejected'

    db.prepare(
      "UPDATE quality_reports SET review_status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE template_id = ?"
    ).run(reviewStatus, req.user!.id, req.params.templateId)

    db.prepare(
      'UPDATE templates SET review_status = ? WHERE id = ?'
    ).run(reviewStatus, req.params.templateId)

    if (action === 'approve') {
      db.prepare(
        "UPDATE templates SET permission = 'public' WHERE id = ? AND permission = 'restricted'"
      ).run(req.params.templateId)
    }

    const report = getQualityReport(parseInt(req.params.templateId))

    res.json({ success: true, data: report })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/auto-tag/:templateId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.templateId) as any
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' })
      return
    }

    if (template.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    const report = await runQualityInspection(parseInt(req.params.templateId))

    res.json({ success: true, data: { autoTags: report.autoTags } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
