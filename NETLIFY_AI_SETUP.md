# Netlify AI Setup (Free-First)

This project is now configured for Netlify static hosting + Netlify Functions.

## What is included

- `/api/ai-gift-finder` -> smart recommendation API
- `/api/ai-complete-package` -> complete package plan API
- Redirects are configured in `netlify.toml`

## Deploy on Netlify

1. Push this repo to GitHub.
2. Connect repository in Netlify.
3. Build settings:
   - Build command: (leave empty)
   - Publish directory: `.`
4. Deploy site.

## Admin login setup (Free passcode mode)

This project now supports free admin access code login for `/admin` with no email provider required.

Required Netlify environment variable:

- `ADMIN_OTP_SESSION_SECRET` (random long secret)

Recommended Netlify environment variable:

- `ADMIN_LOGIN_PASSCODE` (strong code, e.g. `MyAdmin@2026`)

If `ADMIN_LOGIN_PASSCODE` is not set, fallback value is read from [data/admin-settings.json](data/admin-settings.json) -> `admin.accessCode`.

Optional email OTP mode (only if you want email-based OTP later):

- `ADMIN_ALLOWED_EMAIL`
- `RESEND_API_KEY`
- `ADMIN_OTP_FROM_EMAIL`
- `ADMIN_EMAIL_OTP_DEV_MODE=true` (testing only)

## Local development

Use Netlify CLI for local function support:

```bash
npm i -g netlify-cli
netlify dev
```

Open local URL from CLI output. API routes will work as `/api/*`.

## Free-first advanced roadmap

1. Use these existing APIs first (no paid AI needed).
2. Add optional Gemini endpoint later:
   - Create new function `netlify/functions/ai-gemini.js`
   - Add env var `GEMINI_API_KEY` in Netlify Site Settings
3. Add optional image generation endpoint later:
   - Trigger external service (RunPod/Modal) from function
   - Return image URLs to frontend

## Practical low-cost strategy

- Keep recommendation + package logic in functions (free).
- Use WhatsApp for checkout/finalization (no payment gateway cost initially).
- Use one-click package + personalized text as your unique differentiator.
- Add paid model usage only for premium users/customization orders.
