const crypto = require('crypto');
const store = require('./store');

// First start: the previous shared login becomes the admin account (or STAFF_USERNAME /
// STAFF_PASSWORD if set) and is flagged so the staff page asks for a new password.
const DEFAULT_USERNAME = 'bambini';
const DEFAULT_PASSWORD = 'bambini2024*';
const MIN_PASSWORD = 10;
const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}

function passwordMatches(password, user) {
  const expected = Buffer.from(user.hash, 'hex');
  const actual = crypto.scryptSync(String(password), user.salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

const DUMMY = hashPassword('timing-equaliser');

async function all() {
  let users = await store.readBenutzer();
  if (!users.length) {
    const password = process.env.STAFF_PASSWORD || DEFAULT_PASSWORD;
    users = [{
      id: crypto.randomUUID(),
      username: (process.env.STAFF_USERNAME || DEFAULT_USERNAME).toLowerCase(),
      ...hashPassword(password),
      rolle: 'admin',
      version: 1,
      mustChange: !process.env.STAFF_PASSWORD,
      createdAt: new Date().toISOString()
    }];
    await store.writeBenutzer(users);
  }
  return users;
}

const publicView = u => ({ id: u.id, username: u.username, rolle: u.rolle, mustChange: !!u.mustChange, createdAt: u.createdAt });

async function authenticate(username, password) {
  const users = await all();
  const user = users.find(u => u.username === String(username).trim().toLowerCase());
  if (!user) { passwordMatches(password, DUMMY); return null; }
  return passwordMatches(password, user) ? user : null;
}

async function findSession(username, version) {
  const users = await all();
  return users.find(u => u.username === username && u.version === version) || null;
}

function checkNewPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return `Das Passwort muss mindestens ${MIN_PASSWORD} Zeichen lang sein.`;
  }
  return null;
}

async function setPassword(id, password, { mustChange = false } = {}) {
  const users = await all();
  const user = users.find(u => u.id === id);
  if (!user) return null;
  Object.assign(user, hashPassword(password), { version: user.version + 1, mustChange });
  await store.writeBenutzer(users);
  return user;
}

async function create(username, password, rolle) {
  const name = String(username || '').trim().toLowerCase();
  if (!USERNAME_RE.test(name)) return { error: 'Benutzername: 3–32 Zeichen, nur Kleinbuchstaben, Ziffern, Punkt, Binde- oder Unterstrich.' };
  const pwError = checkNewPassword(password);
  if (pwError) return { error: pwError };
  const users = await all();
  if (users.some(u => u.username === name)) return { error: 'Diesen Benutzernamen gibt es bereits.' };
  const user = {
    id: crypto.randomUUID(), username: name, ...hashPassword(password),
    rolle: rolle === 'admin' ? 'admin' : 'mitarbeiter', version: 1, mustChange: true,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  await store.writeBenutzer(users);
  return { user };
}

async function remove(id, actingUserId) {
  const users = await all();
  const user = users.find(u => u.id === id);
  if (!user) return { error: 'Nicht gefunden.' };
  if (id === actingUserId) return { error: 'Sie können Ihr eigenes Konto nicht löschen.' };
  if (user.rolle === 'admin' && users.filter(u => u.rolle === 'admin').length === 1) {
    return { error: 'Das letzte Admin-Konto kann nicht gelöscht werden.' };
  }
  await store.writeBenutzer(users.filter(u => u.id !== id));
  return { ok: true };
}

module.exports = { all, publicView, authenticate, findSession, passwordMatches, checkNewPassword, setPassword, create, remove };
