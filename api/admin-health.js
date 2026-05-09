const fs = require('fs');
const path = require('path');

module.exports = async function vercelHandler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const hasSessionSecret = Boolean(process.env.ADMIN_OTP_SESSION_SECRET);
  const hasAdminPasscode = Boolean(process.env.ADMIN_LOGIN_PASSCODE);
  const hasGithubToken = Boolean(
    process.env.ADMIN_GITHUB_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  );

  const repo = process.env.ADMIN_GITHUB_REPO || 'patel-pragnesh/tanipihu-studio';
  const branch = process.env.ADMIN_GITHUB_BRANCH || 'main';

  const dataPaths = {
    adminSettings: path.join(process.cwd(), 'data', 'admin-settings.json'),
    products: path.join(process.cwd(), 'data', 'products.json'),
    overrides: path.join(process.cwd(), 'data', 'product-overrides.json'),
    siteSettings: path.join(process.cwd(), 'data', 'site-settings.json')
  };

  const files = {
    adminSettingsExists: fs.existsSync(dataPaths.adminSettings),
    productsExists: fs.existsSync(dataPaths.products),
    overridesExists: fs.existsSync(dataPaths.overrides),
    siteSettingsExists: fs.existsSync(dataPaths.siteSettings)
  };

  const ready = hasSessionSecret && hasGithubToken && files.productsExists && files.overridesExists && files.siteSettingsExists;

  return res.status(200).json({
    ok: ready,
    platform: 'vercel',
    timestamp: new Date().toISOString(),
    checks: {
      hasSessionSecret,
      hasAdminPasscode,
      hasGithubToken,
      repo,
      branch,
      ...files
    },
    nextSteps: ready
      ? ['API and file checks look good. Test /admin/ login and Save All Changes.']
      : [
          'Set missing environment variables in Vercel Project Settings > Environment Variables.',
          'Ensure data JSON files exist in repository and are deployed.'
        ]
  });
};
