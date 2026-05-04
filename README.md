# QR Analytics — Netlify

Trackable QR generator with optional logo overlay, deployed on Netlify Functions + Blobs.

## Architecture

- **`public/`** — static frontend. QR rendering and logo compositing happen client-side on a `<canvas>` (no `sharp` binary on Lambda).
- **`netlify/functions/create.js`** (`POST /api/create`) — stores `{id, target_url, label}` in the `codes` blob store, returns the tracking URL.
- **`netlify/functions/redirect.js`** (`GET /r/:id`) — looks up the code, writes a scan record to the `scans` blob store, then 302s to the destination.
- **`netlify/functions/codes.js`** (`GET /api/codes`) — lists all codes with scan counts.
- **`netlify/functions/stats.js`** (`GET /api/stats/:id`) — total, recent 50, and daily buckets for one code.

Storage is [Netlify Blobs](https://docs.netlify.com/blobs/overview/) — automatically provisioned per site, no setup.

## Local dev

```bash
npm install
npx netlify login        # one-time
npx netlify link         # link to a Netlify site (creates one if needed)
npm run dev              # http://localhost:8888
```

`netlify dev` proxies functions and gives Blobs access via your linked site.

## Deploy

```bash
npm run deploy
```

Or connect the repo on app.netlify.com — `netlify.toml` already specifies `publish = "public"` and esbuild bundling for functions. Blobs work automatically in production.

## Notes

- Codes are public by id (anyone with the id can hit `/r/:id` and `/api/stats/:id`). For real use, add auth (e.g. Netlify Identity) on the stats and codes endpoints.
- Scan records are stored as one blob per scan (`scans/{codeId}/{ts}-{rand}`). Listing aggregates them. Fine up to a few thousand scans per code; beyond that, swap in a real DB or precompute counters.
