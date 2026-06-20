import db from './db.js'
import bcryptjs from 'bcryptjs'

function seedAnalyticsData() {
  const users = db.prepare('SELECT id FROM users WHERE role = ?').all('user') as any[]
  
  if (users.length < 3) {
    for (let i = 1; i <= 5; i++) {
      const email = `user${i}@example.com`
      const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
      if (!exists) {
        const passwordHash = bcryptjs.hashSync('password123', 10)
        db.prepare(
          'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)'
        ).run(email, passwordHash, `测试用户${i}`, 'user')
      }
    }
  }
  
  const allUsers = db.prepare('SELECT id FROM users').all() as any[]
  const templates = db.prepare('SELECT id, user_id, category FROM templates').all() as any[]
  const adminUser = db.prepare('SELECT id FROM users WHERE role = ?').get('admin') as any
  
  if (templates.length === 0) return
  
  const designerId = adminUser?.id || templates[0].user_id
  
  const regions = ['华东', '华北', '华南', '西南', '西北', '东北', '华中']
  const countries = ['中国', '美国', '日本', '韩国', '新加坡']
  const cities = ['上海', '北京', '深圳', '杭州', '成都', '广州', '南京']
  
  for (const user of allUsers) {
    if (user.id === designerId) continue
    
    const hasProfile = db.prepare('SELECT id FROM user_profiles WHERE user_id = ?').get(user.id)
    if (!hasProfile) {
      db.prepare(`
        INSERT INTO user_profiles (user_id, region, country, city, preferred_categories)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        user.id,
        regions[Math.floor(Math.random() * regions.length)],
        countries[Math.floor(Math.random() * countries.length)],
        cities[Math.floor(Math.random() * cities.length)],
        JSON.stringify(['poster', 'phone'])
      )
    }
  }
  
  for (const tpl of templates) {
    const ratingCount = db.prepare('SELECT COUNT(*) as count FROM template_ratings WHERE template_id = ?').get(tpl.id) as any
    if (ratingCount.count < 3) {
      const raters = allUsers.filter(u => u.id !== designerId).slice(0, 5)
      for (const rater of raters) {
        const exists = db.prepare('SELECT id FROM template_ratings WHERE user_id = ? AND template_id = ?').get(rater.id, tpl.id)
        if (!exists) {
          const rating = Math.floor(Math.random() * 3) + 3
          const daysAgo = Math.floor(Math.random() * 30)
          const date = new Date()
          date.setDate(date.getDate() - daysAgo)
          
          db.prepare(`
            INSERT INTO template_ratings (user_id, template_id, rating, comment, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            rater.id,
            tpl.id,
            rating,
            rating >= 4 ? '非常棒的模板！' : rating >= 3 ? '还不错' : '需要改进',
            date.toISOString()
          )
        }
      }
    }
    
    const favCount = db.prepare('SELECT COUNT(*) as count FROM favorites WHERE template_id = ?').get(tpl.id) as any
    if (favCount.count < 2) {
      const favers = allUsers.filter(u => u.id !== designerId).slice(0, 4)
      for (const faver of favers) {
        try {
          const daysAgo = Math.floor(Math.random() * 30)
          const date = new Date()
          date.setDate(date.getDate() - daysAgo)
          
          db.prepare(`
            INSERT INTO favorites (user_id, template_id, created_at)
            VALUES (?, ?, ?)
          `).run(faver.id, tpl.id, date.toISOString())
        } catch {
        }
      }
    }
    
    const txCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE template_id = ?').get(tpl.id) as any
    if (txCount.count < 2 && Math.random() > 0.5) {
      const buyers = allUsers.filter(u => u.id !== designerId).slice(0, 3)
      for (const buyer of buyers) {
        const amount = (Math.random() * 50 + 10).toFixed(2)
        const daysAgo = Math.floor(Math.random() * 30)
        const date = new Date()
        date.setDate(date.getDate() - daysAgo)
        
        db.prepare(`
          INSERT INTO transactions (user_id, template_id, amount, currency, status, payment_method, transaction_id, created_at)
          VALUES (?, ?, ?, 'CNY', 'completed', 'alipay', ?, ?)
        `).run(
          buyer.id,
          tpl.id,
          parseFloat(amount),
          `TXN${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
          date.toISOString()
        )
      }
    }
  }
  
  for (const tpl of templates) {
    const useCount = db.prepare('SELECT COUNT(*) as count FROM history WHERE template_id = ?').get(tpl.id) as any
    if (useCount.count < 5) {
      const users = allUsers.filter(u => u.id !== designerId).slice(0, 8)
      for (const user of users) {
        const daysAgo = Math.floor(Math.random() * 30)
        const date = new Date()
        date.setDate(date.getDate() - daysAgo)
        
        db.prepare(`
          INSERT INTO history (user_id, template_id, design_image_url, result_image_url, export_width, export_height, export_format, created_at)
          VALUES (?, ?, '/uploads/designs/test.jpg', '/uploads/results/test.png', 1080, 1920, 'png', ?)
        `).run(user.id, tpl.id, date.toISOString())
      }
    }
  }
  
  console.log('Analytics sample data seeded successfully!')
}

export default seedAnalyticsData
