const path = require('path');
const crypto = require('crypto');
const express = require('express');
const store = require('./lib/store');
const auth = require('./lib/auth');
const rateLimit = require('./lib/rateLimit');
const users = require('./lib/users');
const mail = require('./lib/mail');
const schedule = require('./lib/schedule');

const RETENTION_DAYS = 90;
const STATUSES = ['offen', 'bestaetigt', 'abgelehnt', 'erledigt'];

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

function isSecure(req) {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

async function sessionUser(req) {
  const cookies = auth.parseCookies(req.headers.cookie);
  const session = auth.verifyToken(cookies[auth.COOKIE_NAME]);
  return session ? users.findSession(session.username, session.version) : null;
}

async function requireAuth(req, res, next) {
  req.user = await sessionUser(req);
  if (req.user) return next();
  res.status(401).json({ error: 'Nicht angemeldet.' });
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.rolle === 'admin') return next();
  res.status(403).json({ error: 'Nur für Administrator:innen.' });
}

const str = (value, max) => String(value ?? '').trim().slice(0, max);

async function readHours() {
  return (await store.readOeffnungszeiten()) || schedule.DEFAULT_HOURS;
}

// Requests are removed RETENTION_DAYS after the appointment date (or after arrival if
// they have no date), so patient data is not kept longer than needed.
async function readTermine() {
  const all = await store.readTermine();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 864e5);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const kept = all.filter(t => (t.datum ? t.datum >= cutoffDate : new Date(t.createdAt) >= cutoff));
  if (kept.length !== all.length) await store.writeTermine(kept);
  return kept;
}

// ---------- Auth & accounts ----------
app.post('/api/login', async (req, res) => {
  const ip = rateLimit.clientIp(req);
  const limited = await rateLimit.hit(`ratelimit:login:${ip}`, 8, 15 * 60);
  if (limited.limited) {
    res.setHeader('Retry-After', String(limited.retryAfter));
    return res.status(429).json({ error: 'Zu viele Anmeldeversuche. Bitte spaeter erneut versuchen.' });
  }

  const { username, password } = req.body || {};
  const user = typeof username === 'string' && typeof password === 'string'
    ? await users.authenticate(username, password) : null;
  if (!user) return res.status(401).json({ error: 'Benutzername oder Passwort ist falsch.' });
  res.setHeader('Set-Cookie', auth.cookieHeader(auth.createToken(user.username, user.version), isSecure(req)));
  res.json({ ok: true, user: users.publicView(user) });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', auth.clearCookieHeader(isSecure(req)));
  res.json({ ok: true });
});

app.get('/api/session', async (req, res) => {
  const user = await sessionUser(req);
  res.json({ loggedIn: !!user, user: user ? users.publicView(user) : null });
});

app.post('/api/passwort', requireAuth, async (req, res) => {
  const { alt, neu } = req.body || {};
  if (!users.passwordMatches(alt || '', req.user)) return res.status(400).json({ error: 'Das aktuelle Passwort ist falsch.' });
  const problem = users.checkNewPassword(neu);
  if (problem) return res.status(400).json({ error: problem });
  const updated = await users.setPassword(req.user.id, neu);
  res.setHeader('Set-Cookie', auth.cookieHeader(auth.createToken(updated.username, updated.version), isSecure(req)));
  res.json({ ok: true });
});

app.get('/api/benutzer', requireAuth, requireAdmin, async (req, res) => {
  res.json((await users.all()).map(users.publicView));
});

app.post('/api/benutzer', requireAuth, requireAdmin, async (req, res) => {
  const { username, passwort, rolle } = req.body || {};
  const result = await users.create(username, passwort, rolle);
  if (result.error) return res.status(400).json({ error: result.error });
  res.status(201).json(users.publicView(result.user));
});

app.post('/api/benutzer/:id/passwort', requireAuth, requireAdmin, async (req, res) => {
  const problem = users.checkNewPassword(req.body?.passwort);
  if (problem) return res.status(400).json({ error: problem });
  const updated = await users.setPassword(req.params.id, req.body.passwort, { mustChange: req.params.id !== req.user.id });
  if (!updated) return res.status(404).json({ error: 'Nicht gefunden.' });
  res.json({ ok: true });
});

app.delete('/api/benutzer/:id', requireAuth, requireAdmin, async (req, res) => {
  const result = await users.remove(req.params.id, req.user.id);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ ok: true });
});

