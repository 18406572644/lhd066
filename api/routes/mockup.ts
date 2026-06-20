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

interface LogoRegion {
  id: number
  template_id: number
  label: string
  pos_x: number
  pos_y: number
  width: number
  height: number
}

function generateFilename(prefix: string | null, templateName: string, timestamp: number, ext: string): string {
  const safeTemplateName = templateName.replace(/[^\w\u4e00-\u9fa5-]/g, '_').substring(0, 30)
  if (prefix) {
    return `${prefix}${safeTemplateName}-${timestamp}.${ext}`
  }
  return `result-${timestamp}.${ext}`
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
      scaleY = 1.0,
      brandPackId = null,
      logoId = null,
      backgroundColor = null,
      applyBrandColors = false,
      customFilename = null
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

    const outputWidth = exportWidth || template.width
    const outputHeight = exportHeight || template.height

    const scaleRatioX = outputWidth / template.width
    const scaleRatioY = outputHeight / template.height

    const compositeX = Math.round(posX * scaleRatioX)
    const compositeY = Math.round(posY * scaleRatioY)
    const compositeW = Math.round(finalWidth * scaleRatioX)
    const compositeH = Math.round(finalHeight * scaleRatioY)

    const layers: sharp.Sharp | any[] = []
    const compositeLayers: any[] = []

    const resizedDesign = await sharp(designPath)
      .resize(compositeW, compositeH, { fit: 'fill' })
      .toBuffer()

    compositeLayers.push({
      input: resizedDesign,
      left: compositeX,
      top: compositeY
    })

    let brandPrefix: string | null = null
    let selectedLogo: any = null

    if (brandPackId) {
      const brandPack = db.prepare(
        'SELECT * FROM brand_packs WHERE id = ? AND user_id = ?'
      ).get(brandPackId, req.user!.id) as any

      if (brandPack) {
        brandPrefix = brandPack.brand_prefix || null

        const logoRegions = db.prepare(
          'SELECT * FROM template_logo_regions WHERE template_id = ? ORDER BY id'
        ).all(templateId) as LogoRegion[]

        let logos: any[] = []
        if (logoId) {
          logos = db.prepare(
            'SELECT * FROM brand_logos WHERE id = ? AND brand_pack_id = ?'
          ).all(logoId, brandPackId) as any[]
        } else {
          logos = db.prepare(
            'SELECT * FROM brand_logos WHERE brand_pack_id = ? ORDER BY id LIMIT 1'
          ).all(brandPackId) as any[]
        }
        selectedLogo = logos[0] || null

        if (logoRegions.length > 0 && selectedLogo) {
          const logoPath = imageUrlToFilePath(selectedLogo.image_url)

          for (const region of logoRegions) {
            try {
              const regionScaledW = Math.round(region.width * scaleRatioX)
              const regionScaledH = Math.round(region.height * scaleRatioY)
              const regionScaledX = Math.round(region.pos_x * scaleRatioX)
              const regionScaledY = Math.round(region.pos_y * scaleRatioY)

              const logoBuffer = await sharp(logoPath)
                .resize(regionScaledW, regionScaledH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                .toBuffer()

              compositeLayers.push({
                input: logoBuffer,
                left: regionScaledX,
                top: regionScaledY
              })
            } catch (logoError) {
              console.warn('Failed to place logo in region', region.id, logoError)
            }
          }
        }
      }
    }

    let pipeline = sharp(templatePath).resize(outputWidth, outputHeight)

    if (backgroundColor) {
      try {
        const bgColor = backgroundColor.startsWith('#') ? backgroundColor : `#${backgroundColor}`
        pipeline = pipeline.flatten({ background: bgColor })
      } catch (e) {
        console.warn('Invalid background color, ignoring:', backgroundColor)
      }
    }

    pipeline = pipeline.composite(compositeLayers)

    const ext = exportFormat === 'jpg' ? 'jpg' : exportFormat === 'webp' ? 'webp' : 'png'
    const timestamp = Date.now()
    
    let resultFilename: string
    if (customFilename) {
      resultFilename = `${customFilename.replace(/[^\w\u4e00-\u9fa5-]/g, '_')}.${ext}`
    } else {
      resultFilename = generateFilename(brandPrefix, template.name, timestamp, ext)
    }
    
    const resultPath = path.resolve(projectRoot, 'uploads', 'results', resultFilename)

    const formatMethod = exportFormat === 'jpg' ? 'jpeg' : exportFormat === 'webp' ? 'webp' : 'png'
    const resultBuffer = await (pipeline as any)[formatMethod]({ quality: 90 }).toBuffer()
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
      outputWidth,
      outputHeight,
      exportFormat,
      offsetX,
      offsetY,
      scaleX,
      scaleY
    )

    db.prepare('UPDATE templates SET use_count = use_count + 1 WHERE id = ?').run(templateId)

    const responseData: any = {
      resultImageUrl,
      historyId: historyResult.lastInsertRowid,
      filename: resultFilename
    }

    if (brandPrefix) {
      responseData.brandPrefix = brandPrefix
    }
    if (selectedLogo) {
      responseData.appliedLogo = { id: selectedLogo.id, name: selectedLogo.name }
    }

    res.json({
      success: true,
      data: responseData
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/batch', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, brandPackId = null, logoId = null, applyBrandColors = false } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'Items array is required' })
      return
    }

    let brandPrefix: string | null = null
    if (brandPackId) {
      const brandPack = db.prepare(
        'SELECT brand_prefix FROM brand_packs WHERE id = ? AND user_id = ?'
      ).get(brandPackId, req.user!.id) as any
      if (brandPack) {
        brandPrefix = brandPack.brand_prefix || null
      }
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
        scaleY = 1.0,
        backgroundColor = null
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

        const outputWidth = exportWidth || template.width
        const outputHeight = exportHeight || template.height

        const scaleRatioX = outputWidth / template.width
        const scaleRatioY = outputHeight / template.height

        const compositeX = Math.round(posX * scaleRatioX)
        const compositeY = Math.round(posY * scaleRatioY)
        const compositeW = Math.round(finalWidth * scaleRatioX)
        const compositeH = Math.round(finalHeight * scaleRatioY)

        const compositeLayers: any[] = []

        const resizedDesign = await sharp(designPath)
          .resize(compositeW, compositeH, { fit: 'fill' })
          .toBuffer()

        compositeLayers.push({
          input: resizedDesign,
          left: compositeX,
          top: compositeY
        })

        if (brandPackId) {
          const logoRegions = db.prepare(
            'SELECT * FROM template_logo_regions WHERE template_id = ? ORDER BY id'
          ).all(templateId) as LogoRegion[]

          const logos = logoId
            ? db.prepare('SELECT * FROM brand_logos WHERE id = ? AND brand_pack_id = ?').all(logoId, brandPackId) as any[]
            : db.prepare('SELECT * FROM brand_logos WHERE brand_pack_id = ? ORDER BY id LIMIT 1').all(brandPackId) as any[]

          if (logoRegions.length > 0 && logos.length > 0) {
            const selectedLogo = logos[0]
            const logoPath = imageUrlToFilePath(selectedLogo.image_url)

            for (const region of logoRegions) {
              try {
                const regionScaledW = Math.round(region.width * scaleRatioX)
                const regionScaledH = Math.round(region.height * scaleRatioY)
                const regionScaledX = Math.round(region.pos_x * scaleRatioX)
                const regionScaledY = Math.round(region.pos_y * scaleRatioY)

                const logoBuffer = await sharp(logoPath)
                  .resize(regionScaledW, regionScaledH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                  .toBuffer()

                compositeLayers.push({
                  input: logoBuffer,
                  left: regionScaledX,
                  top: regionScaledY
                })
              } catch (logoError) {
                console.warn('Failed to place logo in region', region.id, logoError)
              }
            }
          }
        }

        let pipeline = sharp(templatePath).resize(outputWidth, outputHeight)

        if (backgroundColor) {
          try {
            const bgColor = backgroundColor.startsWith('#') ? backgroundColor : `#${backgroundColor}`
            pipeline = pipeline.flatten({ background: bgColor })
          } catch (e) {
            console.warn('Invalid background color, ignoring:', backgroundColor)
          }
        }

        pipeline = pipeline.composite(compositeLayers)

        const formatMethod = exportFormat === 'jpg' ? 'jpeg' : exportFormat === 'webp' ? 'webp' : 'png'
        const timestamp = Date.now()
        const ext = exportFormat === 'jpg' ? 'jpg' : exportFormat === 'webp' ? 'webp' : 'png'
        
        const resultFilename = generateFilename(brandPrefix, template.name, `${timestamp}-${results.length}` as any, ext)
        const resultPath = path.resolve(projectRoot, 'uploads', 'results', resultFilename)

        const resultBuffer = await (pipeline as any)[formatMethod]({ quality: 90 }).toBuffer()
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
          outputWidth,
          outputHeight,
          exportFormat,
          offsetX,
          offsetY,
          scaleX,
          scaleY
        )

        db.prepare('UPDATE templates SET use_count = use_count + 1 WHERE id = ?').run(templateId)

        results.push({
          success: true,
          data: { resultImageUrl, historyId: historyResult.lastInsertRowid, filename: resultFilename }
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
