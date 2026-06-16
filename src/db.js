const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../database/portfolio.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function cb(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

async function initDatabase() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    level TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS experiences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    company TEXT,
    period TEXT,
    description TEXT,
    tags TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    label TEXT,
    value TEXT,
    url TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS profile_photo (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    image_path TEXT,
    original_name TEXT,
    alt_text TEXT,
    headline TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  await seedAdminUser();
  await seedDefaults();
}

async function seedAdminUser() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const user = await get('SELECT id FROM users WHERE username = ?', [username]);
  if (!user) {
    const hash = await bcrypt.hash(password, 10);
    await run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
    console.log(`Admin user created. Username: ${username}`);
  }
}

async function seedDefaults() {
  const photo = await get('SELECT id FROM profile_photo WHERE id = 1');
  if (!photo) {
    await run('INSERT INTO profile_photo (id, image_path, original_name, alt_text, headline) VALUES (1, NULL, NULL, ?, ?)', ['Jhon Reimon Siagian', 'DevOps Engineer']);
  }

  const skillCount = await get('SELECT COUNT(*) AS count FROM skills');
  if (skillCount.count === 0) {
    const skills = [
      ['AWS Cloud Infrastructure', 'Cloud', 'Advanced', 'Managing AWS services such as EC2, VPC, IAM, S3, Route 53, ALB/NLB, CloudWatch, Lambda, and EventBridge.', 1],
      ['CI/CD & Deployment Automation', 'DevOps', 'Advanced', 'Building practical deployment workflows using Git, GitHub, Nginx, PM2, and automation scripts.', 2],
      ['Monitoring & Alerting', 'Operations', 'Strong', 'Creating CloudWatch metrics, logs, health checks, alarms, and notification workflows.', 3],
      ['Security Remediation', 'Security', 'Strong', 'Handling vulnerability findings, OS patching, IAM access review, DNS/email security, and hardening activities.', 4]
    ];
    for (const s of skills) await run('INSERT INTO skills (name, category, level, description, sort_order) VALUES (?, ?, ?, ?, ?)', s);
  }

  const expCount = await get('SELECT COUNT(*) AS count FROM experiences');
  if (expCount.count === 0) {
    const experiences = [
      ['Cloud / DevOps Engineer', 'AWS Infrastructure Operations', '2023 - Present', 'Managing cloud infrastructure, deployment pipeline, monitoring, automation, troubleshooting, and security remediation for production and non-production environments.', 'AWS,CI/CD,CloudWatch,Automation', 1],
      ['Infrastructure Automation & Monitoring', 'Cloud Operations Project', 'Project Experience', 'Created automation scripts and monitoring workflows to support infrastructure reliability and faster operational response.', 'Lambda,CloudWatch,SNS,Linux', 2]
    ];
    for (const e of experiences) await run('INSERT INTO experiences (title, company, period, description, tags, sort_order) VALUES (?, ?, ?, ?, ?, ?)', e);
  }

  const contactCount = await get('SELECT COUNT(*) AS count FROM contacts');
  if (contactCount.count === 0) {
    const contacts = [
      ['Email', 'Email', 'jhonreimons90@gmail.com', 'mailto:jhonreimons90@gmail.com', 1],
      ['LinkedIn', 'LinkedIn', 'linkedin.com/in/your-profile', 'https://www.linkedin.com/', 2],
      ['GitHub', 'GitHub', 'github.com/jhonreimons', 'https://github.com/jhonreimons', 3],
      ['Instagram', 'Instagram', '@yourusername', 'https://www.instagram.com/', 4]
    ];
    for (const c of contacts) await run('INSERT INTO contacts (type, label, value, url, sort_order) VALUES (?, ?, ?, ?, ?)', c);
  }
}

module.exports = { db, run, get, all, initDatabase };
