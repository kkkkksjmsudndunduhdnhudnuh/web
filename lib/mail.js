// Optional email via Resend (https://resend.com). Without RESEND_API_KEY nothing is sent.
// MAIL_FROM must use a domain verified in Resend; NOTIFY_EMAIL receives new-request alerts.
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'office@bambinikinderpraxis.at';

const configured = () => !!process.env.RESEND_API_KEY;

async function send({ to, subject, text }) {
  if (!configured()) return 'not-configured';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Bambini Kinder Praxis <onboarding@resend.dev>',
      to: [to], subject, text
    })
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return 'sent';
}

// Never throws: email problems must not break bookings or status changes.
async function trySend(message) {
  try {
    return await send(message);
  } catch (err) {
    console.error('E-Mail-Versand fehlgeschlagen:', err.message);
    return 'failed';
  }
}

const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());

module.exports = { NOTIFY_EMAIL, configured, trySend, isEmail };
