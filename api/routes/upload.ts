import { Router, type Request, type Response } from 'express'
import sharp from 'sharp'
import path from 'path'
import { templateUpload, designUpload } from '../middleware/upload.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.resolve(__dirname, '..', '..')

const router = Router()

router.post('/template-image', templateUpload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }

    const filePath = req.file.path
    const metadata = await sharp(filePath).metadata()
    const url = `/uploads/templates/${req.file.filename}`

    res.json({
      success: true,
      data: {
        url,
        width: metadata.width || 0,
        height: metadata.height || 0
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/design-image', designUpload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }

    const filePath = req.file.path
    const metadata = await sharp(filePath).metadata()
    const url = `/uploads/designs/${req.file.filename}`

    res.json({
      success: true,
      data: {
        url,
        width: metadata.width || 0,
        height: metadata.height || 0
      }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
