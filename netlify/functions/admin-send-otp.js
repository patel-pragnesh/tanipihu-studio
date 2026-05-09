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

function makeChallengeToken(email, code, expiresAt) {
  const secret = process.env.ADMIN_OTP_SESSION_SECRET || 'change-me-in-netlify-env';
  const codeHash = crypto.createHash('sha256').update(String(code)).digest('hex');
  const payload = `${email}|${codeHash}|${expiresAt}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

function buildOtpEmailHtml(code) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222;">
      <h2 style="margin:0 0 12px;">Tani Pihu Admin Login</h2>
      <p style="margin:0 0 12px;">Use this OTP to access your admin panel:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:8px 0 16px;">${code}</p>
      <p style="margin:0;">OTP expires in 10 minutes.</p>
    </div>
  `;
}

async function sendEmailOtp(toEmail, code) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.ADMIN_OTP_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    return { ok: false, error: 'Email OTP provider not configured. Set RESEND_API_KEY and ADMIN_OTP_FROM_EMAIL.' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject: 'Your Admin OTP Code',
      html: buildOtpEmailHtml(code),
      text: `Your admin OTP is ${code}. It expires in 10 minutes.`
    })
  });

  if (!response.ok) {
    const err = await response.text();
    return { ok: false, error: err || 'Failed to send email OTP' };
  }

  return { ok: true };
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
  const allowedEmail = isValidEmail(loadAllowedEmail());

  if (!allowedEmail) {
    return json(500, { error: 'Allowed admin email is not configured.' });
  }

  if (!email) {
    return json(400, { error: 'Please enter a valid email address' });
  }

  if (email !== allowedEmail) {
    return json(403, { error: 'This email is not authorized for admin access' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 1000 * 60 * 10;
  const challengeToken = makeChallengeToken(email, code, expiresAt);

  const sendResult = await sendEmailOtp(email, code);
  if (!sendResult.ok) {
    return json(500, { error: sendResult.error });
  }

  const devMode = String(process.env.ADMIN_EMAIL_OTP_DEV_MODE || '').toLowerCase() === 'true';

  return json(200, {
    success: true,
    message: 'OTP sent successfully',
    challengeToken,
    devCode: devMode ? code : undefined
  });
};
