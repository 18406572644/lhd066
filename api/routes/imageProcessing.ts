import { Router, type Request, type Response } from 'express'
import path from 'path'
import sharp from 'sharp'
import multer from 'multer'
import fs from 'fs'
import { fileURLToPath } from 'url'
import {
  removeBackground,
  applyBrushStrokes,
  applyFeather,
  applyThreshold,
  applyMaskToImage,
  matchLightingToTemplate,
  replaceBackground,
  getImageStats,
  processedDir,
  imageUrlToFilePath,
  filePathToUrl,
  type BrushStroke,
  type FeatherParams,
  type ThresholdParams,
  type BackgroundReplaceParams,
  type LightingAdjustParams,
} from '../utils/imageProcessing.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')

const router = Router()

const bgImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(projectRoot, 'uploads', 'backgrounds')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`)
  },
})

const bgImageFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp']
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only JPEG, PNG, WebP images are allowed'))
  }
}

const bgUpload = multer({
  storage: bgImageStorage,
  fileFilter: bgImageFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
})

router.post('/remove-background', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageUrl } = req.body

    if (!imageUrl) {
      res.status(400).json({ success: false, error: 'imageUrl is required' })
      return
    }

    const inputPath = imageUrlToFilePath(imageUrl)
    if (!fs.existsSync(inputPath)) {
      res.status(404).json({ success: false, error: 'Image not found' })
      return
    }

    const timestamp = Date.now()
    const outputFilename = `processed-${timestamp}.png`
    const outputPath = path.resolve(processedDir, outputFilename)

    const result = await removeBackground(inputPath, outputPath)

    res.json({
      success: true,
      data: {
        processedImageUrl: filePathToUrl(result.outputPath),
        maskImageUrl: filePathToUrl(result.maskPath),
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/apply-mask', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageUrl, maskUrl } = req.body

    if (!imageUrl || !maskUrl) {
      res.status(400).json({ success: false, error: 'imageUrl and maskUrl are required' })
      return
    }

    const imagePath = imageUrlToFilePath(imageUrl)
    const maskPath = imageUrlToFilePath(maskUrl)

    if (!fs.existsSync(imagePath) || !fs.existsSync(maskPath)) {
      res.status(404).json({ success: false, error: 'Image or mask not found' })
      return
    }

    const timestamp = Date.now()
    const outputFilename = `mask-applied-${timestamp}.png`
    const outputPath = path.resolve(processedDir, outputFilename)

    await applyMaskToImage(imagePath, maskPath, outputPath)

    res.json({
      success: true,
      data: {
        processedImageUrl: filePathToUrl(outputPath),
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/mask/brush', async (req: Request, res: Response): Promise<void> => {
  try {
    const { maskUrl, width, height, strokes } = req.body as {
      maskUrl: string
      width: number
      height: number
      strokes: BrushStroke[]
    }

    if (!maskUrl || !width || !height || !strokes) {
      res.status(400).json({ success: false, error: 'maskUrl, width, height, strokes are required' })
      return
    }

    const maskPath = imageUrlToFilePath(maskUrl)
    if (!fs.existsSync(maskPath)) {
      res.status(404).json({ success: false, error: 'Mask not found' })
      return
    }

    const timestamp = Date.now()
    const outputFilename = `mask-brush-${timestamp}.png`
    const outputPath = path.resolve(processedDir, outputFilename)

    await applyBrushStrokes(maskPath, width, height, strokes, outputPath)

    res.json({
      success: true,
      data: {
        maskImageUrl: filePathToUrl(outputPath),
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/mask/feather', async (req: Request, res: Response): Promise<void> => {
  try {
    const { maskUrl, radius } = req.body as { maskUrl: string } & FeatherParams

    if (!maskUrl || radius === undefined) {
      res.status(400).json({ success: false, error: 'maskUrl and radius are required' })
      return
    }

    const maskPath = imageUrlToFilePath(maskUrl)
    if (!fs.existsSync(maskPath)) {
      res.status(404).json({ success: false, error: 'Mask not found' })
      return
    }

    const timestamp = Date.now()
    const outputFilename = `mask-feather-${timestamp}.png`
    const outputPath = path.resolve(processedDir, outputFilename)

    await applyFeather(maskPath, { radius }, outputPath)

    res.json({
      success: true,
      data: {
        maskImageUrl: filePathToUrl(outputPath),
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/mask/threshold', async (req: Request, res: Response): Promise<void> => {
  try {
    const { maskUrl, value, softness } = req.body as { maskUrl: string } & ThresholdParams

    if (!maskUrl || value === undefined || softness === undefined) {
      res.status(400).json({ success: false, error: 'maskUrl, value, and softness are required' })
      return
    }

    const maskPath = imageUrlToFilePath(maskUrl)
    if (!fs.existsSync(maskPath)) {
      res.status(404).json({ success: false, error: 'Mask not found' })
      return
    }

    const timestamp = Date.now()
    const outputFilename = `mask-threshold-${timestamp}.png`
    const outputPath = path.resolve(processedDir, outputFilename)

    await applyThreshold(maskPath, { value, softness }, outputPath)

    res.json({
      success: true,
      data: {
        maskImageUrl: filePathToUrl(outputPath),
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/mask/reset', async (req: Request, res: Response): Promise<void> => {
  try {
    const { originalMaskUrl } = req.body

    if (!originalMaskUrl) {
      res.status(400).json({ success: false, error: 'originalMaskUrl is required' })
      return
    }

    const originalPath = imageUrlToFilePath(originalMaskUrl)
    if (!fs.existsSync(originalPath)) {
      res.status(404).json({ success: false, error: 'Original mask not found' })
      return
    }

    res.json({
      success: true,
      data: {
        maskImageUrl: originalMaskUrl,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/analyze-lighting', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageUrl } = req.body

    if (!imageUrl) {
      res.status(400).json({ success: false, error: 'imageUrl is required' })
      return
    }

    const imagePath = imageUrlToFilePath(imageUrl)
    if (!fs.existsSync(imagePath)) {
      res.status(404).json({ success: false, error: 'Image not found' })
      return
    }

    const stats = await getImageStats(imagePath)

    res.json({
      success: true,
      data: stats,
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/match-lighting', async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageUrl, templateImageUrl, customParams } = req.body as {
      imageUrl: string
      templateImageUrl: string
      customParams?: Partial<LightingAdjustParams>
    }

    if (!imageUrl || !templateImageUrl) {
      res.status(400).json({ success: false, error: 'imageUrl and templateImageUrl are required' })
      return
    }

    const imagePath = imageUrlToFilePath(imageUrl)
    const templatePath = imageUrlToFilePath(templateImageUrl)

    if (!fs.existsSync(imagePath) || !fs.existsSync(templatePath)) {
      res.status(404).json({ success: false, error: 'Image or template not found' })
      return
    }

    const timestamp = Date.now()
    const outputFilename = `light-matched-${timestamp}.png`
    const outputPath = path.resolve(processedDir, outputFilename)

    const result = await matchLightingToTemplate(imagePath, templatePath, outputPath, customParams)

    res.json({
      success: true,
      data: {
        processedImageUrl: filePathToUrl(result.outputPath),
        params: result.params,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/replace-background', async (req: Request, res: Response): Promise<void> => {
  try {
    const { foregroundUrl, params, targetWidth, targetHeight } = req.body as {
      foregroundUrl: string
      params: BackgroundReplaceParams
      targetWidth?: number
      targetHeight?: number
    }

    if (!foregroundUrl || !params) {
      res.status(400).json({ success: false, error: 'foregroundUrl and params are required' })
      return
    }

    const foregroundPath = imageUrlToFilePath(foregroundUrl)
    if (!fs.existsSync(foregroundPath)) {
      res.status(404).json({ success: false, error: 'Foreground image not found' })
      return
    }

    if (params.type === 'image' && params.imagePath) {
      const bgPath = imageUrlToFilePath(params.imagePath)
      if (!fs.existsSync(bgPath)) {
        res.status(404).json({ success: false, error: 'Background image not found' })
        return
      }
      params.imagePath = bgPath
    }

    const timestamp = Date.now()
    const outputFilename = `bg-replaced-${timestamp}.png`
    const outputPath = path.resolve(processedDir, outputFilename)

    const resultPath = await replaceBackground(
      foregroundPath,
      params,
      outputPath,
      targetWidth,
      targetHeight
    )

    res.json({
      success: true,
      data: {
        processedImageUrl: filePathToUrl(resultPath),
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/background/upload', bgUpload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }

    const filePath = req.file.path
    const metadata = await sharp(filePath).metadata()
    const url = `/uploads/backgrounds/${req.file.filename}`

    res.json({
      success: true,
      data: {
        url,
        width: metadata.width || 0,
        height: metadata.height || 0,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/background/list', (_req: Request, res: Response): void => {
  try {
    const bgDir = path.resolve(projectRoot, 'uploads', 'backgrounds')
    if (!fs.existsSync(bgDir)) {
      res.json({ success: true, data: [] })
      return
    }

    const files = fs.readdirSync(bgDir)
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .map((f) => ({
        filename: f,
        url: `/uploads/backgrounds/${f}`,
      }))

    res.json({ success: true, data: files })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/generate-with-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      templateImageUrl,
      designImageUrl,
      maskImageUrl,
      backgroundParams,
      lightingEnabled,
      customLightingParams,
      fitRegion,
      offsetX,
      offsetY,
      scaleX,
      scaleY,
      targetWidth,
      targetHeight,
    } = req.body

    if (!templateImageUrl || !designImageUrl) {
      res.status(400).json({ success: false, error: 'templateImageUrl and designImageUrl are required' })
      return
    }

    const templatePath = imageUrlToFilePath(templateImageUrl)
    const designPath = imageUrlToFilePath(designImageUrl)

    if (!fs.existsSync(templatePath) || !fs.existsSync(designPath)) {
      res.status(404).json({ success: false, error: 'Template or design image not found' })
      return
    }

    const templateMeta = await sharp(templatePath).metadata()
    const exportWidth = targetWidth || templateMeta.width || 800
    const exportHeight = targetHeight || templateMeta.height || 600

    let processedDesignPath = designPath
    const timestamp = Date.now()

    if (maskImageUrl) {
      const maskPath = imageUrlToFilePath(maskImageUrl)
      if (fs.existsSync(maskPath)) {
        const maskedFilename = `composite-masked-${timestamp}.png`
        const maskedPath = path.resolve(processedDir, maskedFilename)
        processedDesignPath = await applyMaskToImage(designPath, maskPath, maskedPath)
      }
    }

    if (lightingEnabled) {
      const lightFilename = `composite-light-${timestamp}.png`
      const lightPath = path.resolve(processedDir, lightFilename)
      const result = await matchLightingToTemplate(
        processedDesignPath,
        templatePath,
        lightPath,
        customLightingParams
      )
      processedDesignPath = result.outputPath
    }

    let compositeResult: string

    if (backgroundParams && backgroundParams.type) {
      const bgReplacedFilename = `composite-bg-${timestamp}.png`
      const bgReplacedPath = path.resolve(processedDir, bgReplacedFilename)

      if (backgroundParams.type === 'image' && backgroundParams.imagePath) {
        backgroundParams.imagePath = imageUrlToFilePath(backgroundParams.imagePath)
      }

      await replaceBackground(
        templatePath,
        backgroundParams,
        bgReplacedPath,
        exportWidth,
        exportHeight
      )

      const templateWithBgPath = bgReplacedPath

      const finalWidth = Math.round((fitRegion?.width || exportWidth) * (scaleX || 1))
      const finalHeight = Math.round((fitRegion?.height || exportHeight) * (scaleY || 1))
      const posX = Math.round((fitRegion?.x || 0) + (offsetX || 0))
      const posY = Math.round((fitRegion?.y || 0) + (offsetY || 0))

      const designBuffer = await sharp(processedDesignPath)
        .resize(finalWidth, finalHeight, { fit: 'fill' })
        .toBuffer()

      const resultBuffer = await sharp(templateWithBgPath)
        .resize(exportWidth, exportHeight)
        .composite([
          {
            input: designBuffer,
            left: posX,
            top: posY,
          },
        ])
        .png()
        .toBuffer()

      const finalFilename = `result-composite-${timestamp}.png`
      const finalPath = path.resolve(projectRoot, 'uploads', 'results', finalFilename)
      await sharp(resultBuffer).toFile(finalPath)
      compositeResult = finalPath
    } else {
      const finalWidth = Math.round((fitRegion?.width || exportWidth) * (scaleX || 1))
      const finalHeight = Math.round((fitRegion?.height || exportHeight) * (scaleY || 1))
      const posX = Math.round((fitRegion?.x || 0) + (offsetX || 0))
      const posY = Math.round((fitRegion?.y || 0) + (offsetY || 0))

      const designBuffer = await sharp(processedDesignPath)
        .resize(finalWidth, finalHeight, { fit: 'fill' })
        .toBuffer()

      const resultBuffer = await sharp(templatePath)
        .resize(exportWidth, exportHeight)
        .composite([
          {
            input: designBuffer,
            left: posX,
            top: posY,
          },
        ])
        .png()
        .toBuffer()

      const finalFilename = `result-composite-${timestamp}.png`
      const finalPath = path.resolve(projectRoot, 'uploads', 'results', finalFilename)
      await sharp(resultBuffer).toFile(finalPath)
      compositeResult = finalPath
    }

    res.json({
      success: true,
      data: {
        resultImageUrl: filePathToUrl(compositeResult),
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
