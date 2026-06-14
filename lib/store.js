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

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

let redis = null;
if (REDIS_URL && REDIS_TOKEN) {
  const { Redis } = require('@upstash/redis');
  redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
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
  readTermine: () => readList('termine', TERMINE_FILE),
  writeTermine: data => writeList('termine', TERMINE_FILE, data),
  readFeiertage: () => readList('feiertage', FEIERTAGE_FILE),
  writeFeiertage: data => writeList('feiertage', FEIERTAGE_FILE, data),
  readMitarbeiter,
  writeMitarbeiter: data => writeList('mitarbeiter', MITARBEITER_FILE, data)
};
