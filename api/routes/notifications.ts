import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', unread } = req.query

    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20))
    const offset = (pageNum - 1) * limitNum

    let whereClause = 'WHERE user_id = ?'
    const params: any[] = [req.user!.id]

    if (unread === 'true') {
      whereClause += ' AND is_read = 0'
    }

    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM notifications ${whereClause}`
    ).get(...params) as any

    const notifications = db.prepare(
      `SELECT * FROM notifications ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limitNum, offset) as any[]

    const unreadCount = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(req.user!.id) as any

    res.json({
      success: true,
      data: {
        notifications: notifications.map(n => ({
          id: n.id,
          type: n.type,
          title: n.title,
          content: n.content,
          taskId: n.task_id,
          isRead: n.is_read === 1,
          createdAt: n.created_at
        })),
        total: countRow.total,
        unreadCount: unreadCount.count,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(countRow.total / limitNum)
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/:id/read', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)

    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any
    if (!notification) {
      res.status(404).json({ success: false, error: 'Notification not found' })
      return
    }

    if (notification.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id)

    res.json({
      success: true,
      data: { message: 'Notification marked as read' }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/read-all', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user!.id)

    res.json({
      success: true,
      data: { message: 'All notifications marked as read' }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)

    const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as any
    if (!notification) {
      res.status(404).json({ success: false, error: 'Notification not found' })
      return
    }

    if (notification.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    db.prepare('DELETE FROM notifications WHERE id = ?').run(id)

    res.json({
      success: true,
      data: { message: 'Notification deleted' }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
