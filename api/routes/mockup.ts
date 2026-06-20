import { Router, type Request, type Response } from 'express'
import path from 'path'
import sharp from 'sharp'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.resolve(__dirname, '..', '..')

const router = Router()

function imageUrlToFilePath(url: string): string {
  const relativePath = url.replace(/^\/uploads\//, 'uploads/')
  return path.resolve(projectRoot, relativePath)
}

router.post('/generate', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      templateId,
      designImageUrl,
      exportWidth,
      exportHeight,
      exportFormat = 'png',
      offsetX = 0,
      offsetY = 0,
      scaleX = 1.0,
      scaleY = 1.0
    } = req.body

    if (!templateId || !designImageUrl) {
      res.status(400).json({ success: false, error: 'templateId and designImageUrl are required' })
      return
    }

    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as any
    if (!template) {
      res.status(404).json({ success: false, error: 'Template not found' })
      return
    }

    const templatePath = imageUrlToFilePath(template.image_url)
    const designPath = imageUrlToFilePath(designImageUrl)

    const finalWidth = Math.round(template.fit_width * scaleX)
    const finalHeight = Math.round(template.fit_height * scaleY)
    const posX = Math.round(template.fit_x + offsetX)
    const posY = Math.round(template.fit_y + offsetY)

    const resizedDesign = await sharp(designPath)
      .resize(finalWidth, finalHeight, { fit: 'fill' })
      .toBuffer()

    const compositeX = Math.round((exportWidth || template.width) * (posX / template.width))
    const compositeY = Math.round((exportHeight || template.height) * (posY / template.height))

    const resultBuffer = await sharp(templatePath)
      .resize(exportWidth || template.width, exportHeight || template.height)
      .composite([{
        input: resizedDesign,
        left: compositeX,
        top: compositeY
      }])
      [exportFormat === 'jpg' ? 'jpeg' : exportFormat === 'webp' ? 'webp' : 'png']({
        quality: 90
      })
      .toBuffer()

    const timestamp = Date.now()
    const ext = exportFormat === 'jpg' ? 'jpg' : exportFormat === 'webp' ? 'webp' : 'png'
    const resultFilename = `result-${timestamp}.${ext}`
    const resultPath = path.resolve(projectRoot, 'uploads', 'results', resultFilename)

    await sharp(resultBuffer).toFile(resultPath)

    const resultImageUrl = `/uploads/results/${resultFilename}`

    const historyResult = db.prepare(
      `INSERT INTO history (user_id, template_id, design_image_url, result_image_url, export_width, export_height, export_format, offset_x, offset_y, scale_x, scale_y)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user!.id,
      templateId,
      designImageUrl,
      resultImageUrl,
      exportWidth || template.width,
      exportHeight || template.height,
      exportFormat,
      offsetX,
      offsetY,
      scaleX,
      scaleY
    )

    db.prepare('UPDATE templates SET use_count = use_count + 1 WHERE id = ?').run(templateId)

    res.json({
      success: true,
      data: {
        resultImageUrl,
        historyId: historyResult.lastInsertRowid
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/batch', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'Items array is required' })
      return
    }

    const results: any[] = []

    for (const item of items) {
      const {
        templateId,
        designImageUrl,
        exportWidth,
        exportHeight,
        exportFormat = 'png',
        offsetX = 0,
        offsetY = 0,
        scaleX = 1.0,
        scaleY = 1.0
      } = item

      try {
        const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId) as any
        if (!template) {
          results.push({ success: false, error: 'Template not found', templateId })
          continue
        }

        const templatePath = imageUrlToFilePath(template.image_url)
        const designPath = imageUrlToFilePath(designImageUrl)

        const finalWidth = Math.round(template.fit_width * scaleX)
        const finalHeight = Math.round(template.fit_height * scaleY)
        const posX = Math.round(template.fit_x + offsetX)
        const posY = Math.round(template.fit_y + offsetY)

        const resizedDesign = await sharp(designPath)
          .resize(finalWidth, finalHeight, { fit: 'fill' })
          .toBuffer()

        const compositeX = Math.round((exportWidth || template.width) * (posX / template.width))
        const compositeY = Math.round((exportHeight || template.height) * (posY / template.height))

        const resultBuffer = await sharp(templatePath)
          .resize(exportWidth || template.width, exportHeight || template.height)
          .composite([{
            input: resizedDesign,
            left: compositeX,
            top: compositeY
          }])
          [exportFormat === 'jpg' ? 'jpeg' : exportFormat === 'webp' ? 'webp' : 'png']({
            quality: 90
          })
          .toBuffer()

        const timestamp = Date.now()
        const ext = exportFormat === 'jpg' ? 'jpg' : exportFormat === 'webp' ? 'webp' : 'png'
        const resultFilename = `result-${timestamp}-${results.length}.${ext}`
        const resultPath = path.resolve(projectRoot, 'uploads', 'results', resultFilename)

        await sharp(resultBuffer).toFile(resultPath)

        const resultImageUrl = `/uploads/results/${resultFilename}`

        const historyResult = db.prepare(
          `INSERT INTO history (user_id, template_id, design_image_url, result_image_url, export_width, export_height, export_format, offset_x, offset_y, scale_x, scale_y)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          req.user!.id,
          templateId,
          designImageUrl,
          resultImageUrl,
          exportWidth || template.width,
          exportHeight || template.height,
          exportFormat,
          offsetX,
          offsetY,
          scaleX,
          scaleY
        )

        db.prepare('UPDATE templates SET use_count = use_count + 1 WHERE id = ?').run(templateId)

        results.push({
          success: true,
          data: { resultImageUrl, historyId: historyResult.lastInsertRowid }
        })
      } catch (itemError: any) {
        results.push({ success: false, error: itemError.message, templateId })
      }
    }

    res.json({ success: true, data: { results } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/batch/:taskId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: { taskId: req.params.taskId, status: 'completed' }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
