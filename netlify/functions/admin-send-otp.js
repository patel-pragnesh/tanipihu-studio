const fs = require('fs');
const path = require('path');

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

async function sendVerifyOtp(phoneNumber) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    return { ok: false, error: 'OTP provider is not configured. Set Twilio env vars in Netlify.' };
  }

  const url = `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const params = new URLSearchParams();
  params.set('To', phoneNumber);
  params.set('Channel', 'sms');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const err = await response.text();
    return { ok: false, error: err || 'Failed to send OTP' };
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

  const phone = toE164Indian(payload.phone);
  const allowedPhone = toE164Indian(loadAllowedPhone());

  if (!phone) {
    return json(400, { error: 'Please enter a valid mobile number' });
  }

  if (phone !== allowedPhone) {
    return json(403, { error: 'This mobile number is not authorized for admin access' });
  }

  const sendResult = await sendVerifyOtp(phone);
  if (!sendResult.ok) {
    return json(500, { error: sendResult.error });
  }

  return json(200, { success: true, message: 'OTP sent successfully' });
};
