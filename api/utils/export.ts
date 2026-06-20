import db from '../db.js'

export interface ExportData {
  history: any[]
  templates: any[]
  favorites: any[]
  profile: any
}

export function generateCSV(data: Record<string, any>[]): string {
  if (data.length === 0) return ''
  
  const headers = Object.keys(data[0])
  const headerRow = headers.join(',')
  
  const rows = data.map(item => {
    return headers.map(header => {
      const value = item[header]
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',')
  })
  
  return [headerRow, ...rows].join('\n')
}

export function generateJSON(data: any): string {
  return JSON.stringify(data, null, 2)
}

export function getUserPersonalData(userId: number): ExportData {
  const history = db.prepare(`
    SELECT h.id, h.template_id, t.name as template_name, h.design_image_url, 
           h.result_image_url, h.export_format, h.created_at
    FROM history h
    JOIN templates t ON h.template_id = t.id
    WHERE h.user_id = ?
    ORDER BY h.created_at DESC
  `).all(userId) as any[]

  const templates = db.prepare(`
    SELECT t.id, t.name, t.category, t.width, t.height, t.image_url,
           t.permission, t.use_count, t.created_at,
           GROUP_CONCAT(tg.name, ';') as tags
    FROM templates t
    LEFT JOIN template_tags tt ON t.id = tt.template_id
    LEFT JOIN tags tg ON tt.tag_id = tg.id
    WHERE t.user_id = ?
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all(userId) as any[]

  const favorites = db.prepare(`
    SELECT f.id, f.template_id, t.name as template_name, t.category,
           t.image_url, f.created_at
    FROM favorites f
    JOIN templates t ON f.template_id = t.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(userId) as any[]

  const profile = db.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.created_at,
           up.region, up.country, up.city, up.bio
    FROM users u
    LEFT JOIN user_profiles up ON u.id = up.user_id
    WHERE u.id = ?
  `).get(userId) as any

  return {
    history,
    templates,
    favorites,
    profile
  }
}

export function createExportRecord(userId: number, type: string, format: string, parameters: any = {}): number {
  const result = db.prepare(`
    INSERT INTO export_records (user_id, type, format, parameters, status)
    VALUES (?, ?, ?, ?, 'processing')
  `).run(userId, type, format, JSON.stringify(parameters))
  
  return result.lastInsertRowid as number
}

export function updateExportRecord(id: number, status: string, filePath?: string, errorMessage?: string): void {
  const updates: string[] = []
  const params: any[] = []
  
  updates.push('status = ?')
  params.push(status)
  
  if (filePath) {
    updates.push('file_path = ?')
    params.push(filePath)
  }
  
  if (errorMessage) {
    updates.push('error_message = ?')
    params.push(errorMessage)
  }
  
  if (status === 'completed' || status === 'failed') {
    updates.push('completed_at = datetime(\'now\')')
  }
  
  params.push(id)
  
  db.prepare(`UPDATE export_records SET ${updates.join(', ')} WHERE id = ?`).run(...params)
}
