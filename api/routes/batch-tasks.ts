import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import taskQueue from '../taskQueue.js'

const router = Router()

router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, name } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'Items array is required' })
      return
    }

    const taskItems = items.map((item: any) => ({
      templateId: item.templateId,
      designImageUrl: item.designImageUrl,
      exportWidth: item.exportWidth,
      exportHeight: item.exportHeight,
      exportFormat: item.exportFormat || 'png',
      offsetX: item.offsetX || 0,
      offsetY: item.offsetY || 0,
      scaleX: item.scaleX || 1.0,
      scaleY: item.scaleY || 1.0
    }))

    const taskName = name || `批量生成任务 (${new Date().toLocaleString()})`
    const taskId = taskQueue.createTask(req.user!.id, taskName, taskItems)

    taskQueue.processTask(taskId, req.user!.id)

    res.json({
      success: true,
      data: { taskId }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:taskId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseInt(req.params.taskId)

    const task = db.prepare('SELECT * FROM batch_tasks WHERE id = ?').get(taskId) as any
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' })
      return
    }

    if (task.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    const progress = taskQueue.getTaskProgress(taskId)

    res.json({
      success: true,
      data: progress
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:taskId/items', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseInt(req.params.taskId)
    const { page = '1', limit = '50', status } = req.query

    const task = db.prepare('SELECT * FROM batch_tasks WHERE id = ?').get(taskId) as any
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' })
      return
    }

    if (task.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50))
    const offset = (pageNum - 1) * limitNum

    let whereClause = 'WHERE bi.task_id = ?'
    const params: any[] = [taskId]

    if (status) {
      whereClause += ' AND bi.status = ?'
      params.push(status)
    }

    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM batch_task_items bi ${whereClause}`
    ).get(...params) as any

    const items = db.prepare(
      `SELECT bi.*, t.name as template_name 
       FROM batch_task_items bi
       JOIN templates t ON bi.template_id = t.id
       ${whereClause}
       ORDER BY bi.id ASC
       LIMIT ? OFFSET ?`
    ).all(...params, limitNum, offset) as any[]

    res.json({
      success: true,
      data: {
        items: items.map(item => ({
          id: item.id,
          templateId: item.template_id,
          templateName: item.template_name,
          designImageUrl: item.design_image_url,
          status: item.status,
          resultImageUrl: item.result_image_url,
          errorMessage: item.error_message,
          historyId: item.history_id,
          createdAt: item.created_at,
          completedAt: item.completed_at
        })),
        total: countRow.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(countRow.total / limitNum)
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/:taskId/pause', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseInt(req.params.taskId)

    const task = db.prepare('SELECT * FROM batch_tasks WHERE id = ?').get(taskId) as any
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' })
      return
    }

    if (task.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    if (task.status !== 'running') {
      res.status(400).json({ success: false, error: 'Task is not running' })
      return
    }

    taskQueue.pauseTask(taskId)

    res.json({
      success: true,
      data: { message: 'Task paused' }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/:taskId/resume', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseInt(req.params.taskId)

    const task = db.prepare('SELECT * FROM batch_tasks WHERE id = ?').get(taskId) as any
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' })
      return
    }

    if (task.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    if (task.status !== 'paused') {
      res.status(400).json({ success: false, error: 'Task is not paused' })
      return
    }

    taskQueue.resumeTask(taskId, req.user!.id)

    res.json({
      success: true,
      data: { message: 'Task resumed' }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/:taskId/cancel', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseInt(req.params.taskId)

    const task = db.prepare('SELECT * FROM batch_tasks WHERE id = ?').get(taskId) as any
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' })
      return
    }

    if (task.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    if (!['running', 'paused', 'pending'].includes(task.status)) {
      res.status(400).json({ success: false, error: 'Task cannot be cancelled' })
      return
    }

    taskQueue.cancelTask(taskId)

    res.json({
      success: true,
      data: { message: 'Task cancelled' }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/:taskId/retry', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const taskId = parseInt(req.params.taskId)

    const task = db.prepare('SELECT * FROM batch_tasks WHERE id = ?').get(taskId) as any
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' })
      return
    }

    if (task.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    const failedCount = db.prepare(
      "SELECT COUNT(*) as count FROM batch_task_items WHERE task_id = ? AND status = 'failed'"
    ).get(taskId) as any

    if (failedCount.count === 0) {
      res.status(400).json({ success: false, error: 'No failed items to retry' })
      return
    }

    const newTaskId = taskQueue.retryFailedItems(taskId, req.user!.id)

    res.json({
      success: true,
      data: { newTaskId, retryCount: failedCount.count }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', status } = req.query

    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20))
    const offset = (pageNum - 1) * limitNum

    let whereClause = 'WHERE user_id = ?'
    const params: any[] = [req.user!.id]

    if (status) {
      whereClause += ' AND status = ?'
      params.push(status)
    }

    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM batch_tasks ${whereClause}`
    ).get(...params) as any

    const tasks = db.prepare(
      `SELECT * FROM batch_tasks ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limitNum, offset) as any[]

    res.json({
      success: true,
      data: {
        tasks: tasks.map(task => ({
          id: task.id,
          name: task.name,
          status: task.status,
          totalCount: task.total_count,
          successCount: task.success_count,
          failedCount: task.failed_count,
          currentIndex: task.current_index,
          createdAt: task.created_at,
          startedAt: task.started_at,
          completedAt: task.completed_at
        })),
        total: countRow.total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(countRow.total / limitNum)
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
