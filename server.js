const path = require('path');
const crypto = require('crypto');
const express = require('express');
const store = require('./lib/store');
const auth = require('./lib/auth');

const STAFF_USERNAME = 'bambini';
const STAFF_PASSWORD = 'bambini2024*';

const app = express();
app.use(express.json());

function isSecure(req) {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function isLoggedIn(req) {
  const cookies = auth.parseCookies(req.headers.cookie);
  return auth.verifyToken(cookies[auth.COOKIE_NAME]);
}

function requireAuth(req, res, next) {
  if (isLoggedIn(req)) return next();
  res.status(401).json({ error: 'Nicht angemeldet.' });
}

// ---------- Auth ----------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === STAFF_USERNAME && password === STAFF_PASSWORD) {
    res.setHeader('Set-Cookie', auth.cookieHeader(auth.createToken(), isSecure(req)));
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Benutzername oder Passwort ist falsch.' });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', auth.clearCookieHeader(isSecure(req)));
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  res.json({ loggedIn: isLoggedIn(req) });
});

// ---------- Terminanfragen ----------
app.post('/api/termine', async (req, res) => {
  const { name, alter, wann, anliegen, kontakt } = req.body || {};
  if (!name || !kontakt) {
    return res.status(400).json({ error: 'Name und Kontakt sind erforderlich.' });
  }
  const termine = await store.readTermine();
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
  await store.writeTermine(termine);
  res.status(201).json({ ok: true });
});

app.get('/api/termine', requireAuth, async (req, res) => {
  res.json(await store.readTermine());
});

app.patch('/api/termine/:id', requireAuth, async (req, res) => {
  const termine = await store.readTermine();
  const eintrag = termine.find(t => t.id === req.params.id);
  if (!eintrag) return res.status(404).json({ error: 'Nicht gefunden.' });
  if (req.body && (req.body.status === 'offen' || req.body.status === 'erledigt')) {
    eintrag.status = req.body.status;
  }
  await store.writeTermine(termine);
  res.json({ ok: true });
});

app.delete('/api/termine/:id', requireAuth, async (req, res) => {
  const termine = await store.readTermine();
  const next = termine.filter(t => t.id !== req.params.id);
  await store.writeTermine(next);
  res.json({ ok: true });
});

// ---------- Feiertage ----------
app.get('/api/feiertage', async (req, res) => {
  const feiertage = (await store.readFeiertage()).sort((a, b) => a.datum.localeCompare(b.datum));
  res.json(feiertage);
});

app.post('/api/feiertage', requireAuth, async (req, res) => {
  const { datum, name } = req.body || {};
  if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum) || !name) {
    return res.status(400).json({ error: 'Datum (JJJJ-MM-TT) und Bezeichnung sind erforderlich.' });
  }
  const feiertage = await store.readFeiertage();
  feiertage.push({ id: crypto.randomUUID(), datum, name: String(name).slice(0, 100) });
  await store.writeFeiertage(feiertage);
  res.status(201).json({ ok: true });
});

app.delete('/api/feiertage/:id', requireAuth, async (req, res) => {
  const feiertage = await store.readFeiertage();
  const next = feiertage.filter(f => f.id !== req.params.id);
  await store.writeFeiertage(next);
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Bambini Kinder Praxis Website läuft auf http://localhost:${PORT}`);
  });
}

module.exports = app;