// ---------- Terminanfragen ----------
app.post('/api/termine', async (req, res) => {
  const ip = rateLimit.clientIp(req);
  const limited = await rateLimit.hit(`ratelimit:termine:${ip}`, 10, 60 * 60);
  if (limited.limited) {
    res.setHeader('Retry-After', String(limited.retryAfter));
    return res.status(429).json({ error: 'Zu viele Anfragen. Bitte spaeter erneut versuchen.' });
  }

  const { name, alter, datum, zeit, anliegen, kontakt } = req.body || {};
  if (!name || !kontakt) {
    return res.status(400).json({ error: 'Name und Kontakt sind erforderlich.' });
  }
  if (!datum || !schedule.DATE_RE.test(datum) || !zeit || !schedule.TIME_RE.test(zeit)) {
    return res.status(400).json({ error: 'Bitte waehlen Sie ein gueltiges Datum und eine Uhrzeit.' });
  }

  const [hours, feiertage, sperrzeiten, termine] = await Promise.all([
    readHours(), store.readFeiertage(), store.readSperrzeiten(), readTermine()
  ]);
  const today = schedule.viennaToday();
  const inPast = datum < today || (datum === today && schedule.toMin(zeit) <= schedule.viennaMinutes());
  if (inPast || schedule.closureFor(datum, feiertage) || !schedule.slotsFor(datum, hours).includes(zeit)
      || schedule.blockedSlots(datum, sperrzeiten, hours).has(zeit)) {
    return res.status(409).json({ error: 'Dieser Termin ist leider nicht verfuegbar.' });
  }
  if (termine.some(t => t.datum === datum && t.zeit === zeit && t.status !== 'abgelehnt')) {
    return res.status(409).json({ error: 'Dieser Termin ist leider bereits vergeben.' });
  }

  const eintrag = {
    id: crypto.randomUUID(),
    name: str(name, 200),
    alter: str(alter, 50),
    datum,
    zeit,
    anliegen: str(anliegen, 500),
    kontakt: str(kontakt, 200),
    status: 'offen',
    createdAt: new Date().toISOString()
  };
  termine.unshift(eintrag);
  await store.writeTermine(termine);

  // Deliberately no patient details in the email – they stay in the staff area.
  const [y, m, d] = datum.split('-');
  await mail.trySend({
    to: mail.NOTIFY_EMAIL,
    subject: `Neue Terminanfrage für ${d}.${m}.${y}, ${zeit} Uhr`,
    text: `Über die Website ist eine neue Terminanfrage für ${d}.${m}.${y} um ${zeit} Uhr eingegangen.\n\n`
      + `Details im Mitarbeiterbereich: ${req.protocol}://${req.get('host')}/staff.html`
  });
  res.status(201).json({ ok: true });
});

app.get('/api/termine/belegt', async (req, res) => {
  const datum = String(req.query.datum || '');
  if (!schedule.DATE_RE.test(datum)) {
    return res.status(400).json({ error: 'Ungueltiges Datum.' });
  }
  const [termine, sperrzeiten, hours] = await Promise.all([readTermine(), store.readSperrzeiten(), readHours()]);
  const taken = new Set(termine.filter(t => t.datum === datum && t.zeit && t.status !== 'abgelehnt').map(t => t.zeit));
  schedule.blockedSlots(datum, sperrzeiten, hours).forEach(t => taken.add(t));
  res.json([...taken]);
});

app.get('/api/termine', requireAuth, async (req, res) => {
  res.json(await readTermine());
});

app.patch('/api/termine/:id', requireAuth, async (req, res) => {
  const termine = await readTermine();
  const eintrag = termine.find(t => t.id === req.params.id);
  if (!eintrag) return res.status(404).json({ error: 'Nicht gefunden.' });
  const status = req.body?.status;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Ungueltiger Status.' });
  eintrag.status = status;
  await store.writeTermine(termine);

  let mailResult = 'skipped';
  if (req.body.benachrichtigen && (status === 'bestaetigt' || status === 'abgelehnt')) {
    if (!mail.isEmail(eintrag.kontakt)) {
      mailResult = 'no-email';
    } else {
      const [y, m, d] = eintrag.datum.split('-');
      const when = `${d}.${m}.${y} um ${eintrag.zeit} Uhr`;
      mailResult = await mail.trySend({
        to: eintrag.kontakt.trim(),
        subject: status === 'bestaetigt' ? `Ihr Termin am ${d}.${m}.${y} ist bestätigt` : 'Ihre Terminanfrage bei der Bambini Kinder Praxis',
        text: status === 'bestaetigt'
          ? `Guten Tag,\n\nIhr Termin in der Bambini Kinder Praxis am ${when} ist bestätigt.\n\n`
            + 'Bitte bringen Sie die e-card Ihres Kindes mit. Falls Sie den Termin nicht wahrnehmen können, '
            + 'sagen Sie bitte unter 01 / 346 06 71 ab.\n\nBambini Kinder Praxis · Altmannsdorfer Straße 89/2/5 · 1120 Wien'
          : `Guten Tag,\n\nleider können wir Ihre Terminanfrage für ${when} nicht bestätigen. `
            + 'Bitte wählen Sie auf unserer Website einen anderen Termin oder rufen Sie uns unter 01 / 346 06 71 an.\n\n'
            + 'Bambini Kinder Praxis · Altmannsdorfer Straße 89/2/5 · 1120 Wien'
      });
    }
  }
  res.json({ ok: true, mail: mailResult });
});

