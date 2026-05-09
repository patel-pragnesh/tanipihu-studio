const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function loadAccessCode() {
  if (process.env.ADMIN_LOGIN_PASSCODE) {
    return String(process.env.ADMIN_LOGIN_PASSCODE).trim();
  }

  try {
    const filePath = path.join(__dirname, '..', '..', 'data', 'admin-settings.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return String(parsed?.admin?.accessCode || '').trim();
  } catch {
    return '';
  }
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a || ''));
  const bBuf = Buffer.from(String(b || ''));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function makeSessionToken() {
  const secret = process.env.ADMIN_OTP_SESSION_SECRET || 'change-me-in-netlify-env';
  const expiresAt = Date.now() + 1000 * 60 * 60 * 8;
  const payload = `admin|${expiresAt}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return {
    token: Buffer.from(`${payload}|${sig}`).toString('base64url'),
    expiresInMs: 1000 * 60 * 60 * 8
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const accessCode = loadAccessCode();
  const passcode = String(payload.passcode || '').trim();

  if (!accessCode) {
    return json(500, { error: 'Admin access code not configured. Set ADMIN_LOGIN_PASSCODE or data/admin-settings.json admin.accessCode.' });
  }

  if (!passcode) {
    return json(400, { error: 'Access code is required.' });
  }

  if (!safeEqual(passcode, accessCode)) {
    return json(401, { error: 'Invalid access code.' });
  }

  const session = makeSessionToken();
  return json(200, { success: true, token: session.token, expiresInMs: session.expiresInMs });
};
