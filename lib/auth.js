const crypto = require('crypto');

let SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  console.warn(
    'WARNUNG: SESSION_SECRET ist nicht gesetzt. Es wird ein zufälliges, nur für diesen ' +
    'Prozess gültiges Geheimnis verwendet – bestehende Logins werden bei jedem Neustart ' +
    'ungültig. Bitte SESSION_SECRET als Umgebungsvariable setzen (z. B. `openssl rand -hex 32`).'
  );
  SECRET = crypto.randomBytes(32).toString('hex');
}
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 Stunden
const COOKIE_NAME = 'bambini_auth';

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function createToken() {
  const payload = `staff.${Date.now() + MAX_AGE_MS}`;
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token) return false;
  const sepIndex = token.lastIndexOf('.');
  if (sepIndex === -1) return false;
  const payload = token.slice(0, sepIndex);
  const sig = token.slice(sepIndex + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  const expiry = Number(payload.split('.')[1]);
  return Date.now() < expiry;
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1));
  });
  return out;
}

function cookieHeader(token, secure) {
  const parts = [`${COOKIE_NAME}=${token}`, 'HttpOnly', 'Path=/', 'SameSite=Strict', `Max-Age=${MAX_AGE_MS / 1000}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearCookieHeader(secure) {
  const parts = [`${COOKIE_NAME}=`, 'HttpOnly', 'Path=/', 'SameSite=Strict', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

module.exports = { COOKIE_NAME, createToken, verifyToken, parseCookies, cookieHeader, clearCookieHeader };
