import path from 'path'
import sharp from 'sharp'
import db from './db.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

interface TaskItem {
  id: number
  taskId: number
  templateId: number
  designImageUrl: string
  exportWidth: number
  exportHeight: number
  exportFormat: string
  offsetX: number
  offsetY: number
  scaleX: number
  scaleY: number
}

class TaskQueueManager {
  private runningTasks: Set<number> = new Set()
  private taskAbortControllers: Map<number, AbortController> = new Map()
  private pausedTasks: Set<number> = new Set()

  constructor() {
    this.resumePendingTasks()
  }

  private resumePendingTasks() {
    const runningTasks = db.prepare(
      "SELECT id FROM batch_tasks WHERE status IN ('running', 'paused')"
    ).all() as { id: number }[]
    
    for (const task of runningTasks) {
      db.prepare("UPDATE batch_tasks SET status = 'paused' WHERE id = ?").run(task.id)
    }
  }

  private imageUrlToFilePath(url: string): string {
    const relativePath = url.replace(/^\/uploads\//, 'uploads/')
    return path.resolve(projectRoot, relativePath)
  }

  async processTask(taskId: number, userId: number) {
    if (this.runningTasks.has(taskId)) {
      return
    }

    this.runningTasks.add(taskId)
    const abortController = new AbortController()
    this.taskAbortControllers.set(taskId, abortController)

    try {
      db.prepare(
        "UPDATE batch_tasks SET status = 'running', started_at = datetime('now') WHERE id = ?"
      ).run(taskId)

      const task = db.prepare('SELECT * FROM batch_tasks WHERE id = ?').get(taskId) as any
      if (!task) {
        throw new Error('Task not found')
      }

      while (true) {
        if (abortController.signal.aborted) {
          break
        }

        if (this.pausedTasks.has(taskId)) {
          await new Promise(resolve => setTimeout(resolve, 500))
          continue
        }

        const item = db.prepare(
          `SELECT * FROM batch_task_items 
           WHERE task_id = ? AND status = 'pending' 
           ORDER BY id ASC LIMIT 1`
        ).get(taskId) as TaskItem | undefined

        if (!item) {
          break
        }

        await this.processTaskItem(item, userId, abortController.signal)

        const stats = db.prepare(
          `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status IN ('success', 'failed', 'skipped') THEN 1 ELSE 0 END) as completed
           FROM batch_task_items WHERE task_id = ?`
        ).get(taskId) as any

        const currentIndex = db.prepare(
          `SELECT COUNT(*) as count FROM batch_task_items 
           WHERE task_id = ? AND status IN ('success', 'failed', 'skipped', 'processing')`
        ).get(taskId) as any

        db.prepare(
          `UPDATE batch_tasks SET 
            current_index = ?,
            success_count = ?,
            failed_count = ?
           WHERE id = ?`
        ).run(currentIndex.count, stats.success, stats.failed, taskId)

        if (stats.total === stats.completed) {
          break
        }
      }

      const finalStats = db.prepare(
        `SELECT 
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          COUNT(*) as total
         FROM batch_task_items WHERE task_id = ?`
      ).get(taskId) as any

      if (abortController.signal.aborted) {
        db.prepare(
          "UPDATE batch_task_items SET status = 'skipped' WHERE task_id = ? AND status = 'pending'"
        ).run(taskId)
      } else {
        db.prepare(
          `UPDATE batch_tasks SET 
            status = 'completed',
            completed_at = datetime('now'),
            success_count = ?,
            failed_count = ?
           WHERE id = ?`
        ).run(finalStats.success, finalStats.failed, taskId)

        this.createNotification(userId, taskId, finalStats)
      }
    } catch (error: any) {
      db.prepare(
        `UPDATE batch_tasks SET status = 'failed', completed_at = datetime('now') WHERE id = ?`
      ).run(taskId)
      
      db.prepare(
        `INSERT INTO notifications (user_id, type, title, content, task_id)
         VALUES (?, 'error', '批量任务执行失败', ?, ?)`
      ).run(userId, error.message, taskId)
    } finally {
      this.runningTasks.delete(taskId)
      this.taskAbortControllers.delete(taskId)
      this.pausedTasks.delete(taskId)
    }
  }

  private async processTaskItem(item: TaskItem, userId: number, signal: AbortSignal) {
    if (signal.aborted) return

    db.prepare("UPDATE batch_task_items SET status = 'processing' WHERE id = ?").run(item.id)

    try {
      const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(item.templateId) as any
      if (!template) {
        throw new Error('Template not found')
      }

      const templatePath = this.imageUrlToFilePath(template.image_url)
      const designPath = this.imageUrlToFilePath(item.designImageUrl)

      const finalWidth = Math.round(template.fit_width * item.scaleX)
      const finalHeight = Math.round(template.fit_height * item.scaleY)
      const posX = Math.round(template.fit_x + item.offsetX)
      const posY = Math.round(template.fit_y + item.offsetY)

      const resizedDesign = await sharp(designPath)
        .resize(finalWidth, finalHeight, { fit: 'fill' })
        .toBuffer()

      const compositeX = Math.round(item.exportWidth * (posX / template.width))
      const compositeY = Math.round(item.exportHeight * (posY / template.height))

      const formatMethod = item.exportFormat === 'jpg' ? 'jpeg' : item.exportFormat === 'webp' ? 'webp' : 'png'
      const ext = item.exportFormat === 'jpg' ? 'jpg' : item.exportFormat === 'webp' ? 'webp' : 'png'

      const resultBuffer = await sharp(templatePath)
        .resize(item.exportWidth, item.exportHeight)
        .composite([{
          input: resizedDesign,
          left: compositeX,
          top: compositeY
        }])
        [formatMethod as 'jpeg' | 'webp' | 'png']({ quality: 90 })
        .toBuffer()

      const timestamp = Date.now()
      const resultFilename = `result-${timestamp}-${item.id}.${ext}`
      const resultPath = path.resolve(projectRoot, 'uploads', 'results', resultFilename)

      await sharp(resultBuffer).toFile(resultPath)

      const resultImageUrl = `/uploads/results/${resultFilename}`

      const historyResult = db.prepare(
        `INSERT INTO history (user_id, template_id, design_image_url, result_image_url, export_width, export_height, export_format, offset_x, offset_y, scale_x, scale_y)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        userId,
        item.templateId,
        item.designImageUrl,
        resultImageUrl,
        item.exportWidth,
        item.exportHeight,
        item.exportFormat,
        item.offsetX,
        item.offsetY,
        item.scaleX,
        item.scaleY
      )

      db.prepare('UPDATE templates SET use_count = use_count + 1 WHERE id = ?').run(item.templateId)

      db.prepare(
        `UPDATE batch_task_items SET 
          status = 'success', 
          result_image_url = ?, 
          history_id = ?,
          completed_at = datetime('now')
         WHERE id = ?`
      ).run(resultImageUrl, historyResult.lastInsertRowid, item.id)

    } catch (error: any) {
      db.prepare(
        `UPDATE batch_task_items SET 
          status = 'failed', 
          error_message = ?,
          completed_at = datetime('now')
         WHERE id = ?`
      ).run(error.message, item.id)
    }
  }

  pauseTask(taskId: number) {
    this.pausedTasks.add(taskId)
    db.prepare("UPDATE batch_tasks SET status = 'paused' WHERE id = ?").run(taskId)
  }

  resumeTask(taskId: number, userId: number) {
    this.pausedTasks.delete(taskId)
    if (!this.runningTasks.has(taskId)) {
      this.processTask(taskId, userId)
    }
  }

  cancelTask(taskId: number) {
    const abortController = this.taskAbortControllers.get(taskId)
    if (abortController) {
      abortController.abort()
    }
    this.pausedTasks.delete(taskId)
    db.prepare(
      `UPDATE batch_tasks SET 
        status = 'cancelled', 
        completed_at = datetime('now') 
       WHERE id = ?`
    ).run(taskId)
    db.prepare(
      "UPDATE batch_task_items SET status = 'skipped' WHERE task_id = ? AND status IN ('pending', 'processing')"
    ).run(taskId)
  }

  private createNotification(userId: number, taskId: number, stats: any) {
    const hasErrors = stats.failed > 0
    const type = hasErrors ? 'warning' : 'success'
    const title = hasErrors ? '批量任务完成（含错误）' : '批量任务完成'
    const content = `成功 ${stats.success} 项，失败 ${stats.failed} 项，共 ${stats.total} 项`

    db.prepare(
      `INSERT INTO notifications (user_id, type, title, content, task_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(userId, type, title, content, taskId)
  }

  getTaskProgress(taskId: number) {
    const task = db.prepare('SELECT * FROM batch_tasks WHERE id = ?').get(taskId) as any
    if (!task) return null

    const currentItem = db.prepare(
      `SELECT bi.*, t.name as template_name 
       FROM batch_task_items bi
       JOIN templates t ON bi.template_id = t.id
       WHERE bi.task_id = ? AND bi.status IN ('processing', 'pending')
       ORDER BY bi.id ASC LIMIT 1`
    ).get(taskId) as any

    const recentItems = db.prepare(
      `SELECT bi.*, t.name as template_name 
       FROM batch_task_items bi
       JOIN templates t ON bi.template_id = t.id
       WHERE bi.task_id = ? AND bi.status IN ('success', 'failed')
       ORDER BY bi.id DESC LIMIT 10`
    ).all(taskId) as any[]

    return {
      task,
      currentItem: currentItem || null,
      recentItems: recentItems.reverse(),
      progress: task.total_count > 0 
        ? Math.round(((task.success_count + task.failed_count) / task.total_count) * 100) 
        : 0
    }
  }

  createTask(userId: number, name: string, items: Omit<TaskItem, 'id' | 'taskId'>[]): number {
    const tx = db.transaction(() => {
      const taskResult = db.prepare(
        `INSERT INTO batch_tasks (user_id, name, total_count) VALUES (?, ?, ?)`
      ).run(userId, name, items.length)

      const taskId = taskResult.lastInsertRowid as number

      const insertItem = db.prepare(
        `INSERT INTO batch_task_items 
          (task_id, template_id, design_image_url, export_width, export_height, 
           export_format, offset_x, offset_y, scale_x, scale_y)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )

      for (const item of items) {
        insertItem.run(
          taskId,
          item.templateId,
          item.designImageUrl,
          item.exportWidth,
          item.exportHeight,
          item.exportFormat,
          item.offsetX,
          item.offsetY,
          item.scaleX,
          item.scaleY
        )
      }

      return taskId
    })

    return tx()
  }

  retryFailedItems(taskId: number, userId: number): number {
    const failedItems = db.prepare(
      `SELECT * FROM batch_task_items WHERE task_id = ? AND status = 'failed'`
    ).all(taskId) as any[]

    if (failedItems.length === 0) {
      return 0
    }

    const originalTask = db.prepare('SELECT * FROM batch_tasks WHERE id = ?').get(taskId) as any
    const newTaskName = `${originalTask.name}（重试失败项）`

    const newTaskId = this.createTask(userId, newTaskName, failedItems.map(item => ({
      templateId: item.template_id,
      designImageUrl: item.design_image_url,
      exportWidth: item.export_width,
      exportHeight: item.export_height,
      exportFormat: item.export_format,
      offsetX: item.offset_x,
      offsetY: item.offset_y,
      scaleX: item.scale_x,
      scaleY: item.scale_y
    })))

    this.processTask(newTaskId, userId)
    return newTaskId
  }
}

export const taskQueue = new TaskQueueManager()
export default taskQueue
