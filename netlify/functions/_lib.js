import { getStore } from '@netlify/blobs';

export const codesStore = () => getStore({ name: 'codes', consistency: 'strong' });
export const scansStore = () => getStore({ name: 'scans', consistency: 'strong' });

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

export async function listAllScans(codeId) {
  const store = scansStore();
  const out = [];
  let cursor;
  do {
    const page = await store.list({ prefix: `${codeId}/`, cursor });
    for (const b of page.blobs) {
      const v = await store.get(b.key, { type: 'json' });
      if (v) out.push(v);
    }
    cursor = page.cursor;
  } while (cursor);
  return out;
}

export async function listAllCodes() {
  const store = codesStore();
  const out = [];
  let cursor;
  do {
    const page = await store.list({ cursor });
    for (const b of page.blobs) {
      const v = await store.get(b.key, { type: 'json' });
      if (v) out.push(v);
    }
    cursor = page.cursor;
  } while (cursor);
  return out;
}
