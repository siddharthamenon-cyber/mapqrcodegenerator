import { codesStore, json, listAllScans } from './_lib.js';

export default async (req) => {
  const id = new URL(req.url).pathname.split('/').pop();
  const code = await codesStore().get(id, { type: 'json' });
  if (!code) return json({ error: 'Not found' }, { status: 404 });

  const scans = await listAllScans(id);
  scans.sort((a, b) => b.scanned_at - a.scanned_at);

  const byDayMap = new Map();
  for (const s of scans) {
    const day = new Date(s.scanned_at).toISOString().slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) || 0) + 1);
  }
  const scansByDay = [...byDayMap.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .slice(0, 30);

  return json({
    code,
    total_scans: scans.length,
    recent_scans: scans.slice(0, 50),
    scans_by_day: scansByDay,
  });
};

export const config = { path: '/api/stats/:id' };
