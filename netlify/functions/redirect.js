import { codesStore, scansStore, genId } from './_lib.js';

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
  // Fire-and-await: keep it simple; Netlify functions are short-lived.
  await scansStore().setJSON(`${id}/${scan.scanned_at}-${genId(6)}`, scan);

  return new Response(null, { status: 302, headers: { location: code.target_url } });
};

export const config = { path: '/r/:id' };
