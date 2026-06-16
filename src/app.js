require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { initDatabase, run, get, all } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `profile-${Date.now()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(allowed.includes(file.mimetype) ? null : new Error('Only JPG, PNG, and WEBP images are allowed.'), allowed.includes(file.mimetype));
  },
  limits: { fileSize: 2 * 1024 * 1024 }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: 'portfolio.sid',
  secret: process.env.SESSION_SECRET || 'change-this-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(uploadDir));

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ message: 'Unauthorized. Please login first.' });
}
function parseTags(tags) { return String(tags || '').split(',').map(t => t.trim()).filter(Boolean); }
function normalizeTags(tags) { return Array.isArray(tags) ? tags.join(',') : String(tags || ''); }
function deleteFileIfExists(publicPath) {
  if (!publicPath || !publicPath.startsWith('/uploads/')) return;
  const filePath = path.join(uploadDir, path.basename(publicPath));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'my-portfolio', timestamp: new Date().toISOString() }));

app.post('/api/login', async (req, res) => {
  try {
    const user = await get('SELECT * FROM users WHERE username = ?', [req.body.username]);
    if (!user) return res.status(401).json({ message: 'Invalid username or password.' });
    const valid = await bcrypt.compare(req.body.password || '', user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid username or password.' });
    req.session.user = { id: user.id, username: user.username };
    res.json({ message: 'Login successful.', user: req.session.user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Login failed.' });
  }
});
app.post('/api/logout', (req, res) => req.session.destroy(() => { res.clearCookie('portfolio.sid'); res.json({ message: 'Logout successful.' }); }));
app.get('/api/me', (req, res) => req.session.user ? res.json({ authenticated: true, user: req.session.user }) : res.status(401).json({ authenticated: false }));

app.get('/api/portfolio', async (req, res) => {
  try {
    const [photo, skills, experiences, contacts] = await Promise.all([
      get('SELECT * FROM profile_photo WHERE id = 1'),
      all('SELECT * FROM skills ORDER BY sort_order ASC, id ASC'),
      all('SELECT * FROM experiences ORDER BY sort_order ASC, id ASC'),
      all('SELECT * FROM contacts ORDER BY sort_order ASC, id ASC')
    ]);
    res.json({ profilePhoto: photo || null, skills, experiences: experiences.map(e => ({ ...e, tags: parseTags(e.tags) })), contacts });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load portfolio data.' });
  }
});

app.get('/api/admin/photo', requireAuth, async (req, res) => res.json(await get('SELECT * FROM profile_photo WHERE id = 1') || {}));
app.post('/api/admin/photo', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const existing = await get('SELECT * FROM profile_photo WHERE id = 1');
    let imagePath = existing ? existing.image_path : null;
    let originalName = existing ? existing.original_name : null;
    if (req.file) {
      if (existing && existing.image_path) deleteFileIfExists(existing.image_path);
      imagePath = `/uploads/${req.file.filename}`;
      originalName = req.file.originalname;
    }
    await run(`INSERT INTO profile_photo (id, image_path, original_name, alt_text, headline, updated_at)
      VALUES (1, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET image_path=excluded.image_path, original_name=excluded.original_name,
      alt_text=excluded.alt_text, headline=excluded.headline, updated_at=CURRENT_TIMESTAMP`,
      [imagePath, originalName, req.body.alt_text || 'Jhon Reimon Siagian', req.body.headline || 'DevOps Engineer']);
    res.json({ message: 'Profile photo updated.', photo: await get('SELECT * FROM profile_photo WHERE id = 1') });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to update profile photo.' });
  }
});
app.delete('/api/admin/photo', requireAuth, async (req, res) => {
  const existing = await get('SELECT * FROM profile_photo WHERE id = 1');
  if (existing && existing.image_path) deleteFileIfExists(existing.image_path);
  await run('UPDATE profile_photo SET image_path = NULL, original_name = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 1');
  res.json({ message: 'Profile photo deleted.' });
});

app.get('/api/admin/skills', requireAuth, async (req, res) => res.json(await all('SELECT * FROM skills ORDER BY sort_order ASC, id ASC')));
app.post('/api/admin/skills', requireAuth, async (req, res) => {
  const r = await run('INSERT INTO skills (name, category, level, description, sort_order) VALUES (?, ?, ?, ?, ?)', [req.body.name, req.body.category, req.body.level, req.body.description, Number(req.body.sort_order || 0)]);
  res.status(201).json({ id: r.id, message: 'Skill created.' });
});
app.put('/api/admin/skills/:id', requireAuth, async (req, res) => {
  await run('UPDATE skills SET name=?, category=?, level=?, description=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [req.body.name, req.body.category, req.body.level, req.body.description, Number(req.body.sort_order || 0), req.params.id]);
  res.json({ message: 'Skill updated.' });
});
app.delete('/api/admin/skills/:id', requireAuth, async (req, res) => { await run('DELETE FROM skills WHERE id=?', [req.params.id]); res.json({ message: 'Skill deleted.' }); });

app.get('/api/admin/experiences', requireAuth, async (req, res) => res.json((await all('SELECT * FROM experiences ORDER BY sort_order ASC, id ASC')).map(r => ({ ...r, tags: parseTags(r.tags) }))));
app.post('/api/admin/experiences', requireAuth, async (req, res) => {
  const r = await run('INSERT INTO experiences (title, company, period, description, tags, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [req.body.title, req.body.company, req.body.period, req.body.description, normalizeTags(req.body.tags), Number(req.body.sort_order || 0)]);
  res.status(201).json({ id: r.id, message: 'Experience created.' });
});
app.put('/api/admin/experiences/:id', requireAuth, async (req, res) => {
  await run('UPDATE experiences SET title=?, company=?, period=?, description=?, tags=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [req.body.title, req.body.company, req.body.period, req.body.description, normalizeTags(req.body.tags), Number(req.body.sort_order || 0), req.params.id]);
  res.json({ message: 'Experience updated.' });
});
app.delete('/api/admin/experiences/:id', requireAuth, async (req, res) => { await run('DELETE FROM experiences WHERE id=?', [req.params.id]); res.json({ message: 'Experience deleted.' }); });

app.get('/api/admin/contacts', requireAuth, async (req, res) => res.json(await all('SELECT * FROM contacts ORDER BY sort_order ASC, id ASC')));
app.post('/api/admin/contacts', requireAuth, async (req, res) => {
  const r = await run('INSERT INTO contacts (type, label, value, url, sort_order) VALUES (?, ?, ?, ?, ?)', [req.body.type, req.body.label, req.body.value, req.body.url, Number(req.body.sort_order || 0)]);
  res.status(201).json({ id: r.id, message: 'Contact created.' });
});
app.put('/api/admin/contacts/:id', requireAuth, async (req, res) => {
  await run('UPDATE contacts SET type=?, label=?, value=?, url=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [req.body.type, req.body.label, req.body.value, req.body.url, Number(req.body.sort_order || 0), req.params.id]);
  res.json({ message: 'Contact updated.' });
});
app.delete('/api/admin/contacts/:id', requireAuth, async (req, res) => { await run('DELETE FROM contacts WHERE id=?', [req.params.id]); res.json({ message: 'Contact deleted.' }); });

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
app.use((error, req, res, next) => res.status(400).json({ message: error.message || 'Upload failed.' }));

initDatabase().then(() => app.listen(PORT, '127.0.0.1', () => {
  console.log(`Portfolio app running on http://127.0.0.1:${PORT}`);
  console.log(`Uploads directory: ${uploadDir}`);
})).catch(error => { console.error('Failed to initialize database:', error); process.exit(1); });
