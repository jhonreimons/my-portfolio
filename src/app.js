require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDatabase, run, get, all } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
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

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ message: 'Unauthorized. Please login first.' });
}
function parseTags(tags) { return String(tags || '').split(',').map(t => t.trim()).filter(Boolean); }
function normalizeTags(tags) { return Array.isArray(tags) ? tags.join(',') : String(tags || ''); }

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'my-portfolio', timestamp: new Date().toISOString() }));

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return res.status(401).json({ message: 'Invalid username or password.' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ message: 'Invalid username or password.' });
    req.session.user = { id: user.id, username: user.username };
    res.json({ message: 'Login successful.', user: req.session.user });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Login failed.' }); }
});
app.post('/api/logout', (req, res) => req.session.destroy(() => { res.clearCookie('portfolio.sid'); res.json({ message: 'Logout successful.' }); }));
app.get('/api/me', (req, res) => req.session.user ? res.json({ authenticated: true, user: req.session.user }) : res.status(401).json({ authenticated: false }));

app.get('/api/portfolio', async (req, res) => {
  try {
    const skills = await all('SELECT * FROM skills ORDER BY sort_order ASC, id ASC');
    const experiences = await all('SELECT * FROM experiences ORDER BY sort_order ASC, id ASC');
    const contacts = await all('SELECT * FROM contacts ORDER BY sort_order ASC, id ASC');
    res.json({ skills, experiences: experiences.map(i => ({ ...i, tags: parseTags(i.tags) })), contacts });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Failed to load portfolio data.' }); }
});

app.get('/api/admin/skills', requireAuth, async (req, res) => res.json(await all('SELECT * FROM skills ORDER BY sort_order ASC, id ASC')));
app.post('/api/admin/skills', requireAuth, async (req, res) => {
  const { name, category, level, description, sort_order } = req.body;
  const r = await run('INSERT INTO skills (name,category,level,description,sort_order) VALUES (?,?,?,?,?)', [name, category, level, description, Number(sort_order || 0)]);
  res.status(201).json({ id: r.id, message: 'Skill created.' });
});
app.put('/api/admin/skills/:id', requireAuth, async (req, res) => {
  const { name, category, level, description, sort_order } = req.body;
  await run('UPDATE skills SET name=?, category=?, level=?, description=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [name, category, level, description, Number(sort_order || 0), req.params.id]);
  res.json({ message: 'Skill updated.' });
});
app.delete('/api/admin/skills/:id', requireAuth, async (req, res) => { await run('DELETE FROM skills WHERE id=?', [req.params.id]); res.json({ message: 'Skill deleted.' }); });

app.get('/api/admin/experiences', requireAuth, async (req, res) => {
  const rows = await all('SELECT * FROM experiences ORDER BY sort_order ASC, id ASC');
  res.json(rows.map(r => ({ ...r, tags: parseTags(r.tags) })));
});
app.post('/api/admin/experiences', requireAuth, async (req, res) => {
  const { title, company, period, description, tags, sort_order } = req.body;
  const r = await run('INSERT INTO experiences (title,company,period,description,tags,sort_order) VALUES (?,?,?,?,?,?)', [title, company, period, description, normalizeTags(tags), Number(sort_order || 0)]);
  res.status(201).json({ id: r.id, message: 'Experience created.' });
});
app.put('/api/admin/experiences/:id', requireAuth, async (req, res) => {
  const { title, company, period, description, tags, sort_order } = req.body;
  await run('UPDATE experiences SET title=?, company=?, period=?, description=?, tags=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [title, company, period, description, normalizeTags(tags), Number(sort_order || 0), req.params.id]);
  res.json({ message: 'Experience updated.' });
});
app.delete('/api/admin/experiences/:id', requireAuth, async (req, res) => { await run('DELETE FROM experiences WHERE id=?', [req.params.id]); res.json({ message: 'Experience deleted.' }); });

app.get('/api/admin/contacts', requireAuth, async (req, res) => res.json(await all('SELECT * FROM contacts ORDER BY sort_order ASC, id ASC')));
app.post('/api/admin/contacts', requireAuth, async (req, res) => {
  const { type, label, value, url, sort_order } = req.body;
  const r = await run('INSERT INTO contacts (type,label,value,url,sort_order) VALUES (?,?,?,?,?)', [type, label, value, url, Number(sort_order || 0)]);
  res.status(201).json({ id: r.id, message: 'Contact created.' });
});
app.put('/api/admin/contacts/:id', requireAuth, async (req, res) => {
  const { type, label, value, url, sort_order } = req.body;
  await run('UPDATE contacts SET type=?, label=?, value=?, url=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [type, label, value, url, Number(sort_order || 0), req.params.id]);
  res.json({ message: 'Contact updated.' });
});
app.delete('/api/admin/contacts/:id', requireAuth, async (req, res) => { await run('DELETE FROM contacts WHERE id=?', [req.params.id]); res.json({ message: 'Contact deleted.' }); });

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));
initDatabase().then(() => app.listen(PORT, '127.0.0.1', () => console.log(`Portfolio app running on http://127.0.0.1:${PORT}`))).catch(err => { console.error(err); process.exit(1); });
