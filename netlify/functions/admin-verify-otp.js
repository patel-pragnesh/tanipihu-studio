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

function toE164Indian(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (input && String(input).startsWith('+') && digits.length >= 11) return `+${digits}`;
  return '';
}

function loadAllowedPhone() {
  if (process.env.ADMIN_ALLOWED_PHONE) {
    return process.env.ADMIN_ALLOWED_PHONE.trim();
  }

  try {
    const filePath = path.join(__dirname, '..', '..', 'data', 'admin-settings.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed?.admin?.allowedPhone || '+919726571954';
  } catch {
    return '+919726571954';
  }
}

async function verifyOtp(phoneNumber, code) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    return { ok: false, error: 'OTP provider is not configured. Set Twilio env vars in Netlify.' };
  }

  const url = `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const params = new URLSearchParams();
  params.set('To', phoneNumber);
  params.set('Code', String(code || ''));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  const raw = await response.text();
  if (!response.ok) {
    return { ok: false, error: raw || 'OTP verification failed' };
  }

  const parsed = JSON.parse(raw);
  if (parsed.status !== 'approved') {
    return { ok: false, error: 'Invalid OTP' };
  }

  return { ok: true };
}

function makeSessionToken(phone) {
  const secret = process.env.ADMIN_OTP_SESSION_SECRET || 'change-me-in-netlify-env';
  const expiresAt = Date.now() + 1000 * 60 * 60 * 8;
  const payload = `${phone}|${expiresAt}`;
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

  const phone = toE164Indian(payload.phone);
  const code = String(payload.code || '').trim();
  const allowedPhone = toE164Indian(loadAllowedPhone());

  if (!phone || !code) {
    return json(400, { error: 'Phone and OTP code are required' });
  }

  if (phone !== allowedPhone) {
    return json(403, { error: 'This mobile number is not authorized for admin access' });
  }

  const verifyResult = await verifyOtp(phone, code);
  if (!verifyResult.ok) {
    return json(401, { error: verifyResult.error });
  }

  return json(200, {
    success: true,
    token: makeSessionToken(phone),
    expiresInMs: 1000 * 60 * 60 * 8
  });
};
