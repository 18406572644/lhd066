import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { authMiddleware, optionalAuth } from '../middleware/auth.js'
import { templateUpload } from '../middleware/upload.js'

const router = Router()

router.get('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, tag, keyword, page = '1', limit = '20' } = req.query
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20))
    const offset = (pageNum - 1) * limitNum

    let whereClauses: string[] = []
    let params: any[] = []

    if (req.user) {
      whereClauses.push('(t.permission = \'public\' OR t.user_id = ?)')
      params.push(req.user.id)
    } else {
      whereClauses.push('t.permission = \'public\'')
    }

    if (category) {
      whereClauses.push('t.category = ?')
      params.push(category)
    }

    if (keyword) {
      whereClauses.push('t.name LIKE ?')
      params.push(`%${keyword}%`)
    }

    if (tag) {
      whereClauses.push('t.id IN (SELECT tt.template_id FROM template_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE tg.name = ?)')
      params.push(tag)
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM templates t ${whereStr}`).get(...params) as any
    const total = countRow.total

    const templates = db.prepare(
      `SELECT t.* FROM templates t ${whereStr} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limitNum, offset) as any[]

    const templateIds = templates.map(t => t.id)

    let tagsMap: Record<number, string[]> = {}
    if (templateIds.length > 0) {
      const placeholders = templateIds.map(() => '?').join(',')
      const tagRows = db.prepare(
        `SELECT tt.template_id, tg.name FROM template_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE tt.template_id IN (${placeholders})`
      ).all(...templateIds) as any[]

      for (const row of tagRows) {
        if (!tagsMap[row.template_id]) tagsMap[row.template_id] = []
        tagsMap[row.template_id].push(row.name)
      }
    }

    const result = templates.map(t => ({
      ...t,
      tags: tagsMap[t.id] || []
    }))

    res.json({
      success: true,
      data: {
        items: result,
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

router.get('/:id', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as any
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

    const tagRows = db.prepare(
      'SELECT tg.name FROM template_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE tt.template_id = ?'
    ).all(req.params.id) as any[]

    res.json({
      success: true,
      data: { ...template, tags: tagRows.map(t => t.name) }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/', authMiddleware, templateUpload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, category, width, height, fit_x, fit_y, fit_width, fit_height, permission, tags } = req.body
    const imageUrl = req.file ? `/uploads/templates/${req.file.filename}` : req.body.image_url

    if (!name || !category || !imageUrl) {
      res.status(400).json({ success: false, error: 'Name, category and image are required' })
      return
    }

    const result = db.prepare(
      `INSERT INTO templates (user_id, name, category, width, height, image_url, fit_x, fit_y, fit_width, fit_height, permission)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user!.id,
      name,
      category,
      parseInt(width) || 0,
      parseInt(height) || 0,
      imageUrl,
      parseInt(fit_x) || 0,
      parseInt(fit_y) || 0,
      parseInt(fit_width) || 0,
      parseInt(fit_height) || 0,
      permission || 'public'
    )

    const templateId = result.lastInsertRowid

    if (tags) {
      const tagNames = typeof tags === 'string' ? JSON.parse(tags) : tags
      if (Array.isArray(tagNames)) {
        const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
        const findTag = db.prepare('SELECT id FROM tags WHERE name = ?')
        const linkTag = db.prepare('INSERT INTO template_tags (template_id, tag_id) VALUES (?, ?)')

        for (const tagName of tagNames) {
          insertTag.run(tagName)
          const tagRow = findTag.get(tagName) as any
          if (tagRow) {
            linkTag.run(templateId, tagRow.id)
          }
        }
      }
    }

    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as any
    const tagRows = db.prepare(
      'SELECT tg.name FROM template_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE tt.template_id = ?'
    ).all(templateId) as any[]

    res.status(201).json({
      success: true,
      data: { ...template, tags: tagRows.map(t => t.name) }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id', authMiddleware, templateUpload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as any
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' })
      return
    }

    if (template.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    const { name, category, width, height, fit_x, fit_y, fit_width, fit_height, permission, tags } = req.body
    const imageUrl = req.file ? `/uploads/templates/${req.file.filename}` : undefined

    const updates: string[] = []
    const params: any[] = []

    if (name !== undefined) { updates.push('name = ?'); params.push(name) }
    if (category !== undefined) { updates.push('category = ?'); params.push(category) }
    if (width !== undefined) { updates.push('width = ?'); params.push(parseInt(width)) }
    if (height !== undefined) { updates.push('height = ?'); params.push(parseInt(height)) }
    if (imageUrl !== undefined) { updates.push('image_url = ?'); params.push(imageUrl) }
    if (fit_x !== undefined) { updates.push('fit_x = ?'); params.push(parseInt(fit_x)) }
    if (fit_y !== undefined) { updates.push('fit_y = ?'); params.push(parseInt(fit_y)) }
    if (fit_width !== undefined) { updates.push('fit_width = ?'); params.push(parseInt(fit_width)) }
    if (fit_height !== undefined) { updates.push('fit_height = ?'); params.push(parseInt(fit_height)) }
    if (permission !== undefined) { updates.push('permission = ?'); params.push(permission) }

    if (updates.length > 0) {
      params.push(req.params.id)
      db.prepare(`UPDATE templates SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    }

    if (tags !== undefined) {
      const tagNames = typeof tags === 'string' ? JSON.parse(tags) : tags
      if (Array.isArray(tagNames)) {
        db.prepare('DELETE FROM template_tags WHERE template_id = ?').run(req.params.id)

        const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
        const findTag = db.prepare('SELECT id FROM tags WHERE name = ?')
        const linkTag = db.prepare('INSERT INTO template_tags (template_id, tag_id) VALUES (?, ?)')

        for (const tagName of tagNames) {
          insertTag.run(tagName)
          const tagRow = findTag.get(tagName) as any
          if (tagRow) {
            linkTag.run(parseInt(req.params.id), tagRow.id)
          }
        }
      }
    }

    const updated = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as any
    const tagRows = db.prepare(
      'SELECT tg.name FROM template_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE tt.template_id = ?'
    ).all(req.params.id) as any[]

    res.json({
      success: true,
      data: { ...updated, tags: tagRows.map(t => t.name) }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as any
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' })
      return
    }

    if (template.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id)

    res.json({ success: true, data: { message: 'Template deleted' } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id/share', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id) as any
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' })
      return
    }

    if (template.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }

    if (!template.share_token) {
      const token = uuidv4()
      db.prepare('UPDATE templates SET share_token = ? WHERE id = ?').run(token, req.params.id)
      template.share_token = token
    }

    const shareUrl = `/api/templates/share/${template.share_token}`

    res.json({ success: true, data: { shareUrl, shareToken: template.share_token } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/share/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const template = db.prepare('SELECT * FROM templates WHERE share_token = ?').get(req.params.token) as any
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found or share link invalid' })
      return
    }

    const tagRows = db.prepare(
      'SELECT tg.name FROM template_tags tt JOIN tags tg ON tt.tag_id = tg.id WHERE tt.template_id = ?'
    ).all(template.id) as any[]

    res.json({
      success: true,
      data: { ...template, tags: tagRows.map(t => t.name) }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