app.delete('/api/termine/:id', requireAuth, async (req, res) => {
  const termine = await readTermine();
  await store.writeTermine(termine.filter(t => t.id !== req.params.id));
  res.json({ ok: true });
});

// ---------- Öffnungszeiten ----------
app.get('/api/oeffnungszeiten', async (req, res) => {
  res.json(await readHours());
});

app.put('/api/oeffnungszeiten', requireAuth, requireAdmin, async (req, res) => {
  const hours = schedule.sanitizeHours(req.body);
  if (!hours) return res.status(400).json({ error: 'Ungueltige Oeffnungszeiten (Format HH:MM, Beginn vor Ende, keine Ueberschneidungen).' });
  await store.writeOeffnungszeiten(hours);
  res.json(hours);
});

// ---------- Feiertage & Schließzeiten ----------
app.get('/api/feiertage', async (req, res) => {
  const feiertage = (await store.readFeiertage()).sort((a, b) => a.datum.localeCompare(b.datum));
  res.json(feiertage);
});

app.post('/api/feiertage', requireAuth, requireAdmin, async (req, res) => {
  const { datum, bis, name } = req.body || {};
  if (!datum || !schedule.DATE_RE.test(datum) || !name) {
    return res.status(400).json({ error: 'Datum (JJJJ-MM-TT) und Bezeichnung sind erforderlich.' });
  }
  if (bis && (!schedule.DATE_RE.test(bis) || bis < datum)) {
    return res.status(400).json({ error: 'Das Enddatum muss nach dem Startdatum liegen.' });
  }
  const feiertage = await store.readFeiertage();
  feiertage.push({ id: crypto.randomUUID(), datum, ...(bis && bis !== datum ? { bis } : {}), name: str(name, 100) });
  await store.writeFeiertage(feiertage);
  res.status(201).json({ ok: true });
});

app.delete('/api/feiertage/:id', requireAuth, requireAdmin, async (req, res) => {
  const feiertage = await store.readFeiertage();
  const next = feiertage.filter(f => f.id !== req.params.id);
  await store.writeFeiertage(next);
  res.json({ ok: true });
});

// ---------- Gesperrte Zeiten ----------
app.get('/api/sperrzeiten', requireAuth, requireAdmin, async (req, res) => {
  res.json((await store.readSperrzeiten()).sort((a, b) => (a.datum + (a.von || '')).localeCompare(b.datum + (b.von || ''))));
});

app.post('/api/sperrzeiten', requireAuth, requireAdmin, async (req, res) => {
  const { datum, von, bis, grund } = req.body || {};
  if (!datum || !schedule.DATE_RE.test(datum)) return res.status(400).json({ error: 'Bitte ein gueltiges Datum angeben.' });
  if ((von || bis) && !(schedule.TIME_RE.test(von) && schedule.TIME_RE.test(bis) && schedule.toMin(von) < schedule.toMin(bis))) {
    return res.status(400).json({ error: 'Bitte Beginn und Ende angeben (Beginn vor Ende) – oder beide leer lassen fuer den ganzen Tag.' });
  }
  const sperrzeiten = await store.readSperrzeiten();
  sperrzeiten.push({ id: crypto.randomUUID(), datum, von: von || '', bis: bis || '', grund: str(grund, 100) });
  await store.writeSperrzeiten(sperrzeiten);
  res.status(201).json({ ok: true });
});

