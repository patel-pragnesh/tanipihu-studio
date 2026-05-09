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

## Admin OTP login setup (Email-based)

This project now supports admin OTP gate for `/admin`.

Set these Netlify environment variables:

- `RESEND_API_KEY`
- `ADMIN_OTP_FROM_EMAIL` (example: `Tani Pihu <noreply@yourdomain.com>`)
- `ADMIN_OTP_SESSION_SECRET` (random long secret)
- Optional override: `ADMIN_ALLOWED_EMAIL` (example: `owner@yourdomain.com`)

Optional (dev only):

- `ADMIN_EMAIL_OTP_DEV_MODE=true` (returns OTP in API response for local testing)

Allowed email can be changed in two ways:

1. Netlify env var `ADMIN_ALLOWED_EMAIL` (highest priority)
2. Admin file [data/admin-settings.json](data/admin-settings.json)

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
