import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads')

const imageFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only image files are allowed (jpeg, png, webp, svg)'))
  }
}

const templateStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(uploadsDir, 'templates')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${file.originalname}`)
  }
})

const designStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(uploadsDir, 'designs')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${Date.now()}-${file.originalname}`)
  }
})

export const templateUpload = multer({
  storage: templateStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
})

export const designUpload = multer({
  storage: designStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 20 * 1024 * 1024 }
})
