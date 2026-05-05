import { createClient } from '@supabase/supabase-js';

let _client;
export function db() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. Set them in Netlify → Site → Environment variables.');
    }
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}

export function genId(len = 8) {
  const a = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
}

// Shape a Supabase row into the API shape the frontend expects.
export function shapeCode(c) {
  if (!c) return null;
  const utm = c.utm_source && c.utm_medium && c.utm_campaign
    ? { source: c.utm_source, medium: c.utm_medium, campaign: c.utm_campaign, content: c.utm_content || null }
    : null;
  return {
    id: c.id,
    target_url: c.target_url,
    team: c.team,
    project: c.project,
    deployment: c.deployment,
    deployment_detail: c.deployment_detail,
    label: c.label,
    utm,
    tracked_url: c.tracked_url,
    short_url: c.short_url,
    created_at: c.created_at ? new Date(c.created_at).getTime() : null,
    scan_count: c.scan_count ?? 0,
    last_scan: c.last_scan ? new Date(c.last_scan).getTime() : null,
  };
}

export function buildFinalUrl({ target_url, utm }) {
  if (!utm) return target_url;
  try {
    const u = new URL(target_url);
    u.searchParams.set('utm_source', utm.source);
    u.searchParams.set('utm_medium', utm.medium);
    u.searchParams.set('utm_campaign', utm.campaign);
    if (utm.content) u.searchParams.set('utm_content', utm.content);
    return u.toString();
  } catch {
    return target_url;
  }
}

// Try Bit.ly first if BITLY_TOKEN is set, otherwise fall back to TinyURL's
// keyless API. Returns null if both fail (frontend then uses the long URL).
export async function shortenUrl(longUrl) {
  if (process.env.BITLY_TOKEN) {
    try {
      const r = await fetch('https://api-ssl.bitly.com/v4/shorten', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.BITLY_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ long_url: longUrl }),
        signal: AbortSignal.timeout(6000),
      });
      if (r.ok) {
        const j = await r.json();
        if (j.link) return j.link;
      }
    } catch { /* fall through to TinyURL */ }
  }
  try {
    const r = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const text = (await r.text()).trim();
    if (!/^https?:\/\//i.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}
