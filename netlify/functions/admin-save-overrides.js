const crypto = require('crypto');

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function verifySessionToken(token) {
  try {
    if (!token) return { ok: false, reason: 'Missing session token.' };

    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [role, expiresAtRaw, signature] = decoded.split('|');
    const expiresAt = Number(expiresAtRaw || 0);

    if (role !== 'admin') {
      return { ok: false, reason: 'Invalid session role.' };
    }

    if (!expiresAt || expiresAt <= Date.now()) {
      return { ok: false, reason: 'Session expired.' };
    }

    const secret = process.env.ADMIN_OTP_SESSION_SECRET || 'change-me-in-netlify-env';
    const payload = `${role}|${expiresAt}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const a = Buffer.from(String(signature || ''));
    const b = Buffer.from(String(expectedSig || ''));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, reason: 'Invalid session signature.' };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: 'Invalid session token format.' };
  }
}

function normalizeOverride(item) {
  const id = String(item?.id || '').trim();
  if (!id) return null;

  const numericPrice = Number(item?.price);
  const numericOfferPrice = Number(item?.offerPrice);

  const normalized = {
    id,
    category: String(item?.category || '').trim() || 'custom',
    price: Number.isFinite(numericPrice) ? numericPrice : 0,
    isActive: Boolean(item?.isActive),
    offerEnabled: Boolean(item?.offerEnabled),
    images: Array.isArray(item?.images)
      ? item.images.map((img) => String(img || '').trim()).filter(Boolean)
      : []
  };

  if (Number.isFinite(numericOfferPrice)) {
    normalized.offerPrice = numericOfferPrice;
  }

  if (item?.offerLabel != null) {
    const label = String(item.offerLabel).trim();
    if (label) normalized.offerLabel = label;
  }

  if (item?.offerEndsAt != null) {
    const ends = String(item.offerEndsAt).trim();
    if (ends) normalized.offerEndsAt = ends;
  }

  return normalized;
}

function normalizeMarketingBanner(item) {
  const numericMinAmount = Number(item?.minOrderAmount);
  return {
    enabled: Boolean(item?.enabled),
    text: String(item?.text || '').trim(),
    couponCode: String(item?.couponCode || '').trim(),
    discountText: String(item?.discountText || '').trim(),
    minOrderAmount: Number.isFinite(numericMinAmount) ? numericMinAmount : 0
  };
}

async function githubRequest(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.message || `GitHub API failed with ${response.status}`;
    throw new Error(message);
  }

  return data;
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const auth = String(event.headers.authorization || event.headers.Authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const session = verifySessionToken(token);
  if (!session.ok) {
    return json(401, { error: session.reason });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  if (!Array.isArray(payload.overrides)) {
    return json(400, { error: 'overrides must be an array.' });
  }

  const normalized = payload.overrides.map(normalizeOverride).filter(Boolean);
  const normalizedBanner = normalizeMarketingBanner(payload.marketingBanner || {});

  const githubToken =
    process.env.ADMIN_GITHUB_TOKEN ||
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN;

  const repo = process.env.ADMIN_GITHUB_REPO || 'patel-pragnesh/tanipihu-studio';
  const branch = process.env.ADMIN_GITHUB_BRANCH || 'main';
  const overridePath = 'data/product-overrides.json';
  const siteSettingsPath = 'data/site-settings.json';

  if (!githubToken) {
    return json(500, {
      error:
        'Missing GitHub token. Set ADMIN_GITHUB_TOKEN in Netlify environment variables.'
    });
  }

  try {
    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json'
    };

    const currentOverride = await githubRequest(
      `https://api.github.com/repos/${repo}/contents/${overridePath}?ref=${encodeURIComponent(branch)}`,
      { method: 'GET', headers }
    );

    const updatedOverrides = await githubRequest(`https://api.github.com/repos/${repo}/contents/${overridePath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: 'admin: update product overrides',
        content: Buffer.from(`${JSON.stringify({ overrides: normalized }, null, 2)}\n`).toString('base64'),
        sha: currentOverride.sha,
        branch
      })
    });

    const currentSite = await githubRequest(
      `https://api.github.com/repos/${repo}/contents/${siteSettingsPath}?ref=${encodeURIComponent(branch)}`,
      { method: 'GET', headers }
    );

    const updatedSite = await githubRequest(`https://api.github.com/repos/${repo}/contents/${siteSettingsPath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: 'admin: update site banner settings',
        content: Buffer.from(`${JSON.stringify({ marketingBanner: normalizedBanner }, null, 2)}\n`).toString('base64'),
        sha: currentSite.sha,
        branch
      })
    });

    return json(200, {
      success: true,
      commitSha: updatedSite?.commit?.sha || updatedOverrides?.commit?.sha || null,
      message: 'Overrides and banner settings saved successfully.'
    });
  } catch (error) {
    return json(500, { error: error.message || 'Failed to save overrides.' });
  }
};
