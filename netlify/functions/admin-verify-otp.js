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

function isValidEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function loadAllowedEmail() {
  if (process.env.ADMIN_ALLOWED_EMAIL) {
    return String(process.env.ADMIN_ALLOWED_EMAIL).trim().toLowerCase();
  }

  try {
    const filePath = path.join(__dirname, '..', '..', 'data', 'admin-settings.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return String(parsed?.admin?.allowedEmail || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function verifyChallengeToken(email, code, challengeToken) {
  try {
    const secret = process.env.ADMIN_OTP_SESSION_SECRET || 'change-me-in-netlify-env';
    const decoded = Buffer.from(String(challengeToken || ''), 'base64url').toString('utf8');
    const [tokenEmail, codeHash, expiresAtRaw, signature] = decoded.split('|');

    if (!tokenEmail || !codeHash || !expiresAtRaw || !signature) {
      return { ok: false, error: 'Invalid challenge token.' };
    }

    const payload = `${tokenEmail}|${codeHash}|${expiresAtRaw}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (expectedSig !== signature) {
      return { ok: false, error: 'Invalid challenge signature.' };
    }

    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      return { ok: false, error: 'OTP expired. Please request a new OTP.' };
    }

    if (tokenEmail !== email) {
      return { ok: false, error: 'Email mismatch in OTP challenge.' };
    }

    const suppliedCodeHash = crypto.createHash('sha256').update(String(code || '')).digest('hex');
    if (suppliedCodeHash !== codeHash) {
      return { ok: false, error: 'Invalid OTP.' };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Invalid OTP challenge format.' };
  }
}

function makeSessionToken(email) {
  const secret = process.env.ADMIN_OTP_SESSION_SECRET || 'change-me-in-netlify-env';
  const expiresAt = Date.now() + 1000 * 60 * 60 * 8;
  const payload = `${email}|${expiresAt}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
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

  const email = isValidEmail(payload.email);
  const code = String(payload.code || '').trim();
  const challengeToken = String(payload.challengeToken || '');
  const allowedEmail = isValidEmail(loadAllowedEmail());

  if (!allowedEmail) {
    return json(500, { error: 'Allowed admin email is not configured.' });
  }

  if (!email || !code || !challengeToken) {
    return json(400, { error: 'Email, OTP code, and challenge token are required' });
  }

  if (email !== allowedEmail) {
    return json(403, { error: 'This email is not authorized for admin access' });
  }

  const verifyResult = verifyChallengeToken(email, code, challengeToken);
  if (!verifyResult.ok) {
    return json(401, { error: verifyResult.error });
  }

  return json(200, {
    success: true,
    token: makeSessionToken(email),
    expiresInMs: 1000 * 60 * 60 * 8
  });
};
