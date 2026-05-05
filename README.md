# UTM & QR Code Builder — MAP

Trackable UTM links and QR codes with structured naming and built-in scan analytics. Frontend on Netlify, data in Supabase, link shortening via TinyURL (or Bit.ly if you set a token).

## Architecture

- **`public/`** — static frontend. QR rendering and logo overlay happen client-side on `<canvas>`.
- **`netlify/functions/`** — four Functions:
  - `create.js` (`POST /api/create`) — validates input, shortens the tracked URL, writes to Supabase.
  - `redirect.js` (`GET /r/:id`) — looks up the code, logs a scan row, 302s to the destination with UTMs appended.
  - `codes.js` (`GET /api/codes`) — lists every saved code with scan_count and last_scan from a Postgres view.
  - `stats.js` (`GET /api/stats/:id`) — total / recent / by-day for one code.
- **Supabase** — Postgres tables `codes` and `scans` plus the `codes_with_stats` view. See [`supabase/schema.sql`](supabase/schema.sql).
- **Shortener** — Bit.ly if `BITLY_TOKEN` is set, otherwise TinyURL's keyless API. Falls back to the long `/r/:id` URL if both fail.

## First-time setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → New query → paste [`supabase/schema.sql`](supabase/schema.sql) → Run.
3. Project Settings → API → copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose in the browser)

### 2. Netlify env vars

Site → Site configuration → Environment variables → add:

| Key | Value |
|---|---|
| `SUPABASE_URL` | from step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
| `BITLY_TOKEN` | *(optional)* — Bit.ly Group Generic Access Token. If absent, TinyURL is used. |

### 3. Deploy

```bash
npm install
npx netlify login          # one-time
npx netlify init           # link / create site
npm run deploy
```

Or push to GitHub and connect the repo in app.netlify.com — `netlify.toml` already specifies `publish = "public"` and esbuild bundling for Functions.

## Local dev

```bash
npm install
npx netlify link           # link to the deployed site so functions get its env vars
npm run dev                # http://localhost:8888
```

`netlify dev` proxies functions and pulls env vars from the linked site, so Supabase + shortener calls work locally with the same credentials as prod.

## Notes

- Anyone with a code's `id` can hit `/r/:id` and `/api/stats/:id`. Add Netlify Identity in front of the analytics endpoints if you want internal-only access.
- The `service_role` key bypasses Supabase RLS — keep it server-only. The frontend never sees it.
- TinyURL's keyless API has soft rate limits. If you hit them, set `BITLY_TOKEN` and Bit.ly takes precedence.
- Scan logs are append-only and indexed by `(code_id, scanned_at desc)`. Postgres comfortably handles this for years; export to CSV from the listing or per-code analytics page when you need a snapshot.
