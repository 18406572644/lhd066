import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import './db.js'
import './seed.js'
import authRoutes from './routes/auth.js'
import templateRoutes from './routes/templates.js'
import mockupRoutes from './routes/mockup.js'
import historyRoutes from './routes/history.js'
import statsRoutes from './routes/stats.js'
import uploadRoutes from './routes/upload.js'
import batchTaskRoutes from './routes/batch-tasks.js'
import notificationRoutes from './routes/notifications.js'
import exportRoutes from './routes/export.js'
import analyticsRoutes from './routes/analytics.js'
import qualityRoutes from './routes/quality.js'
import imageProcessingRoutes from './routes/imageProcessing.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/templates', templateRoutes)
app.use('/api/mockup', mockupRoutes)
app.use('/api/history', historyRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/batch-tasks', batchTaskRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/quality', qualityRoutes)
app.use('/api/image-processing', imageProcessingRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
