import { db, buildFinalUrl, shapeCode } from './_lib.js';

export default async (req) => {
  const id = new URL(req.url).pathname.split('/').pop();
  if (!id) return new Response('Missing id', { status: 400 });

  const { data: row, error } = await db().from('codes').select('*').eq('id', id).maybeSingle();
  if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
  if (!row) return new Response('QR code not found', { status: 404 });

  const code = shapeCode(row);

  // Log the scan. Don't block the redirect on failure.
  try {
    await db().from('scans').insert({
      code_id: id,
      ip: req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '',
      user_agent: req.headers.get('user-agent') || '',
      referer: req.headers.get('referer') || '',
    });
  } catch { /* swallow — log later if needed */ }

  return new Response(null, {
    status: 302,
    headers: { location: buildFinalUrl({ target_url: code.target_url, utm: code.utm }) },
  });
};

export const config = { path: '/r/:id' };
