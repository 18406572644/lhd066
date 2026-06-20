import { Router, type Request, type Response } from 'express'
import path from 'path'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.resolve(__dirname, '..', '..')

const router = Router()

router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20))
    const offset = (pageNum - 1) * limitNum

    const countRow = db.prepare('SELECT COUNT(*) as total FROM history WHERE user_id = ?').get(req.user!.id) as any
    const total = countRow.total

    const items = db.prepare(
      `SELECT h.*, t.name as template_name
       FROM history h
       JOIN templates t ON h.template_id = t.id
       WHERE h.user_id = ?
       ORDER BY h.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(req.user!.id, limitNum, offset) as any[]

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

router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const item = db.prepare(
      `SELECT h.*, t.name as template_name
       FROM history h
       JOIN templates t ON h.template_id = t.id
       WHERE h.id = ?`
    ).get(req.params.id) as any

    if (!item) {
      res.status(404).json({ success: false, error: 'History item not found' })
      return
    }

    if (item.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    res.json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const item = db.prepare('SELECT * FROM history WHERE id = ?').get(req.params.id) as any
    if (!item) {
      res.status(404).json({ success: false, error: 'History item not found' })
      return
    }

    if (item.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    db.prepare('DELETE FROM history WHERE id = ?').run(req.params.id)

    res.json({ success: true, data: { message: 'History item deleted' } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id/download', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const item = db.prepare('SELECT * FROM history WHERE id = ?').get(req.params.id) as any
    if (!item) {
      res.status(404).json({ success: false, error: 'History item not found' })
      return
    }

    if (item.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    const filePath = path.resolve(projectRoot, item.result_image_url.replace(/^\//, ''))
    res.download(filePath)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
