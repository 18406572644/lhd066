import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import bcryptjs from 'bcryptjs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.resolve(__dirname, '..', 'data')
const uploadsDir = path.resolve(__dirname, '..', 'uploads')

fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(path.join(uploadsDir, 'templates'), { recursive: true })
fs.mkdirSync(path.join(uploadsDir, 'designs'), { recursive: true })
fs.mkdirSync(path.join(uploadsDir, 'results'), { recursive: true })

const dbPath = path.join(dataDir, 'mockup.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'designer', 'admin')),
    avatar TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('poster', 'phone', 'computer', 'packaging')),
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    fit_x INTEGER NOT NULL DEFAULT 0,
    fit_y INTEGER NOT NULL DEFAULT 0,
    fit_width INTEGER NOT NULL,
    fit_height INTEGER NOT NULL,
    permission TEXT NOT NULL DEFAULT 'public' CHECK(permission IN ('public', 'private', 'restricted')),
    share_token TEXT UNIQUE,
    use_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS template_tags (
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (template_id, tag_id)
);
CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    template_id INTEGER NOT NULL REFERENCES templates(id),
    design_image_url TEXT NOT NULL,
    result_image_url TEXT NOT NULL,
    export_width INTEGER NOT NULL,
    export_height INTEGER NOT NULL,
    export_format TEXT NOT NULL DEFAULT 'png',
    offset_x INTEGER NOT NULL DEFAULT 0,
    offset_y INTEGER NOT NULL DEFAULT 0,
    scale_x REAL NOT NULL DEFAULT 1.0,
    scale_y REAL NOT NULL DEFAULT 1.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_share_token ON templates(share_token);
CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_template_id ON history(template_id);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE TABLE IF NOT EXISTS batch_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'paused', 'cancelled', 'completed', 'failed')),
    total_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    current_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
);
CREATE TABLE IF NOT EXISTS batch_task_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES batch_tasks(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES templates(id),
    design_image_url TEXT NOT NULL,
    export_width INTEGER NOT NULL,
    export_height INTEGER NOT NULL,
    export_format TEXT NOT NULL DEFAULT 'png',
    offset_x INTEGER NOT NULL DEFAULT 0,
    offset_y INTEGER NOT NULL DEFAULT 0,
    scale_x REAL NOT NULL DEFAULT 1.0,
    scale_y REAL NOT NULL DEFAULT 1.0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'success', 'failed', 'skipped')),
    result_image_url TEXT,
    error_message TEXT,
    history_id INTEGER REFERENCES history(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL DEFAULT 'info' CHECK(type IN ('info', 'success', 'warning', 'error')),
    title TEXT NOT NULL,
    content TEXT,
    task_id INTEGER REFERENCES batch_tasks(id),
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_batch_tasks_user_id ON batch_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_tasks_status ON batch_tasks(status);
CREATE INDEX IF NOT EXISTS idx_batch_task_items_task_id ON batch_task_items(task_id);
CREATE INDEX IF NOT EXISTS idx_batch_task_items_status ON batch_task_items(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE TABLE IF NOT EXISTS template_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    version_label TEXT NOT NULL,
    description TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('poster', 'phone', 'computer', 'packaging')),
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    fit_x INTEGER NOT NULL DEFAULT 0,
    fit_y INTEGER NOT NULL DEFAULT 0,
    fit_width INTEGER NOT NULL,
    fit_height INTEGER NOT NULL,
    permission TEXT NOT NULL DEFAULT 'public' CHECK(permission IN ('public', 'private', 'restricted')),
    is_stable INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_version ON template_versions(template_id, version_number);
CREATE INDEX IF NOT EXISTS idx_template_versions_stable ON template_versions(template_id, is_stable);
CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, template_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_template_id ON favorites(template_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorites(created_at);
CREATE TABLE IF NOT EXISTS template_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, template_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_template_id ON template_ratings(template_id);
CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON template_ratings(created_at);
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    template_id INTEGER NOT NULL REFERENCES templates(id),
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'refunded', 'failed')),
    payment_method TEXT,
    transaction_id TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_template_id ON transactions(template_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE TABLE IF NOT EXISTS export_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL CHECK(type IN ('personal_data', 'analytics_report')),
    format TEXT NOT NULL CHECK(format IN ('json', 'csv', 'pdf')),
    file_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    parameters TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_exports_user_id ON export_records(user_id);
CREATE INDEX IF NOT EXISTS idx_exports_status ON export_records(status);
CREATE INDEX IF NOT EXISTS idx_exports_created_at ON export_records(created_at);
CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    region TEXT,
    country TEXT,
    city TEXT,
    bio TEXT,
    preferred_categories TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_profiles_region ON user_profiles(region);
CREATE INDEX IF NOT EXISTS idx_user_profiles_country ON user_profiles(country);
`)

const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@mockup.studio')
if (!adminExists) {
  const passwordHash = bcryptjs.hashSync('admin123', 10)
  db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)').run(
    'admin@mockup.studio',
    passwordHash,
    'Admin',
    'admin'
  )
}

import('./seed-analytics.js').then(module => {
  try {
    module.default()
  } catch (err) {
    console.error('Failed to seed analytics data:', err)
  }
})

export default db
