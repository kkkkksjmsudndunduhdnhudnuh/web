const { redis } = require('./store');

// In-memory Fallback fuer lokale Entwicklung (ohne Redis).
const memStore = new Map();

function hitMemory(key, limit, windowSeconds) {
  const now = Date.now();
  let entry = memStore.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowSeconds * 1000 };
  }
  entry.count += 1;
  memStore.set(key, entry);
  if (entry.count > limit) {
    return { limited: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { limited: false };
}

async function hitRedis(key, limit, windowSeconds) {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  if (count > limit) {
    const ttl = await redis.ttl(key);
    return { limited: true, retryAfter: ttl > 0 ? ttl : windowSeconds };
  }
  return { limited: false };
}

// Zaehlt einen Zugriff auf `key` und meldet, ob das Limit innerhalb von
// `windowSeconds` Sekunden ueberschritten wurde.
async function hit(key, limit, windowSeconds) {
  if (redis) return hitRedis(key, limit, windowSeconds);
  return hitMemory(key, limit, windowSeconds);
}

function clientIp(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

module.exports = { hit, clientIp };
