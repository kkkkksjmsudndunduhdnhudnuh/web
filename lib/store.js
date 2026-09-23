const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TERMINE_FILE = path.join(DATA_DIR, 'termine.json');
const FEIERTAGE_FILE = path.join(DATA_DIR, 'feiertage.json');
const MITARBEITER_FILE = path.join(DATA_DIR, 'mitarbeiter.json');
const MITARBEITER_SEED_FILE = path.join(DATA_DIR, 'mitarbeiter-seeded.json');

const DEFAULT_MITARBEITER = [
  { id: 'seed-mona-abdalla', name: 'Mona Abdalla', rolle: 'Praxismanagerin', sprachen: ['Deutsch', 'English', 'العربية'], bild: '' },
  { id: 'seed-hana-abu-daher', name: 'Hana Abu Daher', rolle: 'Praxismanagerin', sprachen: [], bild: '' }
];

// Vercel may prefix the variables (e.g. BAMBINI_KV_REST_API_URL), so match by suffix too.
function findEnv(...names) {
  for (const name of names) if (process.env[name]) return process.env[name];
  for (const name of names) {
    const key = Object.keys(process.env).find(k => k.endsWith('_' + name) && process.env[k]);
    if (key) return process.env[key];
  }
  return '';
}

// Upstash also exposes rediss://default:TOKEN@HOST:6379 URLs; the REST API lives on the same host.
function restFromRedisUrl(value) {
  try {
    const u = new URL(value);
    if (!u.hostname.endsWith('upstash.io') || !u.password) return null;
    return { url: `https://${u.hostname}`, token: decodeURIComponent(u.password) };
  } catch {
    return null;
  }
}

let REDIS_URL = findEnv('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL');
let REDIS_TOKEN = findEnv('KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN');
if (!REDIS_URL || !REDIS_TOKEN) {
  const derived = restFromRedisUrl(findEnv('KV_URL', 'REDIS_URL', 'UPSTASH_REDIS_URL'));
  if (derived) ({ url: REDIS_URL, token: REDIS_TOKEN } = derived);
}

let redis = null;
if (REDIS_URL && REDIS_TOKEN) {
  const { Redis } = require('@upstash/redis');
  redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
}

async function status() {
  if (!redis) {
    const redisVars = Object.keys(process.env).filter(k => /REDIS|KV_/.test(k));
    return { storage: 'file', ok: !process.env.VERCEL, envVars: redisVars };
  }
  try {
    await redis.ping();
    return { storage: 'redis', ok: true };
  } catch (err) {
    return { storage: 'redis', ok: false, error: err.message };
  }
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeJsonFile(file, data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function readList(key, file) {
  if (redis) return (await redis.get(key)) || [];
  return readJsonFile(file);
}

async function writeList(key, file, data) {
  if (redis) {
    await redis.set(key, data);
    return;
  }
  writeJsonFile(file, data);
}

async function readMitarbeiter() {
  const seeded = await readList('mitarbeiter:seeded', MITARBEITER_SEED_FILE);
  if (seeded.length) return readList('mitarbeiter', MITARBEITER_FILE);

  const current = await readList('mitarbeiter', MITARBEITER_FILE);
  if (!current.length) await writeList('mitarbeiter', MITARBEITER_FILE, DEFAULT_MITARBEITER);
  await writeList('mitarbeiter:seeded', MITARBEITER_SEED_FILE, [true]);
  return current.length ? current : DEFAULT_MITARBEITER;
}

module.exports = {
  redis,
  status,
  readTermine: () => readList('termine', TERMINE_FILE),
  writeTermine: data => writeList('termine', TERMINE_FILE, data),
  readFeiertage: () => readList('feiertage', FEIERTAGE_FILE),
  writeFeiertage: data => writeList('feiertage', FEIERTAGE_FILE, data),
  readMitarbeiter,
  writeMitarbeiter: data => writeList('mitarbeiter', MITARBEITER_FILE, data)
};
