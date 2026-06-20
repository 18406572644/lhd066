import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.get('/overview', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Admin access required' })
      return
    }

    const totalTemplates = (db.prepare('SELECT COUNT(*) as count FROM templates').get() as any).count
    const totalGenerations = (db.prepare('SELECT COUNT(*) as count FROM history').get() as any).count
    const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count
    const todayGenerations = (db.prepare(
      "SELECT COUNT(*) as count FROM history WHERE date(created_at) = date('now')"
    ).get() as any).count

    res.json({
      success: true,
      data: { totalTemplates, totalGenerations, totalUsers, todayGenerations }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/popular-templates', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Admin access required' })
      return
    }

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10))

    const templates = db.prepare(
      'SELECT id, name, category, use_count, created_at FROM templates ORDER BY use_count DESC LIMIT ?'
    ).all(limit)

    res.json({ success: true, data: templates })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
