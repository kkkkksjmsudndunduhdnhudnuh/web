const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TERMINE_FILE = path.join(DATA_DIR, 'termine.json');
const FEIERTAGE_FILE = path.join(DATA_DIR, 'feiertage.json');
const MITARBEITER_FILE = path.join(DATA_DIR, 'mitarbeiter.json');

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

module.exports = {
  redis,
  readTermine: () => readList('termine', TERMINE_FILE),
  writeTermine: data => writeList('termine', TERMINE_FILE, data),
  readFeiertage: () => readList('feiertage', FEIERTAGE_FILE),
  writeFeiertage: data => writeList('feiertage', FEIERTAGE_FILE, data),
  readMitarbeiter: () => readList('mitarbeiter', MITARBEITER_FILE),
  writeMitarbeiter: data => writeList('mitarbeiter', MITARBEITER_FILE, data)
};
