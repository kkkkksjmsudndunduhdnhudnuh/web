const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TERMINE_FILE = path.join(DATA_DIR, 'termine.json');
const FEIERTAGE_FILE = path.join(DATA_DIR, 'feiertage.json');

const STAFF_USERNAME = 'bambini';
const STAFF_PASSWORD = 'bambini2024*';

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const app = express();
app.use(express.json());
app.use(session({
  secret: 'bambini-staff-session-secret',
  name: 'bambini.sid',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.status(401).json({ error: 'Nicht angemeldet.' });
}

// ---------- Auth ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === STAFF_USERNAME && password === STAFF_PASSWORD) {
    req.session.loggedIn = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Benutzername oder Passwort ist falsch.' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.loggedIn) });
});

// ---------- Terminanfragen ----------
app.post('/api/termine', (req, res) => {
  const { name, alter, wann, anliegen, kontakt } = req.body || {};
  if (!name || !kontakt) {
    return res.status(400).json({ error: 'Name und Kontakt sind erforderlich.' });
  }
  const termine = readJson(TERMINE_FILE);
  const eintrag = {
    id: crypto.randomUUID(),
    name: String(name).slice(0, 200),
    alter: String(alter || '').slice(0, 50),
    wann: String(wann || '').slice(0, 100),
    anliegen: String(anliegen || '').slice(0, 500),
    kontakt: String(kontakt).slice(0, 200),
    status: 'offen',
    createdAt: new Date().toISOString()
  };
  termine.unshift(eintrag);
  writeJson(TERMINE_FILE, termine);
  res.status(201).json({ ok: true });
});

app.get('/api/termine', requireAuth, (req, res) => {
  res.json(readJson(TERMINE_FILE));
});

app.patch('/api/termine/:id', requireAuth, (req, res) => {
  const termine = readJson(TERMINE_FILE);
  const eintrag = termine.find(t => t.id === req.params.id);
  if (!eintrag) return res.status(404).json({ error: 'Nicht gefunden.' });
  if (req.body && (req.body.status === 'offen' || req.body.status === 'erledigt')) {
    eintrag.status = req.body.status;
  }
  writeJson(TERMINE_FILE, termine);
  res.json({ ok: true });
});

app.delete('/api/termine/:id', requireAuth, (req, res) => {
  const termine = readJson(TERMINE_FILE);
  const next = termine.filter(t => t.id !== req.params.id);
  writeJson(TERMINE_FILE, next);
  res.json({ ok: true });
});

// ---------- Feiertage ----------
app.get('/api/feiertage', (req, res) => {
  const feiertage = readJson(FEIERTAGE_FILE).sort((a, b) => a.datum.localeCompare(b.datum));
  res.json(feiertage);
});

app.post('/api/feiertage', requireAuth, (req, res) => {
  const { datum, name } = req.body || {};
  if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum) || !name) {
    return res.status(400).json({ error: 'Datum (JJJJ-MM-TT) und Bezeichnung sind erforderlich.' });
  }
  const feiertage = readJson(FEIERTAGE_FILE);
  feiertage.push({ id: crypto.randomUUID(), datum, name: String(name).slice(0, 100) });
  writeJson(FEIERTAGE_FILE, feiertage);
  res.status(201).json({ ok: true });
});

app.delete('/api/feiertage/:id', requireAuth, (req, res) => {
  const feiertage = readJson(FEIERTAGE_FILE);
  const next = feiertage.filter(f => f.id !== req.params.id);
  writeJson(FEIERTAGE_FILE, next);
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Bambini Kinder Praxis Website läuft auf http://localhost:${PORT}`);
});
