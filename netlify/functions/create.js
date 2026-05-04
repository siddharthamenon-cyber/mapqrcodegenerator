import { codesStore, genId, json } from './_lib.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, { status: 405 });
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, { status: 400 }); }

  const url = (body.url || '').trim();
  const label = (body.label || '').trim() || null;
  if (!/^https?:\/\/.+/i.test(url)) return json({ error: 'URL must start with http:// or https://' }, { status: 400 });

  const id = genId(8);
  const record = { id, target_url: url, label, created_at: Date.now() };
  await codesStore().setJSON(id, record);

  const origin = new URL(req.url).origin;
  return json({
    ...record,
    tracking_url: `${origin}/r/${id}`,
    analytics_url: `${origin}/analytics.html?id=${id}`,
  });
};

export const config = { path: '/api/create' };
