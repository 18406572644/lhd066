import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.resolve(__dirname, '..')
const seedDir = path.join(projectRoot, 'data', 'seed-templates')
const uploadsDir = path.join(projectRoot, 'uploads', 'templates')

fs.mkdirSync(uploadsDir, { recursive: true })

const seedTemplates = [
  {
    name: 'iPhone 15 Pro 样机',
    category: 'phone',
    width: 1080,
    height: 1920,
    image_file: 'phone-mockup-1.svg',
    fit_x: 170,
    fit_y: 180,
    fit_width: 740,
    fit_height: 1520,
    permission: 'public',
    tags: ['iPhone', '手机', '移动端', 'iOS', '科技感'],
    use_count: 128
  },
  {
    name: '安卓手机通用样机',
    category: 'phone',
    width: 1080,
    height: 1920,
    image_file: 'phone-mockup-2.svg',
    fit_x: 160,
    fit_y: 140,
    fit_width: 760,
    fit_height: 1600,
    permission: 'public',
    tags: ['安卓', '手机', '移动端', '简约'],
    use_count: 89
  },
  {
    name: 'MacBook 样机',
    category: 'computer',
    width: 1920,
    height: 1440,
    image_file: 'computer-mockup-1.svg',
    fit_x: 300,
    fit_y: 220,
    fit_width: 1320,
    fit_height: 800,
    permission: 'public',
    tags: ['Mac', '电脑', '笔记本', '网页展示', '科技'],
    use_count: 256
  },
  {
    name: '台式电脑样机',
    category: 'computer',
    width: 1440,
    height: 900,
    image_file: 'computer-mockup-2.svg',
    fit_x: 210,
    fit_y: 110,
    fit_width: 1020,
    fit_height: 620,
    permission: 'public',
    tags: ['电脑', '台式机', '网页展示', '桌面'],
    use_count: 167
  },
  {
    name: '竖版海报样机',
    category: 'poster',
    width: 1080,
    height: 1350,
    image_file: 'poster-mockup-1.svg',
    fit_x: 160,
    fit_y: 160,
    fit_width: 760,
    fit_height: 990,
    permission: 'public',
    tags: ['海报', '竖版', '打印', '宣传单', '简约'],
    use_count: 312
  },
  {
    name: '方形海报样机',
    category: 'poster',
    width: 1080,
    height: 1080,
    image_file: 'poster-mockup-2.svg',
    fit_x: 140,
    fit_y: 140,
    fit_width: 800,
    fit_height: 800,
    permission: 'public',
    tags: ['海报', '方形', '社交媒体', '朋友圈', '简约'],
    use_count: 198
  },
  {
    name: '产品包装盒样机',
    category: 'packaging',
    width: 1200,
    height: 1600,
    image_file: 'packaging-mockup-1.svg',
    fit_x: 300,
    fit_y: 200,
    fit_width: 480,
    fit_height: 680,
    permission: 'public',
    tags: ['包装', '盒子', '产品', '品牌', '3D效果'],
    use_count: 76
  }
]

function seed() {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM templates').get() as any
  if (countRow.count > 0) {
    return
  }

  const adminRow = db.prepare('SELECT id FROM users WHERE role = ?').get('admin') as any
  const userId = adminRow?.id || 1

  for (const tpl of seedTemplates) {
    const srcPath = path.join(seedDir, tpl.image_file)
    if (!fs.existsSync(srcPath)) continue

    const destFilename = `${Date.now()}-seed-${tpl.image_file}`
    const destPath = path.join(uploadsDir, destFilename)
    fs.copyFileSync(srcPath, destPath)

    const result = db.prepare(
      `INSERT INTO templates (user_id, name, category, width, height, image_url, fit_x, fit_y, fit_width, fit_height, permission, use_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      tpl.name,
      tpl.category,
      tpl.width,
      tpl.height,
      `/uploads/templates/${destFilename}`,
      tpl.fit_x,
      tpl.fit_y,
      tpl.fit_width,
      tpl.fit_height,
      tpl.permission,
      tpl.use_count
    )

    const templateId = result.lastInsertRowid

    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)')
    const findTag = db.prepare('SELECT id FROM tags WHERE name = ?')
    const linkTag = db.prepare('INSERT INTO template_tags (template_id, tag_id) VALUES (?, ?)')

    for (const tagName of tpl.tags) {
      insertTag.run(tagName)
      const tagRow = findTag.get(tagName) as any
      if (tagRow) {
        linkTag.run(templateId, tagRow.id)
      }
    }
  }
}

seed()

export default seed
