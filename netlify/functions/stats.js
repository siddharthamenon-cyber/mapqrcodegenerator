import { db, json, shapeCode } from './_lib.js';

export default async (req) => {
  const id = new URL(req.url).pathname.split('/').pop();

  const { data: codeRow, error: codeErr } = await db().from('codes').select('*').eq('id', id).maybeSingle();
  if (codeErr) return json({ error: codeErr.message }, { status: 500 });
  if (!codeRow) return json({ error: 'Not found' }, { status: 404 });
  const code = shapeCode(codeRow);

  const { data: scans, error: scansErr } = await db()
    .from('scans')
    .select('scanned_at, ip, user_agent, referer')
    .eq('code_id', id)
    .order('scanned_at', { ascending: false });
  if (scansErr) return json({ error: scansErr.message }, { status: 500 });

  const recent_scans = scans.slice(0, 50).map(s => ({
    scanned_at: new Date(s.scanned_at).getTime(),
    ip: s.ip || '',
    user_agent: s.user_agent || '',
    referer: s.referer || '',
  }));

  const byDayMap = new Map();
  for (const s of scans) {
    const day = new Date(s.scanned_at).toISOString().slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) || 0) + 1);
  }
  const scans_by_day = [...byDayMap.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .slice(0, 30);

  return json({
    code,
    total_scans: scans.length,
    recent_scans,
    scans_by_day,
  });
};

export const config = { path: '/api/stats/:id' };
