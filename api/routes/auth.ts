import { Router, type Request, type Response } from 'express'
import bcryptjs from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET || 'mockup-studio-secret-2024'
const JWT_EXPIRES_IN = '7d'

function generateToken(user: { id: number; email: string; role: string }): string {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body

    if (!email || !password || !name) {
      res.status(400).json({ success: false, error: 'Email, password and name are required' })
      return
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters' })
      return
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) {
      res.status(409).json({ success: false, error: 'Email already registered' })
      return
    }

    const passwordHash = bcryptjs.hashSync(password, 10)
    const result = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(email, passwordHash, name)

    const user = db.prepare('SELECT id, email, name, role, avatar, created_at FROM users WHERE id = ?').get(result.lastInsertRowid) as any
    const token = generateToken(user)

    res.status(201).json({
      success: true,
      data: { token, user }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' })
      return
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' })
      return
    }

    const validPassword = bcryptjs.compareSync(password, user.password_hash)
    if (!validPassword) {
      res.status(401).json({ success: false, error: 'Invalid email or password' })
      return
    }

    const token = generateToken(user)
    const { password_hash, ...userWithoutPassword } = user

    res.json({
      success: true,
      data: { token, user: userWithoutPassword }
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = db.prepare('SELECT id, email, name, role, avatar, created_at FROM users WHERE id = ?').get(req.user!.id) as any
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' })
      return
    }

    res.json({ success: true, data: user })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
