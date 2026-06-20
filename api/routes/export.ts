import { Router, type Request, type Response } from 'express'
import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  getUserPersonalData,
  generateCSV,
  generateJSON,
  createExportRecord,
  updateExportRecord
} from '../utils/export.js'
import type { ExportData } from '../utils/export.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const exportsDir = path.resolve(__dirname, '..', '..', 'data', 'exports')
fs.mkdirSync(exportsDir, { recursive: true })

const router = Router()

router.get('/personal', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { format = 'json' } = req.query
    const userId = req.user!.id
    
    if (!['json', 'csv'].includes(format as string)) {
      res.status(400).json({ success: false, error: 'Invalid format. Use json or csv.' })
      return
    }
    
    const exportRecordId = createExportRecord(userId, 'personal_data', format as string)
    
    const userData = getUserPersonalData(userId)
    
    if (format === 'json') {
      const jsonData = generateJSON(userData)
      const filename = `personal-data-${userId}-${Date.now()}.json`
      const filePath = path.join(exportsDir, filename)
      
      fs.writeFileSync(filePath, jsonData)
      updateExportRecord(exportRecordId, 'completed', filePath)
      
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(jsonData)
    } else {
      const zipFilename = `personal-data-${userId}-${Date.now()}.zip`
      const zipFilePath = path.join(exportsDir, zipFilename)
      
      const archive = archiver('zip', { zlib: { level: 9 } })
      const output = fs.createWriteStream(zipFilePath)
      
      archive.pipe(output)
      
      const csvFiles = generateCSVPackage(userData)
      for (const [name, content] of Object.entries(csvFiles)) {
        archive.append(content, { name: `${name}.csv` })
      }
      
      archive.finalize()
      
      output.on('close', () => {
        updateExportRecord(exportRecordId, 'completed', zipFilePath)
        
        res.setHeader('Content-Type', 'application/zip')
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`)
        fs.createReadStream(zipFilePath).pipe(res)
      })
      
      archive.on('error', (err) => {
        updateExportRecord(exportRecordId, 'failed', undefined, err.message)
        res.status(500).json({ success: false, error: 'Failed to generate export' })
      })
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/history', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20' } = req.query
    const pageNum = Math.max(1, parseInt(page as string) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20))
    const offset = (pageNum - 1) * limitNum
    
    const countRow = db.prepare('SELECT COUNT(*) as total FROM export_records WHERE user_id = ?').get(req.user!.id) as any
    const total = countRow.total
    
    const records = db.prepare(`
      SELECT * FROM export_records
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user!.id, limitNum, offset) as any[]
    
    res.json({
      success: true,
      data: {
        items: records,
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

router.get('/:id/download', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const record = db.prepare('SELECT * FROM export_records WHERE id = ?').get(req.params.id) as any
    
    if (!record) {
      res.status(404).json({ success: false, error: 'Export record not found' })
      return
    }
    
    if (record.user_id !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' })
      return
    }
    
    if (record.status !== 'completed' || !record.file_path) {
      res.status(400).json({ success: false, error: 'Export not ready or failed' })
      return
    }
    
    const filePath = path.resolve(__dirname, '..', '..', record.file_path)
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'File not found' })
      return
    }
    
    const filename = path.basename(filePath)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    fs.createReadStream(filePath).pipe(res)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

function generateCSVPackage(data: ExportData): Record<string, string> {
  return {
    'profile': generateCSV([data.profile]),
    'history': generateCSV(data.history),
    'templates': generateCSV(data.templates),
    'favorites': generateCSV(data.favorites)
  }
}

export default router
