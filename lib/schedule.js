// Opening hours, closure periods and blocked slots – shared by booking validation
// and the public "belegt" endpoint. Hours: { "0": [], "1": [["08:00","13:00"]], ... }.

const DEFAULT_HOURS = {
  0: [],
  1: [['08:00', '13:00']],
  2: [['08:00', '13:00'], ['14:00', '17:00']],
  3: [['08:00', '13:00']],
  4: [['13:00', '18:00']],
  5: [['08:00', '12:00']],
  6: []
};
const SLOT_MINUTES = 15;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toTime = min => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function weekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function viennaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date());
}
function viennaMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = t => Number(parts.find(p => p.type === t).value);
  return get('hour') * 60 + get('minute');
}

function slotsFor(dateStr, hours) {
  const slots = [];
  for (const [start, end] of hours[weekday(dateStr)] || []) {
    for (let t = toMin(start); t < toMin(end); t += SLOT_MINUTES) slots.push(toTime(t));
  }
  return slots;
}

const closureFor = (dateStr, feiertage) =>
  feiertage.find(f => f.datum <= dateStr && dateStr <= (f.bis || f.datum));

// Slots blocked by a Sperrzeit on that date; a Sperrzeit without times blocks the whole day.
function blockedSlots(dateStr, sperrzeiten, hours) {
  const blocked = new Set();
  for (const s of sperrzeiten.filter(s => s.datum === dateStr)) {
    const all = slotsFor(dateStr, hours);
    if (!s.von || !s.bis) { all.forEach(t => blocked.add(t)); continue; }
    all.filter(t => toMin(t) >= toMin(s.von) && toMin(t) < toMin(s.bis)).forEach(t => blocked.add(t));
  }
  return blocked;
}

// Validates an hours object from the staff page; returns a clean copy or null.
function sanitizeHours(input) {
  if (!input || typeof input !== 'object') return null;
  const out = {};
  for (let d = 0; d <= 6; d++) {
    const ranges = input[d] ?? input[String(d)] ?? [];
    if (!Array.isArray(ranges) || ranges.length > 3) return null;
    out[d] = [];
    for (const r of ranges) {
      if (!Array.isArray(r) || !TIME_RE.test(r[0]) || !TIME_RE.test(r[1]) || toMin(r[0]) >= toMin(r[1])) return null;
      out[d].push([r[0], r[1]]);
    }
    out[d].sort((a, b) => toMin(a[0]) - toMin(b[0]));
    for (let i = 1; i < out[d].length; i++) if (toMin(out[d][i][0]) < toMin(out[d][i - 1][1])) return null;
  }
  return out;
}

module.exports = {
  DEFAULT_HOURS, TIME_RE, DATE_RE,
  toMin, weekday, viennaToday, viennaMinutes, slotsFor, closureFor, blockedSlots, sanitizeHours
};