app.delete('/api/sperrzeiten/:id', requireAuth, requireAdmin, async (req, res) => {
  const sperrzeiten = await store.readSperrzeiten();
  await store.writeSperrzeiten(sperrzeiten.filter(s => s.id !== req.params.id));
  res.json({ ok: true });
});

// ---------- Hinweis-Banner ----------
app.get('/api/hinweis', async (req, res) => {
  const hinweis = await store.readHinweis();
  res.json(hinweis && hinweis.aktiv && hinweis.text ? hinweis : { aktiv: false });
});

app.get('/api/hinweis/bearbeiten', requireAuth, requireAdmin, async (req, res) => {
  res.json((await store.readHinweis()) || { text: '', aktiv: false, stil: 'info' });
});

app.put('/api/hinweis', requireAuth, requireAdmin, async (req, res) => {
  const { text, aktiv, stil } = req.body || {};
  const hinweis = { text: str(text, 240), aktiv: !!aktiv && !!str(text, 240), stil: stil === 'wichtig' ? 'wichtig' : 'info', updatedAt: new Date().toISOString() };
  await store.writeHinweis(hinweis);
  res.json(hinweis);
});

// ---------- Mitarbeiter (Team) ----------
const BILD_RE = /^data:image\/(png|jpeg|jpg|webp);base64,/;
const validBild = bild => typeof bild === 'string' && BILD_RE.test(bild) && bild.length <= 1_500_000;
const cleanSprachen = sprachen => (Array.isArray(sprachen)
  ? sprachen.map(s => str(s, 30)).filter(Boolean).slice(0, 10) : []);

app.get('/api/mitarbeiter', async (req, res) => {
  res.json(await store.readMitarbeiter());
});

app.post('/api/mitarbeiter', requireAuth, requireAdmin, async (req, res) => {
  const { name, rolle, sprachen, bild } = req.body || {};
  if (!name || !rolle) {
    return res.status(400).json({ error: 'Name und Rolle sind erforderlich.' });
  }
  if (bild && !validBild(bild)) return res.status(400).json({ error: 'Ungueltiges Bild.' });
  const mitarbeiter = await store.readMitarbeiter();
  mitarbeiter.push({ id: crypto.randomUUID(), name: str(name, 100), rolle: str(rolle, 100), sprachen: cleanSprachen(sprachen), bild: bild || '' });
  await store.writeMitarbeiter(mitarbeiter);
  res.status(201).json({ ok: true });
});

// bild: new data URL replaces the photo, null removes it, omitted keeps it.
app.put('/api/mitarbeiter/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, rolle, sprachen, bild } = req.body || {};
  if (!name || !rolle) return res.status(400).json({ error: 'Name und Rolle sind erforderlich.' });
  if (bild && !validBild(bild)) return res.status(400).json({ error: 'Ungueltiges Bild.' });
  const mitarbeiter = await store.readMitarbeiter();
  const person = mitarbeiter.find(m => m.id === req.params.id);
  if (!person) return res.status(404).json({ error: 'Nicht gefunden.' });
  Object.assign(person, { name: str(name, 100), rolle: str(rolle, 100), sprachen: cleanSprachen(sprachen) });
  if (bild !== undefined) person.bild = bild || '';
  await store.writeMitarbeiter(mitarbeiter);
  res.json({ ok: true });
});

app.post('/api/mitarbeiter/reihenfolge', requireAuth, requireAdmin, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  const mitarbeiter = await store.readMitarbeiter();
  if (ids.length !== mitarbeiter.length || !mitarbeiter.every(m => ids.includes(m.id))) {
    return res.status(400).json({ error: 'Reihenfolge passt nicht zur aktuellen Liste – bitte neu laden.' });
  }
  await store.writeMitarbeiter(ids.map(id => mitarbeiter.find(m => m.id === id)));
  res.json({ ok: true });
});

app.delete('/api/mitarbeiter/:id', requireAuth, requireAdmin, async (req, res) => {
  const mitarbeiter = await store.readMitarbeiter();
  const next = mitarbeiter.filter(m => m.id !== req.params.id);
  await store.writeMitarbeiter(next);
  res.json({ ok: true });
});

// ---------- Status ----------
app.get('/api/status', requireAuth, async (req, res) => {
  res.json({ ...(await store.status()), mail: mail.configured(), retentionDays: RETENTION_DAYS });
});

app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Serverfehler – die Datenbank ist eventuell nicht erreichbar. Bitte später erneut versuchen.' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Bambini Kinder Praxis Website läuft auf http://localhost:${PORT}`);
  });
}

module.exports = app;
