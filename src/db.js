const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../database/portfolio.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function (err) {
    if (err) reject(err); else resolve({ id: this.lastID, changes: this.changes });
  }));
}
function get(sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
}
function all(sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
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
  await seedAdminUser();
  await seedData();
}

async function seedAdminUser() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
  if (!existing) {
    const hash = await bcrypt.hash(password, 10);
    await run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
    console.log(`Admin user created: ${username}`);
  }
}

async function seedData() {
  const s = await get('SELECT COUNT(*) AS count FROM skills');
  if (s.count === 0) {
    await run('INSERT INTO skills (name,category,level,description,sort_order) VALUES (?,?,?,?,?)', ['AWS Cloud Infrastructure','Cloud','Advanced','Experience managing AWS services such as EC2, VPC, IAM, S3, Route 53, ALB/NLB, CloudWatch, Lambda, and EventBridge.',1]);
    await run('INSERT INTO skills (name,category,level,description,sort_order) VALUES (?,?,?,?,?)', ['CI/CD & Deployment Automation','DevOps','Advanced','Build and maintain deployment workflows using Git, GitHub, Nginx, PM2, and deployment automation.',2]);
    await run('INSERT INTO skills (name,category,level,description,sort_order) VALUES (?,?,?,?,?)', ['Monitoring & Alerting','Operations','Strong','Create monitoring and alarms using CloudWatch metrics, logs, SNS notifications, and operational health checks.',3]);
  }
  const e = await get('SELECT COUNT(*) AS count FROM experiences');
  if (e.count === 0) {
    await run('INSERT INTO experiences (title,company,period,description,tags,sort_order) VALUES (?,?,?,?,?,?)', ['Cloud / DevOps Engineer','AWS Infrastructure Operations','2023 - Present','Managing cloud infrastructure, deployment pipeline, monitoring, automation, troubleshooting, and security remediation for production and non-production environments.','AWS,CI/CD,CloudWatch,Automation',1]);
    await run('INSERT INTO experiences (title,company,period,description,tags,sort_order) VALUES (?,?,?,?,?,?)', ['Infrastructure Automation & Monitoring','Cloud Operations Project','Project Experience','Created automation scripts and monitoring workflows to support infrastructure reliability and faster operational response.','Lambda,CloudWatch,SNS,Linux',2]);
  }
  const c = await get('SELECT COUNT(*) AS count FROM contacts');
  if (c.count === 0) {
    await run('INSERT INTO contacts (type,label,value,url,sort_order) VALUES (?,?,?,?,?)', ['Email','Email','jhonreimons90@gmail.com','mailto:jhonreimons90@gmail.com',1]);
    await run('INSERT INTO contacts (type,label,value,url,sort_order) VALUES (?,?,?,?,?)', ['LinkedIn','LinkedIn','linkedin.com/in/your-profile','https://www.linkedin.com/',2]);
    await run('INSERT INTO contacts (type,label,value,url,sort_order) VALUES (?,?,?,?,?)', ['GitHub','GitHub','github.com/jhonreimons','https://github.com/jhonreimons',3]);
  }
}
module.exports = { run, get, all, initDatabase };
