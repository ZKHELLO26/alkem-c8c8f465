# Vivid Vitals — Deployment Guide

## ⚠️ This is a TanStack Start app (SSR), not a static Vite SPA

There is no `index.html` or `src/main.tsx` — that's correct. TanStack Start generates entry points automatically. The real root is `src/routes/__root.tsx` + `src/router.tsx`.

---

## Deploy to Vercel ✅ (now supported)

Files added for Vercel:
- `vite.config.vercel.ts` — Vercel-specific Vite config (no Cloudflare plugin)
- `vercel.json` — build/route config
- `api/index.mjs` — Node serverless function wrapping the SSR handler

**Steps:**
1. Push this repo to GitHub
2. Vercel → New Project → Import the repo
3. Leave all settings as default and click Deploy

Vercel will auto-detect `vercel.json` and run:
```
npm install --legacy-peer-deps
vite build --config vite.config.vercel.ts
```

Static client assets are served from `dist/client/`, all other requests are rewritten to `/api/index.mjs` which runs the SSR handler from `dist/server/server.js`.

**Node runtime:** 20.x (set in `api/index.mjs`).

---

## Deploy to Cloudflare (also pre-configured)
The original `vite.config.ts` + `wrangler.jsonc` target Cloudflare Workers.
```bash
bun install
bun run build
npx wrangler deploy
```

## Deploy via Lovable (zero-config)
Click **Publish → Update** in the Lovable editor. Live at `https://vivid-vitals-ai.lovable.app`.

---

## Local Development
```bash
npm install --legacy-peer-deps    # or: bun install
npm run dev
```

## Build
- For Cloudflare/Lovable: `npm run build` (uses `vite.config.ts`)
- For Vercel: `vite build --config vite.config.vercel.ts`

## Project Structure
```
src/
├── routes/          ← File-based routes (TanStack Router)
│   ├── __root.tsx   ← Root HTML shell (replaces index.html)
│   ├── index.tsx    ← Home /
│   ├── details.tsx
│   ├── scan.tsx
│   └── results.tsx
├── router.tsx       ← Router config (replaces main.tsx)
├── styles.css       ← Tailwind v4 + design tokens
├── components/      ← shadcn/ui
├── lib/             ← Face detection, age estimation, scan store
└── assets/          ← Face images
api/
└── index.mjs        ← Vercel serverless adapter
vite.config.ts        ← Cloudflare/Lovable build
vite.config.vercel.ts ← Vercel build
vercel.json           ← Vercel deployment config
wrangler.jsonc        ← Cloudflare config
```

## Camera/Face Scan
- **HTTPS required** in production (all targets above provide this)
- Works on mobile front camera
