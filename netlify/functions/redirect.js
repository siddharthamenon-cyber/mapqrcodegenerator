import { codesStore, scansStore, genId } from './_lib.js';

function buildFinalUrl(code) {
  if (!code.utm) return code.target_url;
  try {
    const u = new URL(code.target_url);
    u.searchParams.set('utm_source', code.utm.source);
    u.searchParams.set('utm_medium', code.utm.medium);
    u.searchParams.set('utm_campaign', code.utm.campaign);
    if (code.utm.content) u.searchParams.set('utm_content', code.utm.content);
    return u.toString();
  } catch {
    return code.target_url;
  }
}

export default async (req) => {
  const id = new URL(req.url).pathname.split('/').pop();
  if (!id) return new Response('Missing id', { status: 400 });

  const code = await codesStore().get(id, { type: 'json' });
  if (!code) return new Response('QR code not found', { status: 404 });

  const scan = {
    scanned_at: Date.now(),
    ip: req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '',
    user_agent: req.headers.get('user-agent') || '',
    referer: req.headers.get('referer') || '',
  };
  await scansStore().setJSON(`${id}/${scan.scanned_at}-${genId(6)}`, scan);

  return new Response(null, { status: 302, headers: { location: buildFinalUrl(code) } });
};

export const config = { path: '/r/:id' };
